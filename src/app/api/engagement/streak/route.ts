/**
 * STREAK API
 *
 * GET  /api/engagement/streak - Get user's streak data
 * POST /api/engagement/streak/freeze - Use a streak freeze
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  getOrCreateStreak,
  checkStreakAtRisk,
} from '@/lib/engagement/streak-service'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'streak-get',
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

    // Get streak data and risk status in parallel
    const [streak, riskStatus] = await Promise.all([
      getOrCreateStreak(user.id),
      checkStreakAtRisk(user.id),
    ])

    return NextResponse.json({
      success: true,
      streak: {
        current: streak.currentStreak,
        longest: streak.longestStreak,
        currentStart: streak.currentStreakStart?.toISOString().split('T')[0] || null,
        lastCompleted: streak.lastCompletedDate?.toISOString().split('T')[0] || null,
      },
      thisWeek: {
        daysCompleted: streak.thisWeekDays,
        minutesLearned: streak.thisWeekMinutes,
      },
      thisMonth: {
        daysCompleted: streak.thisMonthDays,
        minutesLearned: streak.thisMonthMinutes,
      },
      allTime: {
        daysCompleted: streak.totalDaysCompleted,
        minutesLearned: streak.totalMinutesLearned,
        xpEarned: streak.totalXpEarned,
      },
      freezes: {
        available: streak.freezesAvailable,
      },
      atRisk: riskStatus.atRisk,
      hoursRemaining: riskStatus.hoursRemaining,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get streak', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get streak data' },
      { status: 500 }
    )
  }
}
