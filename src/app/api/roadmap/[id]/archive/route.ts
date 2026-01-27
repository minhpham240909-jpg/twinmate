/**
 * ROADMAP ARCHIVE API
 *
 * POST /api/roadmap/[id]/archive - Archive (pause) this roadmap
 *
 * This will:
 * 1. Set the roadmap status to PAUSED
 * 2. Set isActive to false
 * 3. Keep all progress intact
 *
 * The roadmap can be reactivated later with the activate endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { archiveRoadmap, getRoadmapById } from '@/lib/roadmap-engine/roadmap-service'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const existingRoadmap = await getRoadmapById(roadmapId, user.id)
    if (!existingRoadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    // Check if already archived/paused
    if (existingRoadmap.status === 'PAUSED' && !existingRoadmap.isActive) {
      return NextResponse.json({
        success: true,
        message: 'Roadmap is already archived',
        roadmap: {
          id: existingRoadmap.id,
          title: existingRoadmap.title,
          status: existingRoadmap.status.toLowerCase(),
          isActive: existingRoadmap.isActive,
        },
      }, {
        headers: { 'x-correlation-id': correlationId },
      })
    }

    // Archive the roadmap
    const roadmap = await archiveRoadmap(roadmapId, user.id)

    log.info('Roadmap archived', {
      roadmapId,
      userId: user.id,
      title: roadmap.title,
      previousStatus: existingRoadmap.status,
    })

    return NextResponse.json({
      success: true,
      message: 'Roadmap archived successfully',
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        goal: roadmap.goal,
        subject: roadmap.subject,
        status: roadmap.status.toLowerCase(),
        isActive: roadmap.isActive,
        progress: {
          completed: roadmap.completedSteps,
          total: roadmap.totalSteps,
          percentage: roadmap.totalSteps > 0 ? Math.round((roadmap.completedSteps / roadmap.totalSteps) * 100) : 0,
        },
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to archive roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to archive roadmap' },
      { status: 500 }
    )
  }
}
