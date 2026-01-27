/**
 * PUBLIC SHARED ROADMAP API
 *
 * GET  /api/shared/[slug] - Get a shared roadmap by slug (public)
 * POST /api/shared/[slug]/copy - Copy a shared roadmap to user's account
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { getSharedRoadmap } from '@/lib/sharing/share-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting (more lenient for public access)
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'shared-view',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Get shared roadmap (increments view count)
    const shared = await getSharedRoadmap(slug)

    if (!shared) {
      return NextResponse.json(
        { error: 'Shared roadmap not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      shared: {
        id: shared.id,
        shareCode: shared.shareCode,
        title: shared.title,
        goal: shared.goal,
        overview: shared.overview,
        subject: shared.subject,
        totalSteps: shared.totalSteps,
        estimatedMinutes: shared.estimatedMinutes,
        completedAt: shared.completedAt?.toISOString(),
        viewCount: shared.viewCount,
        copyCount: shared.copyCount,
        allowCopy: shared.allowCopy,
        createdAt: shared.createdAt.toISOString(),
        roadmap: {
          pitfalls: shared.roadmap.pitfalls,
          successLooksLike: shared.roadmap.successLooksLike,
          steps: shared.roadmap.steps.map((step) => ({
            order: step.order,
            title: step.title,
            description: step.description,
            timeframe: step.timeframe,
            method: step.method,
            avoid: step.avoid,
            doneWhen: step.doneWhen,
            duration: step.duration,
          })),
        },
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get shared roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get shared roadmap' },
      { status: 500 }
    )
  }
}
