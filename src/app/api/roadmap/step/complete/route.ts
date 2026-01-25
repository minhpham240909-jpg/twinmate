/**
 * COMPLETE STEP API (WITH ENFORCEMENT)
 *
 * POST /api/roadmap/step/complete - Mark a step as completed
 *
 * This is SYSTEM-controlled progression with enforcement:
 * - Validates that it's the current step
 * - Validates minimum time requirement
 * - Records the attempt
 * - Marks as complete
 * - Unlocks the next step (or completes roadmap if last step)
 * - Updates identity and pays down debt
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeStep } from '@/lib/roadmap-engine/roadmap-service'
import { EnforcementEngine } from '@/lib/enforcement-engine'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface CompleteStepRequest {
  roadmapId: string
  stepId: string
  userNotes?: string
  difficultyRating?: number // 1-5
  confidenceLevel?: number  // 1-5
  minutesSpent?: number
  proof?: {
    type: string
    content: string
    score?: number
  }
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
    const body: CompleteStepRequest = await request.json()

    if (!body.roadmapId || !body.stepId) {
      return NextResponse.json(
        { error: 'Missing required fields: roadmapId and stepId' },
        { status: 400 }
      )
    }

    // Validate ratings if provided
    if (body.difficultyRating !== undefined && (body.difficultyRating < 1 || body.difficultyRating > 5)) {
      return NextResponse.json(
        { error: 'difficultyRating must be between 1 and 5' },
        { status: 400 }
      )
    }

    if (body.confidenceLevel !== undefined && (body.confidenceLevel < 1 || body.confidenceLevel > 5)) {
      return NextResponse.json(
        { error: 'confidenceLevel must be between 1 and 5' },
        { status: 400 }
      )
    }

    const minutesSpent = body.minutesSpent || 0

    // ENFORCEMENT: Validate completion requirements
    const validation = await EnforcementEngine.validateCompletion(
      user.id,
      body.stepId,
      minutesSpent,
      body.proof
    )

    // Get warnings for the response
    const warnings = validation.warnings

    // Record the attempt (SUCCESS or PARTIAL based on validation)
    await EnforcementEngine.recordAttempt(
      user.id,
      body.stepId,
      validation.valid ? 'SUCCESS' : 'PARTIAL',
      {
        minutesSpent,
        minimumTimeMet: validation.minimumTimeMet,
        proofType: body.proof?.type,
        proofData: body.proof,
        proofValidated: validation.proofValidated,
        difficultyRating: body.difficultyRating,
        confidenceLevel: body.confidenceLevel,
      }
    )

    // Complete the step (this handles progression)
    const updatedRoadmap = await completeStep(
      body.roadmapId,
      body.stepId,
      user.id,
      {
        userNotes: body.userNotes,
        difficultyRating: body.difficultyRating,
        minutesSpent,
      }
    )

    // ENFORCEMENT: Pay down study debt with time spent
    if (minutesSpent > 0) {
      await EnforcementEngine.payStudyDebt(user.id, minutesSpent)
    }

    // Check if roadmap is now complete
    const isRoadmapComplete = updatedRoadmap.status === 'COMPLETED'
    const currentStep = updatedRoadmap.steps.find(s => s.status === 'CURRENT')

    // Get identity update
    const identity = await EnforcementEngine.getIdentity(user.id)

    // Get authority message based on completion
    const authorityMessage = EnforcementEngine.getAuthorityMessage('success', {
      streak: identity.currentStreak,
    })

    log.info('Step completed with enforcement', {
      roadmapId: body.roadmapId,
      stepId: body.stepId,
      isRoadmapComplete,
      newStepIndex: updatedRoadmap.currentStepIndex,
      minutesSpent,
      validationPassed: validation.valid,
      warnings: warnings.length,
    })

    return NextResponse.json({
      success: true,
      isRoadmapComplete,
      validation: {
        passed: validation.valid,
        minimumTimeMet: validation.minimumTimeMet,
        proofValidated: validation.proofValidated,
        warnings,
      },
      roadmap: {
        id: updatedRoadmap.id,
        status: updatedRoadmap.status,
        currentStepIndex: updatedRoadmap.currentStepIndex,
        completedSteps: updatedRoadmap.completedSteps,
        totalSteps: updatedRoadmap.totalSteps,
        actualMinutesSpent: updatedRoadmap.actualMinutesSpent,
        steps: updatedRoadmap.steps.map(step => ({
          id: step.id,
          order: step.order,
          title: step.title,
          status: step.status.toLowerCase(),
          completedAt: step.completedAt,
        })),
      },
      nextStep: currentStep ? {
        id: currentStep.id,
        order: currentStep.order,
        title: currentStep.title,
        description: currentStep.description,
        timeframe: currentStep.timeframe,
        method: currentStep.method,
        avoid: currentStep.avoid,
        doneWhen: currentStep.doneWhen,
        duration: currentStep.duration,
      } : null,
      identity: {
        streak: identity.currentStreak,
        totalCompleted: identity.totalMissionsCompleted,
        archetype: identity.archetype,
      },
      authorityMessage: authorityMessage.message,
      message: isRoadmapComplete
        ? 'Roadmap complete. Your consistency shows commitment.'
        : `Step complete. ${currentStep?.title || 'Next step'} awaits.`,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete step'
    log.error('Failed to complete step', error instanceof Error ? error : { error })

    // Handle specific error cases
    if (errorMessage === 'Roadmap not found') {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
    }
    if (errorMessage === 'Step not found') {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }
    if (errorMessage === 'Can only complete the current step') {
      return NextResponse.json(
        { error: 'You can only complete the current active step' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to complete step' },
      { status: 500 }
    )
  }
}
