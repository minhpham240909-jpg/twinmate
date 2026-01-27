/**
 * DAILY COMMITMENT API
 *
 * GET  /api/engagement/commitment - Get user's commitment settings and today's progress
 * POST /api/engagement/commitment - Set/update daily commitment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  getDailyCommitment,
  setDailyCommitment,
  getTodayProgress,
  getWeekProgress,
} from '@/lib/engagement/daily-commitment-service'

// Valid daily minutes options
const VALID_DAILY_MINUTES = [5, 15, 30, 45, 60]

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'commitment-get',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth required
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get commitment and progress in parallel (N+1 prevention)
    const [commitment, todayProgress, weekProgress] = await Promise.all([
      getDailyCommitment(user.id),
      getTodayProgress(user.id),
      getWeekProgress(user.id),
    ])

    return NextResponse.json({
      success: true,
      commitment: commitment
        ? {
            dailyMinutes: commitment.dailyMinutes,
            preferredStartTime: commitment.preferredStartTime,
            preferredEndTime: commitment.preferredEndTime,
            preferredDays: commitment.preferredDays,
            reminderEnabled: commitment.reminderEnabled,
            reminderTime: commitment.reminderTime,
            weekendMode: commitment.weekendMode,
          }
        : null,
      today: {
        targetMinutes: todayProgress.commitment?.dailyMinutes || 15,
        actualMinutes: todayProgress.progress?.actualMinutes || 0,
        percentComplete: todayProgress.percentComplete,
        minutesRemaining: todayProgress.minutesRemaining,
        goalMet: todayProgress.goalMet,
        stepsCompleted: todayProgress.progress?.stepsCompleted || 0,
        capturesCreated: todayProgress.progress?.capturesCreated || 0,
        xpEarned: todayProgress.progress?.xpEarned || 0,
      },
      week: {
        daysCompleted: weekProgress.daysCompleted,
        totalDays: weekProgress.totalDays,
        totalMinutes: weekProgress.totalMinutes,
        days: weekProgress.days.map((d) => ({
          date: d.date.toISOString().split('T')[0],
          goalMet: d.goalMet,
          actualMinutes: d.actualMinutes,
        })),
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get commitment', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get commitment settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.moderate,
      keyPrefix: 'commitment-set',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth required
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      dailyMinutes,
      preferredStartTime,
      preferredEndTime,
      preferredDays,
      reminderEnabled,
      reminderTime,
      weekendMode,
    } = body

    // Validate dailyMinutes
    if (dailyMinutes !== undefined && !VALID_DAILY_MINUTES.includes(dailyMinutes)) {
      return NextResponse.json(
        {
          error: `Daily minutes must be one of: ${VALID_DAILY_MINUTES.join(', ')}`,
          validOptions: VALID_DAILY_MINUTES,
        },
        { status: 400 }
      )
    }

    // Validate weekendMode
    if (weekendMode && !['SAME', 'REDUCED', 'OFF'].includes(weekendMode)) {
      return NextResponse.json(
        { error: 'Weekend mode must be SAME, REDUCED, or OFF' },
        { status: 400 }
      )
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (preferredStartTime && !timeRegex.test(preferredStartTime)) {
      return NextResponse.json(
        { error: 'Invalid start time format. Use HH:MM (e.g., 09:00)' },
        { status: 400 }
      )
    }
    if (preferredEndTime && !timeRegex.test(preferredEndTime)) {
      return NextResponse.json(
        { error: 'Invalid end time format. Use HH:MM (e.g., 21:00)' },
        { status: 400 }
      )
    }
    if (reminderTime && !timeRegex.test(reminderTime)) {
      return NextResponse.json(
        { error: 'Invalid reminder time format. Use HH:MM (e.g., 08:00)' },
        { status: 400 }
      )
    }

    // Validate preferredDays
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    if (preferredDays) {
      if (!Array.isArray(preferredDays)) {
        return NextResponse.json(
          { error: 'Preferred days must be an array' },
          { status: 400 }
        )
      }
      for (const day of preferredDays) {
        if (!validDays.includes(day)) {
          return NextResponse.json(
            { error: `Invalid day: ${day}. Valid days: ${validDays.join(', ')}` },
            { status: 400 }
          )
        }
      }
    }

    log.info('Setting daily commitment', {
      userId: user.id,
      dailyMinutes,
    })

    // Update commitment
    const commitment = await setDailyCommitment(user.id, {
      dailyMinutes: dailyMinutes || 15,
      preferredStartTime,
      preferredEndTime,
      preferredDays,
      reminderEnabled,
      reminderTime,
      weekendMode,
    })

    return NextResponse.json({
      success: true,
      commitment: {
        dailyMinutes: commitment.dailyMinutes,
        preferredStartTime: commitment.preferredStartTime,
        preferredEndTime: commitment.preferredEndTime,
        preferredDays: commitment.preferredDays,
        reminderEnabled: commitment.reminderEnabled,
        reminderTime: commitment.reminderTime,
        weekendMode: commitment.weekendMode,
      },
      message: `Daily goal set to ${commitment.dailyMinutes} minutes`,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to set commitment', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to update commitment settings' },
      { status: 500 }
    )
  }
}
