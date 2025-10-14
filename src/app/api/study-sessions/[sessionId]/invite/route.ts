import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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
    const { inviteUserIds } = body

    if (!Array.isArray(inviteUserIds) || inviteUserIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: inviteUserIds' },
        { status: 400 }
      )
    }

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
