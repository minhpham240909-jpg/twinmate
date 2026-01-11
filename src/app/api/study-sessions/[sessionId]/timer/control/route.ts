import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// Maximum retry attempts for optimistic locking
const MAX_RETRY_ATTEMPTS = 3

// POST - Control timer (start, pause, resume, stop, reset, skip)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  
  // SECURITY: Session-specific rate limiting to prevent timer control abuse
  // Strict limit: 5 timer actions per minute per session
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.strict,
    keyPrefix: `timer-control-${sessionId}` // Per-session rate limit
  })
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many timer actions. Please wait before controlling the timer again.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, expectedVersion } = body // start, pause, resume, stop, reset, skip + version for optimistic lock

    // SECURITY: Any JOINED participant can control the timer (pause/resume/reset/stop)
    // This allows collaborative timer control for all participants in the session
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED', // Must be actively joined (not just invited)
      },
      select: {
        role: true,
        status: true,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Not a joined participant of this session' },
        { status: 403 }
      )
    }

    // Log timer control action for debugging
    console.log(
      `[Timer Control] User ${user.id} (role: ${participant.role}) controlling timer in session ${sessionId}`
    )

    // Use transaction with optimistic locking to prevent race conditions
    let retryCount = 0
    let updatedTimer = null

    while (retryCount < MAX_RETRY_ATTEMPTS) {
      try {
        // Execute timer operation within a transaction
        updatedTimer = await prisma.$transaction(async (tx) => {
          // Get current timer with lock
          const currentTimer = await tx.sessionTimer.findUnique({
            where: { sessionId },
          })

          if (!currentTimer) {
            throw new Error('TIMER_NOT_FOUND')
          }

          // Optimistic lock check: if client provides expectedVersion (updatedAt),
          // verify it matches to detect concurrent modifications
          if (expectedVersion) {
            const expectedTime = new Date(expectedVersion).getTime()
            const currentTime = currentTimer.updatedAt.getTime()
            if (Math.abs(expectedTime - currentTime) > 1000) { // 1 second tolerance
              throw new Error('TIMER_VERSION_CONFLICT')
            }
          }

          // Validate state transitions to prevent invalid operations
          const validTransitions: Record<string, string[]> = {
            'IDLE': ['start'],
            'RUNNING': ['pause', 'stop', 'reset'],
            'PAUSED': ['resume', 'stop', 'reset'],
            'BREAK': ['pause', 'stop', 'skip', 'end_break'],
            'BREAK_PAUSED': ['resume', 'stop'],
          }

          const allowedActions = validTransitions[currentTimer.state] || []
          // Allow start_break and update_time from any state that makes sense
          const extendedAllowedActions = [...allowedActions]
          if (currentTimer.state === 'RUNNING' || currentTimer.state === 'IDLE') {
            extendedAllowedActions.push('start_break')
          }
          if (currentTimer.state !== 'IDLE') {
            extendedAllowedActions.push('update_time')
          }

          if (!extendedAllowedActions.includes(action)) {
            throw new Error(`INVALID_STATE_TRANSITION:${currentTimer.state}:${action}`)
          }

          // Execute the action with the transaction
          return await executeTimerAction(tx, sessionId, currentTimer, action, body)
        }, {
          isolationLevel: 'Serializable', // Highest isolation to prevent race conditions
          maxWait: 5000, // 5s max wait for transaction slot
          timeout: 10000, // 10s timeout for the transaction
        })

        // Success - break out of retry loop
        break
      } catch (txError) {
        const errorMessage = txError instanceof Error ? txError.message : String(txError)
        
        if (errorMessage === 'TIMER_NOT_FOUND') {
          return NextResponse.json({ error: 'Timer not found' }, { status: 404 })
        }
        
        if (errorMessage === 'TIMER_VERSION_CONFLICT') {
          return NextResponse.json(
            { 
              error: 'Timer was modified by another participant. Please refresh and try again.',
              code: 'VERSION_CONFLICT'
            }, 
            { status: 409 }
          )
        }

        if (errorMessage.startsWith('INVALID_STATE_TRANSITION')) {
          const [, currentState, attemptedAction] = errorMessage.split(':')
          return NextResponse.json(
            { 
              error: `Cannot ${attemptedAction} timer while in ${currentState} state`,
              code: 'INVALID_STATE_TRANSITION',
              currentState
            }, 
            { status: 400 }
          )
        }

        // For serialization failures, retry
        if (errorMessage.includes('could not serialize') || 
            errorMessage.includes('deadlock') ||
            errorMessage.includes('concurrent')) {
          retryCount++
          if (retryCount >= MAX_RETRY_ATTEMPTS) {
            console.error(`[Timer Control] Max retries exceeded for session ${sessionId}`)
            return NextResponse.json(
              { error: 'Timer operation failed due to concurrent access. Please try again.' },
              { status: 503 }
            )
          }
          // Small exponential backoff before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 50))
          continue
        }

        // Re-throw other errors
        throw txError
      }
    }

    return NextResponse.json({
      success: true,
      timer: updatedTimer,
      version: updatedTimer?.updatedAt?.toISOString(), // Return version for client's next request
    })

  } catch (error) {
    console.error('Error controlling timer:', error)
    return NextResponse.json(
      { error: 'Failed to control timer' },
      { status: 500 }
    )
  }
}

