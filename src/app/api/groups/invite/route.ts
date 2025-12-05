import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { enforceUserAccess } from '@/lib/security/checkUserBan'

const inviteSchema = z.object({
  groupId: z.string(),
  username: z.string(),
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
    const validation = inviteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId, username } = validation.data

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

    // Verify user is the group owner or admin
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: user.id,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Only group owner or admin can invite members' },
        { status: 403 }
      )
    }

    // Find the user to invite
    const invitedUser = await prisma.user.findFirst({
      where: {
        name: username,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!invitedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: invitedUser.id,
      },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 400 }
      )
    }

    // Check if there's already a pending invite
    const existingInvite = await prisma.groupInvite.findFirst({
      where: {
        groupId: groupId,
        inviteeId: invitedUser.id,
        status: 'PENDING',
      },
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: 'User already has a pending invite' },
        { status: 400 }
      )
    }

    // Create group invite
    await prisma.groupInvite.create({
      data: {
        groupId: groupId,
        inviterId: user.id,
        inviteeId: invitedUser.id,
        status: 'PENDING',
      },
    })

    // Create notification for invited user
    await prisma.notification.create({
      data: {
        userId: invitedUser.id,
        type: 'GROUP_INVITE',
        title: 'Group Invitation',
        message: `You've been invited to join "${group.name}"`,
        actionUrl: `/groups/${group.id}`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully invited ${username} to the group`,
    })
  } catch (error) {
    console.error('Invite user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
