/**
 * ENHANCE PROMPT API
 *
 * POST /api/roadmap/enhance - Enhance user goal for better roadmap generation
 *
 * This endpoint:
 * 1. Takes user's raw goal input
 * 2. Enhances it with structure and context
 * 3. Returns enhanced prompt for user review
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enhancePrompt, validateGoal } from '@/lib/roadmap-engine/prompt-enhancer'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface EnhanceRequest {
  goal: string
  mode?: 'quick' | 'thorough'
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Auth check (optional - allow guests with stricter rate limit)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Rate limiting - stricter for guests
    const preset = user ? RateLimitPresets.moderate : RateLimitPresets.strict
    const rateLimitResult = await rateLimit(request, preset)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    const body: EnhanceRequest = await request.json()

    if (!body.goal || typeof body.goal !== 'string') {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      )
    }

    // Validate the goal first
    const validation = validateGoal(body.goal)

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Goal too vague',
        issues: validation.issues,
        score: validation.score,
      }, { status: 400 })
    }

    // Enhance the prompt
    const startTime = Date.now()
    const result = await enhancePrompt(body.goal, {
      mode: body.mode || 'quick',
      useAI: true,
    })

    log.info('Prompt enhanced', {
      userId: user?.id || 'guest',
      originalLength: body.goal.length,
      enhancedLength: result.enhanced.length,
      confidence: result.confidence,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      original: result.original,
      enhanced: result.enhanced,
      context: result.context,
      confidence: result.confidence,
      suggestions: result.suggestions,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        'Cache-Control': 'no-store',
      },
    })

  } catch (error) {
    log.error('Failed to enhance prompt', error instanceof Error ? error : { error })

    // Return a graceful fallback
    return NextResponse.json({
      success: false,
      error: 'Enhancement failed. Please try again or use your original goal.',
      fallback: true,
    }, { status: 500 })
  }
}
