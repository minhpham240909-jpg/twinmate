import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { notifySessionParticipants } from '@/lib/notifications'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Check if session exists
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { status: 'JOINED' },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Atomically check capacity and add participant to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Re-check capacity inside transaction
      const currentParticipantCount = await tx.sessionParticipant.count({
        where: { sessionId, status: 'JOINED' },
      })

      if (currentParticipantCount >= session.maxParticipants) {
        throw new Error('SESSION_FULL')
      }

      // Check if already a participant
      const existing = await tx.sessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      })

      if (existing && existing.status === 'JOINED') {
        // Already joined - return early
        throw new Error('ALREADY_JOINED')
      }

      // Update or create participant
      if (existing) {
        // Preserve original joinedAt timestamp if it exists
        await tx.sessionParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'JOINED',
            joinedAt: existing.joinedAt ?? new Date(), // Preserve original or set new
          },
        })
      } else {
        await tx.sessionParticipant.create({
          data: {
            sessionId,
            userId: user.id,
            role: 'PARTICIPANT',
            status: 'JOINED',
            joinedAt: new Date(),
          },
        })
      }
    }).catch((txError: Error) => {
      if (txError.message === 'SESSION_FULL') {
        return NextResponse.json({ error: 'Session is full' }, { status: 400 })
      }
      if (txError.message === 'ALREADY_JOINED') {
        return NextResponse.json({
          success: true,
          message: 'Already joined',
          session: {
            id: session.id,
            agoraChannel: session.agoraChannel,
          },
        })
      }
      throw txError // Re-throw other errors
    })

    // Get user info for notification
    const joiningUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    })

    // Notify host and other participants
    await notifySessionParticipants(
      sessionId,
      'SESSION_JOINED',
      'New Participant',
      `${joiningUser?.name || 'Someone'} joined ${session.title}`,
      user.id
    )

    return NextResponse.json({
      success: true,
      message: 'Joined session successfully',
      session: {
        id: session.id,
        title: session.title,
        agoraChannel: session.agoraChannel,
        status: session.status,
      },
    })
  } catch (error) {
    console.error('Error joining session:', error)
    return NextResponse.json(
      { error: 'Failed to join session' },
      { status: 500 }
    )
  }
}
