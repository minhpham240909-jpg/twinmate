/**
 * DUE REVIEWS API
 *
 * GET /api/captures/review/due - Get captures due for review
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { getDueCaptures } from '@/lib/engagement/capture-service'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'captures-due',
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const subject = searchParams.get('subject') || undefined

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Get due captures
    const result = await getDueCaptures(user.id, limit, subject)

    return NextResponse.json({
      success: true,
      captures: result.captures.map((c) => ({
        id: c.id,
        type: c.type,
        content: c.content,
        title: c.title,
        mediaUrl: c.mediaUrl,
        roadmapId: c.roadmapId,
        stepId: c.stepId,
        subject: c.subject,
        tags: c.tags,
        nextReviewAt: c.nextReviewAt?.toISOString(),
        reviewCount: c.reviewCount,
        retentionScore: c.retentionScore,
        createdAt: c.createdAt.toISOString(),
      })),
      total: result.total,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get due captures', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get due captures' },
      { status: 500 }
    )
  }
}
