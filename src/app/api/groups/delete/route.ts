import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // Get owner profile for notification
    const ownerProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { name: true },
    })

    const ownerName = ownerProfile?.name || user.email || 'The owner'

    // Delete the group (cascade will delete members, messages, invites)
    await prisma.group.delete({
      where: { id: groupId },
    })

    // Send notification to all members (excluding owner)
    if (memberIds.length > 0) {
      await prisma.notification.createMany({
        data: memberIds.map((memberId) => ({
          userId: memberId,
          type: 'GROUP_DELETED',
          title: 'Group Deleted',
          message: `${ownerName} has deleted the group "${group.name}"`,
          metadata: {
            groupId: group.id,
            groupName: group.name,
            deletedBy: user.id,
            deletedByName: ownerName,
          },
        })),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
      notifiedMembers: memberIds.length,
    })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete group' },
      { status: 500 }
    )
  }
}
