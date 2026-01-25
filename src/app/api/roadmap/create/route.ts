/**
 * CREATE ROADMAP API
 *
 * POST /api/roadmap/create - Create and save a new roadmap
 *
 * This endpoint:
 * 1. Takes the AI-generated roadmap from guide-me
 * 2. Persists it to the database
 * 3. Sets it as the user's active roadmap
 * 4. Deactivates any previous active roadmap
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRoadmap } from '@/lib/roadmap-engine/roadmap-service'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface CreateRoadmapRequest {
  goal: string
  subject?: string
  goalType?: string
  title: string
  overview?: string
  pitfalls?: string[]
  successLooksLike?: string
  estimatedMinutes?: number
  steps: {
    order: number
    title: string
    description: string
    timeframe?: string
    method?: string
    avoid?: string
    doneWhen?: string
    duration?: number
  }[]
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    const body: CreateRoadmapRequest = await request.json()

    // Validate required fields
    if (!body.goal || !body.title || !body.steps || body.steps.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: goal, title, and steps are required' },
        { status: 400 }
      )
    }

    // Create the roadmap
    const roadmap = await createRoadmap({
      userId: user.id,
      goal: body.goal,
      subject: body.subject,
      goalType: body.goalType,
      title: body.title,
      overview: body.overview,
      pitfalls: body.pitfalls || [],
      successLooksLike: body.successLooksLike,
      estimatedMinutes: body.estimatedMinutes,
      steps: body.steps,
    })

    log.info('Roadmap created', {
      roadmapId: roadmap.id,
      userId: user.id,
      stepCount: roadmap.steps.length,
    })

    // Return the created roadmap
    return NextResponse.json({
      success: true,
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        overview: roadmap.overview,
        goal: roadmap.goal,
        subject: roadmap.subject,
        status: roadmap.status,
        currentStepIndex: roadmap.currentStepIndex,
        totalSteps: roadmap.totalSteps,
        completedSteps: roadmap.completedSteps,
        estimatedMinutes: roadmap.estimatedMinutes,
        pitfalls: roadmap.pitfalls,
        successLooksLike: roadmap.successLooksLike,
        createdAt: roadmap.createdAt,
        steps: roadmap.steps.map(step => ({
          id: step.id,
          order: step.order,
          title: step.title,
          description: step.description,
          timeframe: step.timeframe,
          method: step.method,
          avoid: step.avoid,
          doneWhen: step.doneWhen,
          duration: step.duration,
          status: step.status.toLowerCase(),
        })),
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to create roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to create roadmap' },
      { status: 500 }
    )
  }
}
