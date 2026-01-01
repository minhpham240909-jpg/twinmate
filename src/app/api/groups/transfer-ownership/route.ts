import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { enforceUserAccess } from '@/lib/security/checkUserBan'
import { NotificationType } from '@prisma/client'

const transferSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  newOwnerId: z.string().min(1, 'New owner ID is required'),
})

/**
 * POST /api/groups/transfer-ownership
 * Transfer group ownership to another member
 *
 * SCALABILITY: Optimized for 1000-3000 concurrent users
 * - Single transaction for atomicity
 * - Batch notification creation
 * - No N+1 queries (single query with includes)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // SECURITY: Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(user.id)
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { error: accessCheck.errorResponse?.error || 'Access denied' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = transferSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId, newOwnerId } = validation.data

    // Prevent transferring to self
    if (newOwnerId === user.id) {
      return NextResponse.json(
        { error: 'You are already the owner of this group' },
        { status: 400 }
      )
    }

    // Get group with members in single query (avoid N+1)
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if group is deleted
    if (group.isDeleted) {
      return NextResponse.json(
        { error: 'Cannot transfer ownership of a deleted group' },
        { status: 400 }
      )
    }

    // Verify current user is the owner
    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only the group owner can transfer ownership' },
        { status: 403 }
      )
    }

    // Verify new owner is a member of the group
    const newOwnerMembership = group.members.find(m => m.userId === newOwnerId)
    if (!newOwnerMembership) {
      return NextResponse.json(
        { error: 'New owner must be a member of the group' },
        { status: 400 }
      )
    }

    // Get current owner's membership
    const currentOwnerMembership = group.members.find(m => m.userId === user.id)

    // Perform transfer in a transaction for atomicity
    // SCALABILITY: Single transaction prevents race conditions
    await prisma.$transaction(async (tx) => {
      // Update group owner
      await tx.group.update({
        where: { id: groupId },
        data: { ownerId: newOwnerId },
      })

      // Update new owner's role to OWNER
      await tx.groupMember.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'OWNER' },
      })

      // Update previous owner's role to ADMIN (they remain in group)
      if (currentOwnerMembership) {
        await tx.groupMember.update({
          where: { id: currentOwnerMembership.id },
          data: { role: 'ADMIN' },
        })
      }
    })

    // Get user names for notification (batch query)
    const [currentOwner, newOwner] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: newOwnerId },
        select: { name: true, email: true },
      }),
    ])

    const currentOwnerName = currentOwner?.name || currentOwner?.email || 'Previous owner'
    const newOwnerName = newOwner?.name || newOwner?.email || 'New owner'

    // Send notifications (batch create for scalability)
    const notificationData: { userId: string; type: NotificationType; title: string; message: string }[] = []

    // Notify new owner
    notificationData.push({
      userId: newOwnerId,
      type: NotificationType.GROUP_OWNERSHIP_RECEIVED,
      title: 'You are now the group owner',
      message: `${currentOwnerName} has transferred ownership of "${group.name}" to you.`,
    })

    // Notify all other members
    const otherMemberIds = group.members
      .filter(m => m.userId !== user.id && m.userId !== newOwnerId)
      .map(m => m.userId)

    for (const memberId of otherMemberIds) {
      notificationData.push({
        userId: memberId,
        type: NotificationType.GROUP_OWNERSHIP_CHANGED,
        title: 'Group ownership changed',
        message: `${newOwnerName} is now the owner of "${group.name}".`,
      })
    }

    // Batch create notifications (scalable)
    if (notificationData.length > 0) {
      await prisma.notification.createMany({
        data: notificationData,
      })
    }

    console.log(`[TRANSFER OWNERSHIP] Group ${groupId}: ${user.id} -> ${newOwnerId}`)

    return NextResponse.json({
      success: true,
      message: 'Ownership transferred successfully',
      newOwnerId,
    })
  } catch (error) {
    console.error('Transfer ownership error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