// Helper function to execute timer actions within transaction
async function executeTimerAction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sessionId: string,
  currentTimer: {
    state: string
    studyDuration: number
    breakDuration: number
    timeRemaining: number
    currentCycle: number
    isBreakTime: boolean
    lastStartedAt: Date | null
    totalStudyTime: number
    totalBreakTime: number
  },
  action: string,
  body: { sameSettings?: boolean; timeRemaining?: number }
) {
  switch (action) {
    case 'start':
      // Start the timer (from IDLE or after break)
      return await tx.sessionTimer.update({
        where: { sessionId },
        data: {
          state: 'RUNNING',
          lastStartedAt: new Date(),
          lastPausedAt: null,
        },
      })

    case 'pause': {
      // Pause the timer and calculate actual remaining time
      // Calculate how much time has elapsed since lastStartedAt
      const now = new Date()
      const elapsedSeconds = currentTimer.lastStartedAt
        ? Math.floor((now.getTime() - new Date(currentTimer.lastStartedAt).getTime()) / 1000)
        : 0

      // Calculate actual time remaining
      const actualTimeRemaining = Math.max(0, currentTimer.timeRemaining - elapsedSeconds)

      return await tx.sessionTimer.update({
        where: { sessionId },
        data: {
          state: currentTimer.state === 'RUNNING' ? 'PAUSED' : 'BREAK_PAUSED',
          timeRemaining: actualTimeRemaining, // Save the actual remaining time
          lastPausedAt: new Date(),
        },
      })
    }

    case 'resume':
      // Resume the timer from where it was paused
      if (currentTimer.state === 'PAUSED') {
        return await tx.sessionTimer.update({
          where: { sessionId },
          data: {
            state: 'RUNNING',
            lastStartedAt: new Date(), // Reset start time to now
            lastPausedAt: null,
            // timeRemaining stays the same (it was already saved during pause)
          },
        })
      } else if (currentTimer.state === 'BREAK_PAUSED') {
        return await tx.sessionTimer.update({
          where: { sessionId },
          data: {
            state: 'BREAK',
            lastStartedAt: new Date(), // Reset start time to now
            lastPausedAt: null,
            // timeRemaining stays the same (it was already saved during pause)
          },
        })
      }
      throw new Error('INVALID_STATE_TRANSITION:' + currentTimer.state + ':resume')

    case 'stop':
      // Stop and reset to initial state
      return await tx.sessionTimer.update({
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

    case 'reset':
      // Reset current timer to beginning
      return await tx.sessionTimer.update({
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

    case 'skip':
      // Skip break and start new study session
      if (currentTimer.isBreakTime) {
        return await tx.sessionTimer.update({
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
      }
      throw new Error('INVALID_STATE_TRANSITION:' + currentTimer.state + ':skip')

    case 'start_break':
      // Start break after study session ends
      return await tx.sessionTimer.update({
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

    case 'end_break': {
      // End break and prepare for next study session
      const { sameSettings } = body

      if (sameSettings) {
        // Use same settings for next cycle
        return await tx.sessionTimer.update({
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
        return await tx.sessionTimer.update({
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
    }

    case 'update_time': {
      // Update remaining time (called by client countdown)
      const { timeRemaining } = body
      return await tx.sessionTimer.update({
        where: { sessionId },
        data: {
          timeRemaining,
          lastStartedAt: new Date(), // Reset the start time to current time
        },
      })
    }

    default:
      throw new Error('INVALID_ACTION:' + action)
  }
}
