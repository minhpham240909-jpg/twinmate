import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * POST /api/focus/[sessionId]/pause
 * Pause an active focus session (when user navigates away)
 *
 * This allows users to leave the focus page and come back later
 * to continue their session from where they left off.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Find the session - must be active and owned by user
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        pausedAt: true,
        totalPausedMs: true,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Active session not found' },
        { status: 404 }
      )
    }

    // Already paused - return current state
    if (session.pausedAt) {
      return NextResponse.json({
        success: true,
        message: 'Session already paused',
        session: {
          id: session.id,
          pausedAt: session.pausedAt,
          totalPausedMs: session.totalPausedMs,
        },
      })
    }

    // Pause the session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        pausedAt: new Date(),
      },
      select: {
        id: true,
        pausedAt: true,
        totalPausedMs: true,
        startedAt: true,
        durationMinutes: true,
      },
    })

    logger.info('Focus session paused', {
      data: {
        sessionId,
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session paused',
      session: updatedSession,
    })
  } catch (error) {
    logger.error('Error pausing focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/focus/[sessionId]/pause
 * Resume a paused focus session (when user returns)
 *
 * Calculates the pause duration and adds it to totalPausedMs
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Find the session - must be active and owned by user
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        pausedAt: true,
        totalPausedMs: true,
        startedAt: true,
        durationMinutes: true,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Active session not found' },
        { status: 404 }
      )
    }

    // Not paused - return current state
    if (!session.pausedAt) {
      return NextResponse.json({
        success: true,
        message: 'Session not paused',
        session: {
          id: session.id,
          pausedAt: null,
          totalPausedMs: session.totalPausedMs,
          startedAt: session.startedAt,
          durationMinutes: session.durationMinutes,
        },
      })
    }

    // Calculate pause duration
    const pauseDuration = Date.now() - new Date(session.pausedAt).getTime()
    const newTotalPausedMs = session.totalPausedMs + pauseDuration

    // Resume the session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        pausedAt: null,
        totalPausedMs: newTotalPausedMs,
      },
      select: {
        id: true,
        pausedAt: true,
        totalPausedMs: true,
        startedAt: true,
        durationMinutes: true,
      },
    })

    logger.info('Focus session resumed', {
      data: {
        sessionId,
        userId: user.id,
        pauseDurationMs: pauseDuration,
        totalPausedMs: newTotalPausedMs,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session resumed',
      session: updatedSession,
    })
  } catch (error) {
    logger.error('Error resuming focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
