/**
 * ROADMAP LIST API
 *
 * GET /api/roadmap/list - Get all user's roadmaps with filtering
 *
 * Query params:
 * - status: 'active' | 'paused' | 'completed' | 'all'
 * - search: string (search in title, goal, subject)
 * - sortBy: 'recent' | 'oldest' | 'progress' | 'name'
 * - limit: number (default 20, max 50)
 * - offset: number (for pagination)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-auth'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { getAllUserRoadmaps, getRoadmapSummaries } from '@/lib/roadmap-engine/roadmap-service'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - lenient for list reads
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth check - uses cached auth context
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as 'active' | 'paused' | 'completed' | 'all' | null
    const search = searchParams.get('search') || undefined
    const sortBy = searchParams.get('sortBy') as 'recent' | 'oldest' | 'progress' | 'name' | null
    const limitParam = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const summaryOnly = searchParams.get('summaryOnly') === 'true'

    // Validate and cap limit
    const limit = Math.min(Math.max(1, limitParam), 50)

    // Validate offset
    const validOffset = Math.max(0, offset)

    if (summaryOnly) {
      // Return lightweight summaries (no step data)
      const summaries = await getRoadmapSummaries(user.id, { limit })

      return NextResponse.json({
        success: true,
        roadmaps: summaries.map(r => ({
          id: r.id,
          title: r.title,
          goal: r.goal,
          subject: r.subject,
          status: r.status.toLowerCase(),
          isActive: r.isActive,
          progress: {
            completed: r.completedSteps,
            total: r.totalSteps,
            percentage: r.totalSteps > 0 ? Math.round((r.completedSteps / r.totalSteps) * 100) : 0,
          },
          time: {
            estimated: r.estimatedMinutes,
            spent: r.actualMinutesSpent,
          },
          createdAt: r.createdAt,
          lastActivityAt: r.lastActivityAt,
          completedAt: r.completedAt,
        })),
        total: summaries.length,
        hasMore: false,
      }, {
        headers: { 'x-correlation-id': correlationId },
      })
    }

    // Get full roadmaps with steps
    const result = await getAllUserRoadmaps(user.id, {
      status: status || 'all',
      search,
      sortBy: sortBy || 'recent',
      limit,
      offset: validOffset,
    })

    log.info('Roadmap list fetched', {
      userId: user.id,
      count: result.roadmaps.length,
      total: result.total,
      status,
      search: search ? 'yes' : 'no',
    })

    return NextResponse.json({
      success: true,
      roadmaps: result.roadmaps.map(r => ({
        id: r.id,
        title: r.title,
        goal: r.goal,
        subject: r.subject,
        overview: r.overview,
        status: r.status.toLowerCase(),
        isActive: r.isActive,
        progress: {
          completed: r.completedSteps,
          total: r.totalSteps,
          percentage: r.totalSteps > 0 ? Math.round((r.completedSteps / r.totalSteps) * 100) : 0,
          currentStepIndex: r.currentStepIndex,
        },
        time: {
          estimated: r.estimatedMinutes,
          spent: r.actualMinutesSpent,
        },
        steps: r.steps.map(s => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          status: s.status.toLowerCase(),
          duration: s.duration,
        })),
        createdAt: r.createdAt,
        lastActivityAt: r.lastActivityAt,
        completedAt: r.completedAt,
      })),
      total: result.total,
      hasMore: result.hasMore,
      pagination: {
        limit,
        offset: validOffset,
        nextOffset: result.hasMore ? validOffset + limit : null,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to list roadmaps', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to list roadmaps' },
      { status: 500 }
    )
  }
}
