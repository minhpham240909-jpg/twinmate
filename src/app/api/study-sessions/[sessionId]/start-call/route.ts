import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
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

    // Get session
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Only the creator can start the session
    if (session.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Only the session creator can start the call' },
        { status: 403 }
      )
    }

    // Check if session is in WAITING status
    if (session.status !== 'WAITING') {
      return NextResponse.json(
        { error: `Cannot start session in ${session.status} status` },
        { status: 400 }
      )
    }

    // Check if waiting lobby has expired
    if (session.waitingExpiresAt && new Date() > session.waitingExpiresAt) {
      // Auto-delete expired session
      await prisma.studySession.delete({
        where: { id: sessionId },
      })

      return NextResponse.json(
        { error: 'Session has expired and been deleted' },
        { status: 410 } // 410 Gone
      )
    }

    // Update session to ACTIVE and set startedAt
    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    })

    // Notify all invited participants that session has started
    const invitedParticipants = updatedSession.participants.filter(
      (p) => p.status === 'INVITED' && p.userId !== user.id
    )

    // Use batch insert instead of loop to avoid N+1 queries
    if (invitedParticipants.length > 0) {
      try {
        await prisma.notification.createMany({
          data: invitedParticipants.map((participant) => ({
            userId: participant.userId,
            type: 'SESSION_STARTED',
            title: '🚀 Study Session is Live!',
            message: `"${session.title}" just started! Your study partners are waiting for you.`,
            actionUrl: `/study-sessions/${sessionId}/call`,
            relatedUserId: user.id,
          })),
        })
      } catch (error) {
        console.error('Error creating notifications:', error)
      }
    }

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        startedAt: updatedSession.startedAt,
      },
    })
  } catch (error) {
    console.error('Error starting session:', error)
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    )
  }
}
