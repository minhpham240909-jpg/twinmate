import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/solo-study/pause - Pause or resume a Solo Study session
 *
 * When pausing: stores the remaining time so it can be restored later
 * When resuming: clears the paused state
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, action, timeRemaining } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    if (!action || !['pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "pause" or "resume"' }, { status: 400 })
    }

    // Verify session belongs to user
    const session = await prisma.focusSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true },
    })

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    if (action === 'pause') {
      // Pause the session - store remaining time
      if (typeof timeRemaining !== 'number' || timeRemaining < 0) {
        return NextResponse.json({ error: 'Valid timeRemaining required for pause' }, { status: 400 })
      }

      await prisma.focusSession.update({
        where: { id: sessionId },
        data: {
          pausedAt: new Date(),
          pausedTimeRemaining: timeRemaining,
        },
      })

      return NextResponse.json({
        success: true,
        action: 'pause',
        pausedTimeRemaining: timeRemaining,
      })
    } else {
      // Resume the session - clear paused state
      await prisma.focusSession.update({
        where: { id: sessionId },
        data: {
          pausedAt: null,
          pausedTimeRemaining: null,
        },
      })

      return NextResponse.json({
        success: true,
        action: 'resume',
      })
    }
  } catch (error) {
    console.error('Pause/resume session error:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
