import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const respondSchema = z.object({
  inviteId: z.string(),
  action: z.enum(['accept', 'decline']),
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
    const validation = respondSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { inviteId, action } = validation.data

    // Find the invite
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: {
        group: true,
      },
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    // Verify user is the invitee
    if (invite.inviteeId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Check if already responded
    if (invite.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invite already responded to' },
        { status: 400 }
      )
    }

    if (action === 'accept') {
      // Check if group is full
      const memberCount = await prisma.groupMember.count({
        where: { groupId: invite.groupId },
      })

      if (memberCount >= invite.group.maxMembers) {
        return NextResponse.json(
          { error: 'Group is full' },
          { status: 400 }
        )
      }

      // Add user to group
      await prisma.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId: user.id,
          role: 'MEMBER',
        },
      })

      // Update invite status
      await prisma.groupInvite.update({
        where: { id: inviteId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      })

      // Create notification for group owner
      await prisma.notification.create({
        data: {
          userId: invite.group.ownerId,
          type: 'MATCH_ACCEPTED',
          title: 'Invite Accepted',
          message: `Someone accepted your invite to join "${invite.group.name}"`,
          actionUrl: `/groups/${invite.groupId}`,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Invite accepted',
        groupId: invite.groupId,
      })
    } else {
      // Decline invite
      await prisma.groupInvite.update({
        where: { id: inviteId },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Invite declined',
      })
    }
  } catch (error) {
    console.error('Invite response error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
