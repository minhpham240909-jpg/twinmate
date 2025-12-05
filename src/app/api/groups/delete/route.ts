import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceUserAccess } from '@/lib/security/checkUserBan'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(user.id)
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { success: false, error: accessCheck.errorResponse?.error || 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { groupId } = body

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 })
    }

    // Get the group with all members
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 })
    }

    // Check if the user is the owner
    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the group owner can delete the group' },
        { status: 403 }
      )
    }

    // Get all member user IDs (excluding the owner)
    const memberIds = group.members
      .filter((member) => member.userId !== user.id)
      .map((member) => member.userId)

    // Get owner info for notification
    const ownerUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true },
    })

    const ownerName = ownerUser?.name || ownerUser?.email || 'The owner'

    // Check if group is already deleted
    if (group.isDeleted) {
      return NextResponse.json(
        { success: false, error: 'Group already deleted' },
        { status: 400 }
      )
    }

    // Soft delete the group
    console.log(`[DELETE GROUP] Soft deleting group: ${groupId} (${group.name})`)

    await prisma.group.update({
      where: { id: groupId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    console.log(`[DELETE GROUP] Successfully soft deleted group: ${groupId}`)

    // Send notification to all members (excluding owner)
    if (memberIds.length > 0) {
      await prisma.notification.createMany({
        data: memberIds.map((memberId: string) => ({
          userId: memberId,
          type: 'GROUP_REMOVED',
          title: 'Group Deleted',
          message: `${ownerName} has deleted the group "${group.name}"`,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
      notifiedMembers: memberIds.length,
      groupId: groupId, // Return the deleted group ID for frontend to use
    })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete group' },
      { status: 500 }
    )
  }
}
