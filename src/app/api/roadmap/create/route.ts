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

// Resource suggestion type for steps
interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  url?: string
  searchQuery?: string
}

// Recommended platform type
interface RecommendedPlatform {
  id: string
  name: string
  description: string
  url: string
  icon: string
  color: string
  searchUrl?: string
}

// Critical warning structure
interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
}

interface CreateRoadmapRequest {
  goal: string
  subject?: string
  goalType?: string
  title: string
  overview?: string
  pitfalls?: string[]
  successLooksLike?: string
  estimatedMinutes?: number
  recommendedPlatforms?: RecommendedPlatform[]
  // Vision & Strategy fields
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  outOfScope?: string[]
  criticalWarning?: CriticalWarning
  estimatedDays?: number
  dailyCommitment?: string
  milestones?: { order: number; title: string; description: string; marker: string; unlocks: string }[]
  steps: {
    order: number
    title: string
    description: string
    timeframe?: string
    method?: string
    avoid?: string
    doneWhen?: string
    duration?: number
    resources?: StepResource[]
    // Enhanced professor-level fields
    phase?: 'NOW' | 'NEXT' | 'LATER'
    whyFirst?: string
    whyAfterPrevious?: string
    timeBreakdown?: { daily: string; total: string; flexible: string }
    commonMistakes?: string[]
    selfTest?: { challenge: string; passCriteria: string }
    abilities?: string[]
    previewAbilities?: string[]
    milestone?: string
    risk?: { warning: string; consequence: string; severity: string }
  }[]
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  // Declare outside try block for error logging access
  let userId: string | undefined
  let body: CreateRoadmapRequest | undefined

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
    userId = user.id

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    body = await request.json() as CreateRoadmapRequest

    // Validate required fields
    if (!body || !body.goal || !body.title || !body.steps || body.steps.length === 0) {
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
      recommendedPlatforms: body.recommendedPlatforms,
      // Vision & Strategy fields
      vision: body.vision,
      targetUser: body.targetUser,
      successMetrics: body.successMetrics,
      outOfScope: body.outOfScope,
      criticalWarning: body.criticalWarning,
      estimatedDays: body.estimatedDays,
      dailyCommitment: body.dailyCommitment,
      milestones: body.milestones,
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
        recommendedPlatforms: roadmap.recommendedPlatforms,
        createdAt: roadmap.createdAt,
        // Vision & Strategy fields
        vision: roadmap.vision,
        targetUser: roadmap.targetUser,
        successMetrics: roadmap.successMetrics,
        outOfScope: roadmap.outOfScope,
        criticalWarning: roadmap.criticalWarning,
        estimatedDays: roadmap.estimatedDays,
        dailyCommitment: roadmap.dailyCommitment,
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
          resources: step.resources,
          status: step.status.toLowerCase(),
          // Enhanced professor-level fields
          phase: step.phase,
          whyFirst: step.whyFirst,
          whyAfterPrevious: step.whyAfterPrevious,
          timeBreakdown: step.timeBreakdown,
          commonMistakes: step.commonMistakes,
          selfTest: step.selfTest,
          abilities: step.abilities,
          previewAbilities: step.previewAbilities,
          milestone: step.milestone,
          risk: step.risk,
        })),
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    // Detailed error logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    log.error('Failed to create roadmap', {
      error: errorMessage,
      stack: errorStack,
      userId,
      goalLength: body?.goal?.length,
      titleLength: body?.title?.length,
      stepsCount: body?.steps?.length,
      // Log first step structure if available
      firstStep: body?.steps?.[0] ? {
        hasTitle: !!body.steps[0].title,
        hasDescription: !!body.steps[0].description,
        hasOrder: typeof body.steps[0].order === 'number',
      } : null,
    })

    // Return more descriptive error in development
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      { 
        error: isDev ? `Failed to create roadmap: ${errorMessage}` : 'Failed to create roadmap',
        details: isDev ? { message: errorMessage } : undefined,
      },
      { status: 500 }
    )
  }
}
