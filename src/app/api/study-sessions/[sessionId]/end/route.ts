import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Rate limit: 20 requests per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Check if session exists and user is host
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.createdBy !== user.id) {
      return NextResponse.json({ error: 'Only the host can end the session' }, { status: 403 })
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Session already ended' }, { status: 400 })
    }

    if (!session.startedAt) {
      return NextResponse.json({ error: 'Session has not been started yet' }, { status: 400 })
    }

    // Calculate duration
    const endedAt = new Date()
    const startedAt = new Date(session.startedAt)
    const durationMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000)

    // Get session summary data before ending
    const [participants, notes, flashcards, messages] = await Promise.all([
      prisma.sessionParticipant.count({
        where: { sessionId, status: 'JOINED' },
      }),
      prisma.sessionNote.count({
        where: { sessionId },
      }),
      prisma.sessionFlashcard.count({
        where: { sessionId },
      }),
      prisma.sessionMessage.count({
        where: { sessionId },
      }),
    ])

    // Use transaction to ensure all cleanup happens atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update session status
      const updatedSession = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endedAt,
          durationMinutes,
        },
      })

      // 2. Update all participants to LEFT status
      await tx.sessionParticipant.updateMany({
        where: {
          sessionId,
          status: 'JOINED',
        },
        data: {
          status: 'LEFT',
          leftAt: endedAt,
        },
      })

      // 3. Create session summary for analytics (TODO: Add SessionSummary model)
      // Note: SessionSummary model doesn't exist yet - this is a P2 feature
      // When implemented, uncomment this code:
      /*
      await tx.sessionSummary.create({
        data: {
          sessionId,
          durationMinutes,
          participantCount: participants,
          notesCount: notes,
          flashcardsCount: flashcards,
          messagesCount: messages,
          endedBy: user.id,
        },
      })
      */

      // 4. Send completion notifications to participants
      // SCALABILITY: Limit to prevent unbounded notifications
      const sessionParticipants = await tx.sessionParticipant.findMany({
        where: {
          sessionId,
          userId: { not: user.id },
        },
        select: { userId: true },
        take: 100,
      })

      if (sessionParticipants.length > 0) {
        await tx.notification.createMany({
          data: sessionParticipants.map((p: { userId: string }) => ({
            userId: p.userId,
            type: 'SESSION_ENDED',
            title: 'Study Session Ended',
            message: `The study session "${session.title || 'Untitled'}" has ended. Duration: ${durationMinutes} minutes.`,
            actionUrl: `/study-sessions/${sessionId}`,
          })),
        }).catch((err) => {
          // Log but don't fail the transaction
          console.error('Failed to create end notifications:', err)
        })
      }

      return updatedSession
    })

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully',
      session: {
        id: result.id,
        status: result.status,
        endedAt: result.endedAt,
        durationMinutes: result.durationMinutes,
      },
      summary: {
        participants,
        notes,
        flashcards,
        messages,
      },
    })
  } catch (error) {
    console.error('Error ending session:', error)
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    )
  }
}
