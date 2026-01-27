/**
 * LEARNING CAPTURES API
 *
 * GET  /api/captures - Get user's captures
 * POST /api/captures - Create a new capture
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  createCapture,
  getUserCaptures,
  getCaptureStats,
} from '@/lib/engagement/capture-service'
import { recordCapture } from '@/lib/engagement/daily-commitment-service'
import { CaptureType } from '@prisma/client'

// Valid capture types
const VALID_TYPES: CaptureType[] = ['NOTE', 'PHOTO', 'LINK', 'HIGHLIGHT', 'VOICE']

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'captures-get',
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
    const roadmapId = searchParams.get('roadmapId') || undefined
    const stepId = searchParams.get('stepId') || undefined
    const subject = searchParams.get('subject') || undefined
    const type = searchParams.get('type') as CaptureType | undefined
    const isFavorite = searchParams.get('isFavorite') === 'true' ? true : undefined
    const isArchived = searchParams.get('isArchived') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const orderBy = (searchParams.get('orderBy') || 'newest') as 'newest' | 'oldest' | 'nextReview'
    const includeStats = searchParams.get('includeStats') === 'true'

    // Validate type
    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Get captures and optionally stats in parallel
    const [capturesResult, stats] = await Promise.all([
      getUserCaptures(user.id, {
        filters: {
          roadmapId,
          stepId,
          subject,
          type,
          isFavorite,
          isArchived,
        },
        limit,
        offset,
        orderBy,
      }),
      includeStats ? getCaptureStats(user.id) : null,
    ])

    return NextResponse.json({
      success: true,
      captures: capturesResult.captures.map((c) => ({
        id: c.id,
        type: c.type,
        content: c.content,
        title: c.title,
        mediaUrl: c.mediaUrl,
        roadmapId: c.roadmapId,
        stepId: c.stepId,
        subject: c.subject,
        tags: c.tags,
        isFavorite: c.isFavorite,
        nextReviewAt: c.nextReviewAt?.toISOString(),
        reviewCount: c.reviewCount,
        retentionScore: c.retentionScore,
        createdAt: c.createdAt.toISOString(),
      })),
      total: capturesResult.total,
      hasMore: offset + capturesResult.captures.length < capturesResult.total,
      stats: stats
        ? {
            total: stats.totalCaptures,
            dueForReview: stats.dueForReview,
            averageRetention: Math.round(stats.averageRetention * 100),
            bySubject: stats.bySubject,
          }
        : undefined,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get captures', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get captures' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - moderate for creation
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.moderate,
      keyPrefix: 'captures-create',
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
      type = 'NOTE',
      content,
      title,
      mediaUrl,
      mediaType,
      roadmapId,
      stepId,
      subject,
      tags,
    } = body

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content cannot be empty' },
        { status: 400 }
      )
    }

    if (content.length > 10000) {
      return NextResponse.json(
        { error: 'Content must be less than 10000 characters' },
        { status: 400 }
      )
    }

    // Validate type
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate tags
    if (tags && (!Array.isArray(tags) || tags.some((t: unknown) => typeof t !== 'string'))) {
      return NextResponse.json(
        { error: 'Tags must be an array of strings' },
        { status: 400 }
      )
    }

    log.info('Creating capture', {
      userId: user.id,
      type,
      hasRoadmap: !!roadmapId,
      hasStep: !!stepId,
    })

    // Create capture
    const capture = await createCapture(user.id, {
      type,
      content,
      title,
      mediaUrl,
      mediaType,
      roadmapId,
      stepId,
      subject,
      tags,
    })

    // Record in daily progress (non-blocking)
    recordCapture(user.id).catch((err) => {
      log.warn('Failed to record capture in progress', { error: err })
    })

    return NextResponse.json({
      success: true,
      capture: {
        id: capture.id,
        type: capture.type,
        content: capture.content,
        title: capture.title,
        mediaUrl: capture.mediaUrl,
        roadmapId: capture.roadmapId,
        stepId: capture.stepId,
        subject: capture.subject,
        tags: capture.tags,
        isFavorite: capture.isFavorite,
        nextReviewAt: capture.nextReviewAt?.toISOString(),
        createdAt: capture.createdAt.toISOString(),
      },
      message: 'Capture saved successfully',
    }, {
      status: 201,
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to create capture', error instanceof Error ? error : { error })

    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create capture' },
      { status: 500 }
    )
  }
}
