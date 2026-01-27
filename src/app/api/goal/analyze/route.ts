/**
 * GOAL ANALYSIS API
 *
 * Analyzes a user's goal and returns:
 * - Whether it's directly learnable
 * - If clarification is needed (with options)
 * - Converted educational goal
 * - Timeline estimates
 *
 * Security:
 * - Rate limited (moderate - 60/min)
 * - Input sanitization
 * - Error handling with logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeGoal, getGoalMessage } from '@/lib/roadmap-engine/goal-analyzer'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

// Maximum goal length to prevent abuse
const MAX_GOAL_LENGTH = 1000

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - moderate for this endpoint
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const body = await request.json()
    const { goal } = body

    // Input validation
    if (!goal || typeof goal !== 'string') {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      )
    }

    const trimmedGoal = goal.trim()

    if (trimmedGoal.length < 3) {
      return NextResponse.json(
        { error: 'Goal is too short. Please provide more detail.' },
        { status: 400 }
      )
    }

    if (trimmedGoal.length > MAX_GOAL_LENGTH) {
      return NextResponse.json(
        { error: `Goal is too long. Maximum ${MAX_GOAL_LENGTH} characters.` },
        { status: 400 }
      )
    }

    // Analyze the goal
    const analysis = await analyzeGoal(trimmedGoal, true)

    // Get friendly message
    const message = getGoalMessage(analysis)

    log.info('Goal analyzed', {
      goalLength: trimmedGoal.length,
      goalType: analysis.goalType,
      needsClarification: analysis.needsClarification,
      confidence: analysis.confidence,
      isNonEducational: analysis.isNonEducational,
      nonEducationalDomain: analysis.nonEducationalDomain,
    })

    return NextResponse.json({
      success: true,
      analysis: {
        originalGoal: analysis.originalGoal,
        goalType: analysis.goalType,
        timelineType: analysis.timelineType,
        estimatedDuration: analysis.estimatedDuration,
        isDirectlyLearnable: analysis.isDirectlyLearnable,
        needsClarification: analysis.needsClarification,
        clarificationOptions: analysis.clarificationOptions,
        suggestedFocus: analysis.suggestedFocus,
        convertedGoal: analysis.convertedGoal,
        phases: analysis.phases,
        confidence: analysis.confidence,
        // Non-educational request handling
        isNonEducational: analysis.isNonEducational,
        nonEducationalDomain: analysis.nonEducationalDomain,
        featureComingSoon: analysis.featureComingSoon,
        educationalAlternatives: analysis.educationalAlternatives,
      },
      message,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })
  } catch (error) {
    log.error('Goal analysis failed', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to analyze goal. Please try again.' },
      { status: 500 }
    )
  }
}
