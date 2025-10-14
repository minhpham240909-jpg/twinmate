import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST - Control timer (start, pause, resume, stop, reset, skip)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()
    const { action } = body // start, pause, resume, stop, reset, skip

    // Check if user is a participant
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Not a participant of this session' },
        { status: 403 }
      )
    }

    // Get current timer
    const currentTimer = await prisma.sessionTimer.findUnique({
      where: { sessionId },
    })

    if (!currentTimer) {
      return NextResponse.json({ error: 'Timer not found' }, { status: 404 })
    }

    let updatedTimer

    switch (action) {
      case 'start':
        // Start the timer (from IDLE or after break)
        updatedTimer = await prisma.sessionTimer.update({
          where: { sessionId },
          data: {
            state: 'RUNNING',
            lastStartedAt: new Date(),
            lastPausedAt: null,
          },
        })
        break

      case 'pause':
        // Pause the timer
        if (currentTimer.state === 'RUNNING') {
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'PAUSED',
              lastPausedAt: new Date(),
            },
          })
        } else if (currentTimer.state === 'BREAK') {
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'BREAK_PAUSED',
              lastPausedAt: new Date(),
            },
          })
        }
        break

      case 'resume':
        // Resume the timer
        if (currentTimer.state === 'PAUSED') {
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'RUNNING',
              lastStartedAt: new Date(),
              lastPausedAt: null,
            },
          })
        } else if (currentTimer.state === 'BREAK_PAUSED') {
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'BREAK',
              lastStartedAt: new Date(),
              lastPausedAt: null,
            },
          })
        }
        break

      case 'stop':
        // Stop and reset to initial state
        updatedTimer = await prisma.sessionTimer.update({
          where: { sessionId },
          data: {
            state: 'IDLE',
            timeRemaining: currentTimer.studyDuration * 60,
            currentCycle: 1,
            isBreakTime: false,
            lastStartedAt: null,
            lastPausedAt: null,
          },
        })
        break

      case 'reset':
        // Reset current timer to beginning
        updatedTimer = await prisma.sessionTimer.update({
          where: { sessionId },
          data: {
            state: 'IDLE',
            timeRemaining: currentTimer.isBreakTime
              ? currentTimer.breakDuration * 60
              : currentTimer.studyDuration * 60,
            lastStartedAt: null,
            lastPausedAt: null,
          },
        })
        break

      case 'skip':
        // Skip break and start new study session
        if (currentTimer.isBreakTime) {
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'IDLE',
              isBreakTime: false,
              timeRemaining: currentTimer.studyDuration * 60,
              currentCycle: currentTimer.currentCycle + 1,
              lastStartedAt: null,
              lastPausedAt: null,
            },
          })
        } else {
          return NextResponse.json(
            { error: 'Can only skip during break time' },
            { status: 400 }
          )
        }
        break

      case 'start_break':
        // Start break after study session ends
        updatedTimer = await prisma.sessionTimer.update({
          where: { sessionId },
          data: {
            state: 'BREAK',
            isBreakTime: true,
            timeRemaining: currentTimer.breakDuration * 60,
            lastStartedAt: new Date(),
            lastPausedAt: null,
            totalStudyTime:
              currentTimer.totalStudyTime + currentTimer.studyDuration * 60,
          },
        })
        break

      case 'end_break':
        // End break and prepare for next study session
        const { sameSettings } = body

        if (sameSettings) {
          // Use same settings for next cycle
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'IDLE',
              isBreakTime: false,
              timeRemaining: currentTimer.studyDuration * 60,
              currentCycle: currentTimer.currentCycle + 1,
              lastStartedAt: null,
              lastPausedAt: null,
              totalBreakTime:
                currentTimer.totalBreakTime + currentTimer.breakDuration * 60,
            },
          })
        } else {
          // Reset for new custom settings
          updatedTimer = await prisma.sessionTimer.update({
            where: { sessionId },
            data: {
              state: 'IDLE',
              isBreakTime: false,
              currentCycle: currentTimer.currentCycle + 1,
              lastStartedAt: null,
              lastPausedAt: null,
              totalBreakTime:
                currentTimer.totalBreakTime + currentTimer.breakDuration * 60,
            },
          })
        }
        break

      case 'update_time':
        // Update remaining time (called by client countdown)
        const { timeRemaining } = body
        updatedTimer = await prisma.sessionTimer.update({
          where: { sessionId },
          data: {
            timeRemaining,
            lastStartedAt: new Date(), // Reset the start time to current time
          },
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      timer: updatedTimer,
    })
  } catch (error) {
    console.error('Error controlling timer:', error)
    return NextResponse.json(
      { error: 'Failed to control timer' },
      { status: 500 }
    )
  }
}
