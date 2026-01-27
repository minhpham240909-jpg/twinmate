/**
 * DAILY PROGRESS API
 *
 * GET  /api/engagement/progress - Get today's progress
 * POST /api/engagement/progress - Record learning activity
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  getTodayProgress,
  recordLearningTime,
  recordCapture,
  recordReview,
  getMonthProgress,
} from '@/lib/engagement/daily-commitment-service'
import { updateStreak } from '@/lib/engagement/streak-service'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'progress-get',
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

    // Check if requesting month data
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    // Return month progress if requested
    if (type === 'month' && year && month) {
      const yearNum = parseInt(year, 10)
      const monthNum = parseInt(month, 10)

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return NextResponse.json(
          { error: 'Invalid year or month' },
          { status: 400 }
        )
      }

      const monthData = await getMonthProgress(user.id, yearNum, monthNum)

      return NextResponse.json({
        success: true,
        monthProgress: monthData.map(day => ({
          date: day.date.toISOString().split('T')[0],
          targetMinutes: day.targetMinutes,
          actualMinutes: day.actualMinutes,
          goalMet: day.goalMet,
          stepsCompleted: day.stepsCompleted,
          capturesCreated: day.capturesCreated,
        })),
      }, {
        headers: {
          'x-correlation-id': correlationId,
          ...rateLimitResult.headers,
        },
      })
    }

    // Default: return today's progress
    const todayProgress = await getTodayProgress(user.id)

    return NextResponse.json({
      success: true,
      progress: {
        targetMinutes: todayProgress.commitment?.dailyMinutes || 15,
        actualMinutes: todayProgress.progress?.actualMinutes || 0,
        percentComplete: todayProgress.percentComplete,
        minutesRemaining: todayProgress.minutesRemaining,
        goalMet: todayProgress.goalMet,
        stepsCompleted: todayProgress.progress?.stepsCompleted || 0,
        capturesCreated: todayProgress.progress?.capturesCreated || 0,
        reviewsCompleted: todayProgress.progress?.reviewsCompleted || 0,
        xpEarned: (todayProgress.progress?.xpEarned || 0) + (todayProgress.progress?.bonusXp || 0),
        firstActivityAt: todayProgress.progress?.firstActivityAt,
        lastActivityAt: todayProgress.progress?.lastActivityAt,
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get progress', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - moderate since this tracks activity
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.moderate,
      keyPrefix: 'progress-record',
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
      type, // 'learning' | 'capture' | 'review'
      minutes,
      roadmapId,
      stepId,
      stepCompleted,
      xpEarned,
    } = body

    // Validate type
    if (!type || !['learning', 'capture', 'review'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be one of: learning, capture, review' },
        { status: 400 }
      )
    }

    // Validate minutes for learning
    if (type === 'learning') {
      if (typeof minutes !== 'number' || minutes < 0 || minutes > 480) {
        return NextResponse.json(
          { error: 'Minutes must be a number between 0 and 480' },
          { status: 400 }
        )
      }
    }

    log.info('Recording progress', {
      userId: user.id,
      type,
      minutes,
    })

    let result: { goalJustMet: boolean } = { goalJustMet: false }

    // Record based on type
    switch (type) {
      case 'learning':
        const learningResult = await recordLearningTime(user.id, minutes, {
          roadmapId,
          stepCompleted,
          xpEarned,
        })
        result = { goalJustMet: learningResult.goalJustMet }
        break

      case 'capture':
        await recordCapture(user.id)
        break

      case 'review':
        await recordReview(user.id)
        break
    }

    // Update streak if goal was just met
    if (result.goalJustMet) {
      try {
        await updateStreak(user.id, true)
      } catch (streakError) {
        log.warn('Failed to update streak', { error: streakError })
        // Don't fail the request if streak update fails
      }
    }

    // Get updated progress
    const todayProgress = await getTodayProgress(user.id)

    return NextResponse.json({
      success: true,
      goalJustMet: result.goalJustMet,
      progress: {
        targetMinutes: todayProgress.commitment?.dailyMinutes || 15,
        actualMinutes: todayProgress.progress?.actualMinutes || 0,
        percentComplete: todayProgress.percentComplete,
        minutesRemaining: todayProgress.minutesRemaining,
        goalMet: todayProgress.goalMet,
        stepsCompleted: todayProgress.progress?.stepsCompleted || 0,
        capturesCreated: todayProgress.progress?.capturesCreated || 0,
        reviewsCompleted: todayProgress.progress?.reviewsCompleted || 0,
        xpEarned: (todayProgress.progress?.xpEarned || 0) + (todayProgress.progress?.bonusXp || 0),
      },
      message: result.goalJustMet
        ? 'Daily goal achieved!'
        : `Recorded ${type === 'learning' ? `${minutes} minutes of learning` : type}`,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to record progress', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to record progress' },
      { status: 500 }
    )
  }
}
