import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * POST /api/focus/[sessionId]/pause
 * Pause an active focus session (when user navigates away)
 *
 * NOTE: Pause/resume functionality requires database migration.
 * This endpoint will silently succeed if migration not applied yet.
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

    // Return success - pause tracking will be added when migration is applied
    logger.info('Focus session pause requested', {
      data: {
        sessionId,
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session pause acknowledged',
      session: {
        id: session.id,
        startedAt: session.startedAt,
        durationMinutes: session.durationMinutes,
      },
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
 * NOTE: Pause/resume functionality requires database migration.
 * This endpoint will silently succeed if migration not applied yet.
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

    // Return success - resume tracking will be added when migration is applied
    logger.info('Focus session resume requested', {
      data: {
        sessionId,
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session resume acknowledged',
      session: {
        id: session.id,
        startedAt: session.startedAt,
        durationMinutes: session.durationMinutes,
        totalPausedMs: 0,
      },
    })
  } catch (error) {
    logger.error('Error resuming focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
