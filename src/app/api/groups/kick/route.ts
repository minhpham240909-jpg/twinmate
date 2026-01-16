import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const kickSchema = z.object({
  groupId: z.string(),
  userId: z.string(),
})

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

    // Parse and validate request body
    const body = await request.json()
    const validation = kickSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId, userId } = validation.data

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Verify user is the group owner
    if (group.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only group owner can kick members' },
        { status: 403 }
      )
    }

    // Cannot kick yourself
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'You cannot kick yourself' },
        { status: 400 }
      )
    }

    // Check if target user is a member
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: userId,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'User is not a member of this group' },
        { status: 400 }
      )
    }

    // Remove user from group
    await prisma.groupMember.delete({
      where: {
        id: membership.id,
      },
    })

    // Send notification to removed user - reframed positively
    // ✅ Inspire action: Encourage finding other groups
    // ❌ Never shame: Don't use harsh "kicked" language
    await prisma.notification.create({
      data: {
        userId: userId,
        type: 'GROUP_REMOVED',
        title: 'Group Membership Update',
        message: `Your membership in "${group.name}" has ended. Explore other study groups that match your interests!`,
        actionUrl: '/groups',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User removed from group',
    })
  } catch (error) {
    console.error('Kick member error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
