import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { enforceUserAccess } from '@/lib/security/checkUserBan'
import { NotificationType } from '@prisma/client'

const leaveSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
})

/**
 * POST /api/groups/leave
 * Leave a group. If owner leaves, automatically transfer ownership to another member.
 *
 * SCALABILITY: Optimized for 1000-3000 concurrent users
 * - Single query with includes (no N+1)
 * - Transaction for atomicity
 * - Batch notifications
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
    const validation = leaveSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId } = validation.data

    // Get group with all members in single query (avoid N+1)
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc', // Oldest members first for ownership transfer
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
        { error: 'Cannot leave a deleted group' },
        { status: 400 }
      )
    }

    // Check if user is a member
    const membership = group.members.find(m => m.userId === user.id)
    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 400 }
      )
    }

    const isOwner = group.ownerId === user.id
    const otherMembers = group.members.filter(m => m.userId !== user.id)

    // If owner is leaving and there are other members, transfer ownership
    if (isOwner && otherMembers.length > 0) {
      // Find the best candidate for new owner:
      // 1. First, look for an ADMIN
      // 2. If no admin, pick the oldest member (first to join)
      let newOwnerMembership = otherMembers.find(m => m.role === 'ADMIN')
      if (!newOwnerMembership) {
        newOwnerMembership = otherMembers[0] // Oldest member (already sorted by joinedAt)
      }

      const newOwnerId = newOwnerMembership.userId
      const newOwnerName = newOwnerMembership.user.name || newOwnerMembership.user.email || 'A member'

      // Get leaving user's name for notifications
      const leavingUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true },
      })
      const leavingUserName = leavingUser?.name || leavingUser?.email || 'The owner'

      // Perform transfer and leave in a transaction
      await prisma.$transaction(async (tx) => {
        // Transfer ownership
        await tx.group.update({
          where: { id: groupId },
          data: { ownerId: newOwnerId },
        })

        // Update new owner's role to OWNER
        await tx.groupMember.update({
          where: { id: newOwnerMembership!.id },
          data: { role: 'OWNER' },
        })

        // Remove the leaving owner from the group
        await tx.groupMember.delete({
          where: { id: membership.id },
        })
      })

      // Send notifications (batch create for scalability)
      const notificationData: { userId: string; type: NotificationType; title: string; message: string }[] = []

      // Notify new owner
      notificationData.push({
        userId: newOwnerId,
        type: NotificationType.GROUP_OWNERSHIP_RECEIVED,
        title: 'You are now the group owner',
        message: `${leavingUserName} has left "${group.name}" and you are now the owner.`,
      })

      // Notify all other members about ownership change
      for (const member of otherMembers) {
        if (member.userId !== newOwnerId) {
          notificationData.push({
            userId: member.userId,
            type: NotificationType.GROUP_OWNERSHIP_CHANGED,
            title: 'Group ownership changed',
            message: `${leavingUserName} has left "${group.name}". ${newOwnerName} is now the owner.`,
          })
        }
      }

      // Batch create notifications
      if (notificationData.length > 0) {
        await prisma.notification.createMany({
          data: notificationData,
        })
      }

      console.log(`[LEAVE GROUP] Owner ${user.id} left group ${groupId}, transferred to ${newOwnerId}`)

      return NextResponse.json({
        success: true,
        message: 'Successfully left group. Ownership transferred.',
        ownershipTransferred: true,
        newOwnerId,
        newOwnerName,
      })
    }

    // If owner is leaving and no other members, delete the group
    if (isOwner && otherMembers.length === 0) {
      await prisma.$transaction(async (tx) => {
        // Remove the owner from members
        await tx.groupMember.delete({
          where: { id: membership.id },
        })

        // Soft delete the group
        await tx.group.update({
          where: { id: groupId },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        })
      })

      console.log(`[LEAVE GROUP] Owner ${user.id} left empty group ${groupId}, group deleted`)

      return NextResponse.json({
        success: true,
        message: 'Successfully left group. Group has been deleted as it has no members.',
        groupDeleted: true,
      })
    }

    // Regular member leaving (not owner)
    await prisma.groupMember.delete({
      where: { id: membership.id },
    })

    console.log(`[LEAVE GROUP] Member ${user.id} left group ${groupId}`)

    return NextResponse.json({
      success: true,
      message: 'Successfully left group',
    })
  } catch (error) {
    console.error('Leave group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
