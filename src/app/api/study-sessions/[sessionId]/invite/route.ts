import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// SECURITY: Validation schema for invite requests
const inviteSchema = z.object({
  inviteUserIds: z.array(z.string().uuid('Invalid user ID format')).min(1, 'At least one user ID required').max(50, 'Cannot invite more than 50 users at once'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()

    // SECURITY: Validate invite user IDs are valid UUIDs
    const validation = inviteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid invite data',
          details: validation.error.format()
        },
        { status: 400 }
      )
    }

    const { inviteUserIds } = validation.data

    // Verify user is the host of the session
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        title: true,
        createdBy: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Only the host can invite partners' },
        { status: 403 }
      )
    }

    // Get inviter info
    const inviter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    })

    // Invite users
    let invitesSent = 0
    for (const inviteeId of inviteUserIds) {
      try {
        // Check if user is already a participant
        const existingParticipant = await prisma.sessionParticipant.findUnique({
          where: {
            sessionId_userId: {
              sessionId,
              userId: inviteeId,
            },
          },
        })

        if (existingParticipant) {
          // Skip if already invited or joined
          continue
        }

        // Create participant invitation
        await prisma.sessionParticipant.create({
          data: {
            sessionId,
            userId: inviteeId,
            role: 'PARTICIPANT',
            status: 'INVITED',
          },
        })

        // Create notification
        await prisma.notification.create({
          data: {
            userId: inviteeId,
            type: 'SESSION_INVITE',
            title: 'Study Session Invite',
            message: `${inviter?.name || 'Someone'} invited you to "${session.title}"`,
            actionUrl: `/study-sessions`,
            relatedUserId: user.id,
          },
        })

        invitesSent++
      } catch (error) {
        console.error('Error inviting user:', error)
      }
    }

    return NextResponse.json({
      success: true,
      invitesSent,
    })
  } catch (error) {
    console.error('Error inviting partners:', error)
    return NextResponse.json(
      { error: 'Failed to invite partners' },
      { status: 500 }
    )
  }
}
