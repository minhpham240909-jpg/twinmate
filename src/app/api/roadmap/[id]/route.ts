/**
 * ROADMAP BY ID API
 *
 * GET /api/roadmap/[id] - Get a specific roadmap
 * DELETE /api/roadmap/[id] - Delete a specific roadmap
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { getRoadmapById, deleteRoadmap } from '@/lib/roadmap-engine/roadmap-service'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)
  const { id: roadmapId } = await params

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get roadmap
    const roadmap = await getRoadmapById(roadmapId, user.id)

    if (!roadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        goal: roadmap.goal,
        subject: roadmap.subject,
        overview: roadmap.overview,
        pitfalls: roadmap.pitfalls,
        successLooksLike: roadmap.successLooksLike,
        recommendedPlatforms: roadmap.recommendedPlatforms,
        status: roadmap.status.toLowerCase(),
        isActive: roadmap.isActive,
        targetDate: roadmap.targetDate,
        progress: {
          completed: roadmap.completedSteps,
          total: roadmap.totalSteps,
          percentage: roadmap.totalSteps > 0 ? Math.round((roadmap.completedSteps / roadmap.totalSteps) * 100) : 0,
          currentStepIndex: roadmap.currentStepIndex,
        },
        time: {
          estimated: roadmap.estimatedMinutes,
          spent: roadmap.actualMinutesSpent,
        },
        steps: roadmap.steps.map(s => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          timeframe: s.timeframe,
          method: s.method,
          avoid: s.avoid,
          doneWhen: s.doneWhen,
          duration: s.duration,
          resources: s.resources,
          status: s.status.toLowerCase(),
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          minutesSpent: s.minutesSpent,
          userNotes: s.userNotes,
          difficultyRating: s.difficultyRating,
        })),
        createdAt: roadmap.createdAt,
        updatedAt: roadmap.updatedAt,
        lastActivityAt: roadmap.lastActivityAt,
        completedAt: roadmap.completedAt,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to get roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get roadmap' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)
  const { id: roadmapId } = await params

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if roadmap exists
    const roadmap = await getRoadmapById(roadmapId, user.id)

    if (!roadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    // Delete roadmap
    await deleteRoadmap(roadmapId, user.id)

    log.info('Roadmap deleted', { roadmapId, userId: user.id })

    return NextResponse.json({
      success: true,
      message: 'Roadmap deleted successfully',
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to delete roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to delete roadmap' },
      { status: 500 }
    )
  }
}
