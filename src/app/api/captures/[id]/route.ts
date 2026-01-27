/**
 * SINGLE CAPTURE API
 *
 * GET    /api/captures/[id] - Get a single capture
 * PATCH  /api/captures/[id] - Update a capture
 * DELETE /api/captures/[id] - Delete a capture
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  getCaptureById,
  updateCapture,
  deleteCapture,
} from '@/lib/engagement/capture-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'capture-get',
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

    const capture = await getCaptureById(id, user.id)

    if (!capture) {
      return NextResponse.json(
        { error: 'Capture not found' },
        { status: 404 }
      )
    }

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
        isArchived: capture.isArchived,
        nextReviewAt: capture.nextReviewAt?.toISOString(),
        reviewCount: capture.reviewCount,
        retentionScore: capture.retentionScore,
        createdAt: capture.createdAt.toISOString(),
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get capture', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get capture' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
      keyPrefix: 'capture-update',
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
      content,
      title,
      tags,
      isFavorite,
      isArchived,
    } = body

    // Validate content if provided
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
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
    }

    // Validate tags if provided
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((t: unknown) => typeof t !== 'string'))) {
      return NextResponse.json(
        { error: 'Tags must be an array of strings' },
        { status: 400 }
      )
    }

    const capture = await updateCapture(id, user.id, {
      content: content?.trim(),
      title: title?.trim(),
      tags,
      isFavorite,
      isArchived,
    })

    if (!capture) {
      return NextResponse.json(
        { error: 'Capture not found' },
        { status: 404 }
      )
    }

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
        isArchived: capture.isArchived,
        nextReviewAt: capture.nextReviewAt?.toISOString(),
        reviewCount: capture.reviewCount,
        retentionScore: capture.retentionScore,
        createdAt: capture.createdAt.toISOString(),
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to update capture', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to update capture' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      keyPrefix: 'capture-delete',
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

    const deleted = await deleteCapture(id, user.id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Capture not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Capture deleted',
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to delete capture', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to delete capture' },
      { status: 500 }
    )
  }
}
