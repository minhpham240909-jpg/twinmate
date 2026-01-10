import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceUserAccess } from '@/lib/security/checkUserBan'

/**
 * POST /api/groups/force-delete-all
 * Force deletes all groups owned by the authenticated user
 * This performs a soft delete on all owned groups
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // SECURITY: Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(user.id)
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { success: false, error: accessCheck.errorResponse?.error || 'Access denied' },
        { status: 403 }
      )
    }

    // Get all groups owned by this user that are not already deleted
    const ownedGroups = await prisma.group.findMany({
      where: {
        ownerId: user.id,
        isDeleted: false,
      },
      include: {
        members: {
          take: 100, // Limit members to prevent unbounded queries
          where: {
            userId: { not: user.id }, // Exclude owner from notifications
          },
          select: {
            userId: true,
          },
        },
      },
    })

    if (ownedGroups.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No groups to delete',
        deletedCount: 0,
        notifiedMembers: 0,
      })
    }

    // Get owner info for notifications
    const ownerUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true },
    })
    const ownerName = ownerUser?.name || ownerUser?.email || 'The owner'

    // Collect all member IDs to notify and group IDs to delete
    const groupIds = ownedGroups.map((g) => g.id)
    const notifications: { userId: string; groupName: string }[] = []

    for (const group of ownedGroups) {
      for (const member of group.members) {
        notifications.push({
          userId: member.userId,
          groupName: group.name,
        })
      }
    }

    // Perform soft delete on all owned groups in a transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete all groups
      await tx.group.updateMany({
        where: {
          id: { in: groupIds },
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      })

      // Create notifications for all affected members
      if (notifications.length > 0) {
        await tx.notification.createMany({
          data: notifications.map((n) => ({
            userId: n.userId,
            type: 'GROUP_REMOVED',
            title: 'Group Deleted',
            message: `${ownerName} has deleted the group "${n.groupName}"`,
          })),
        })
      }
    })

    console.log(
      `[FORCE DELETE ALL] User ${user.id} deleted ${groupIds.length} groups, notified ${notifications.length} members`
    )

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${groupIds.length} group(s)`,
      deletedCount: groupIds.length,
      deletedGroupIds: groupIds,
      notifiedMembers: notifications.length,
    })
  } catch (error) {
    console.error('[FORCE DELETE ALL] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete groups' },
      { status: 500 }
    )
  }
}
