/**
 * SHARING API
 *
 * POST /api/share - Share a completed roadmap
 * GET  /api/share - Get user's shared roadmaps
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  shareRoadmap,
  getUserSharedRoadmaps,
} from '@/lib/sharing/share-service'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'share-list',
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

    // Get user's shared roadmaps
    const shared = await getUserSharedRoadmaps(user.id)

    return NextResponse.json({
      success: true,
      shared: shared.map((s) => ({
        id: s.id,
        shareCode: s.shareCode,
        title: s.title,
        goal: s.goal,
        subject: s.subject,
        totalSteps: s.totalSteps,
        estimatedMinutes: s.estimatedMinutes,
        completedAt: s.completedAt?.toISOString(),
        viewCount: s.viewCount,
        copyCount: s.copyCount,
        isPublic: s.isPublic,
        createdAt: s.createdAt.toISOString(),
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${s.shareCode}`,
      })),
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to get shared roadmaps', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get shared roadmaps' },
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
      keyPrefix: 'share-create',
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
    const { roadmapId, customTitle, customDescription, isPublic = true, allowCopy = true } = body

    // Validate required fields
    if (!roadmapId) {
      return NextResponse.json(
        { error: 'Roadmap ID is required' },
        { status: 400 }
      )
    }

    log.info('Sharing roadmap', {
      userId: user.id,
      roadmapId,
    })

    // Share the roadmap
    const shared = await shareRoadmap(user.id, {
      roadmapId,
      customTitle,
      customDescription,
      isPublic,
      allowCopy,
    })

    return NextResponse.json({
      success: true,
      shared: {
        id: shared.id,
        shareCode: shared.shareCode,
        title: shared.title,
        goal: shared.goal,
        subject: shared.subject,
        totalSteps: shared.totalSteps,
        viewCount: shared.viewCount,
        copyCount: shared.copyCount,
        isPublic: shared.isPublic,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${shared.shareCode}`,
      },
    }, {
      status: 201,
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to share roadmap', error instanceof Error ? error : { error })

    if (error instanceof Error) {
      if (error.message === 'Completed roadmap not found') {
        return NextResponse.json(
          { error: 'Only completed roadmaps can be shared' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to share roadmap' },
      { status: 500 }
    )
  }
}
