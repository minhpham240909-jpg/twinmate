/**
 * ROADMAP ACTIVATE API
 *
 * POST /api/roadmap/[id]/activate - Set this roadmap as the active one
 *
 * This will:
 * 1. Archive (pause) any other active roadmaps
 * 2. Set the specified roadmap as active
 *
 * Only one roadmap can be active at a time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { setActiveRoadmap, getRoadmapById } from '@/lib/roadmap-engine/roadmap-service'
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

    // Check if roadmap exists first
    const existingRoadmap = await getRoadmapById(roadmapId, user.id)
    if (!existingRoadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    // Set as active
    const roadmap = await setActiveRoadmap(roadmapId, user.id)

    log.info('Roadmap activated', {
      roadmapId,
      userId: user.id,
      title: roadmap.title,
    })

    // Get current step
    const currentStep = roadmap.steps.find(s => s.status === 'CURRENT') || null

    return NextResponse.json({
      success: true,
      message: 'Roadmap is now active',
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        goal: roadmap.goal,
        subject: roadmap.subject,
        overview: roadmap.overview,
        status: roadmap.status.toLowerCase(),
        isActive: roadmap.isActive,
        progress: {
          completed: roadmap.completedSteps,
          total: roadmap.totalSteps,
          percentage: roadmap.totalSteps > 0 ? Math.round((roadmap.completedSteps / roadmap.totalSteps) * 100) : 0,
          currentStepIndex: roadmap.currentStepIndex,
        },
        currentStep: currentStep ? {
          id: currentStep.id,
          order: currentStep.order,
          title: currentStep.title,
          description: currentStep.description,
        } : null,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Handle specific errors
    if (errorMessage === 'Roadmap not found') {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    if (errorMessage === 'Cannot activate an abandoned roadmap') {
      return NextResponse.json(
        { error: 'Cannot activate a deleted roadmap. Please create a new one.' },
        { status: 400 }
      )
    }

    log.error('Failed to activate roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to activate roadmap' },
      { status: 500 }
    )
  }
}
