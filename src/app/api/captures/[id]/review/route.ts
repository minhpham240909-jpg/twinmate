/**
 * CAPTURE REVIEW API
 *
 * POST /api/captures/[id]/review - Record a review response
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { recordReviewResponse } from '@/lib/engagement/capture-service'
import { recordReview as recordReviewProgress } from '@/lib/engagement/daily-commitment-service'

const VALID_RESPONSES = ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const
type ReviewResponse = typeof VALID_RESPONSES[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.moderate,
      keyPrefix: 'capture-review',
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
    const { response } = body

    // Validate response
    if (!response || !VALID_RESPONSES.includes(response)) {
      return NextResponse.json(
        { error: `Invalid response. Must be one of: ${VALID_RESPONSES.join(', ')}` },
        { status: 400 }
      )
    }

    log.info('Recording review response', {
      captureId: id,
      userId: user.id,
      response,
    })

    // Record the review response
    const capture = await recordReviewResponse(id, user.id, response as ReviewResponse)

    if (!capture) {
      return NextResponse.json(
        { error: 'Capture not found' },
        { status: 404 }
      )
    }

    // Record in daily progress (non-blocking)
    recordReviewProgress(user.id).catch((err) => {
      log.warn('Failed to record review in progress', { error: err })
    })

    return NextResponse.json({
      success: true,
      capture: {
        id: capture.id,
        type: capture.type,
        content: capture.content,
        title: capture.title,
        nextReviewAt: capture.nextReviewAt?.toISOString(),
        reviewCount: capture.reviewCount,
        retentionScore: capture.retentionScore,
        easeFactor: capture.easeFactor,
        interval: capture.interval,
      },
      message: 'Review recorded',
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to record review', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to record review' },
      { status: 500 }
    )
  }
}
