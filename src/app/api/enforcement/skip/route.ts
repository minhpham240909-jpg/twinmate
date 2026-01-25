/**
 * SKIP STEP API (WITH ENFORCEMENT)
 *
 * POST /api/enforcement/skip - Request to skip a step
 *
 * This endpoint enforces consequences for skipping:
 * - First skip: Warning only
 * - Second skip: Study debt added
 * - Third+ skip: Remediation required
 *
 * The system tracks patterns and applies appropriate consequences.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnforcementEngine } from '@/lib/enforcement-engine'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import type { SkipReason } from '@prisma/client'

interface SkipRequest {
  roadmapId: string
  stepId: string
  reason: SkipReason
  explanation?: string
}

// POST: Request to skip a step
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

    // Rate limiting - moderate to prevent spam skipping
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    const body: SkipRequest = await request.json()

    if (!body.roadmapId || !body.stepId || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: roadmapId, stepId, and reason' },
        { status: 400 }
      )
    }

    // Validate reason is valid enum
    const validReasons: SkipReason[] = [
      'TOO_HARD', 'NOT_RELEVANT', 'ALREADY_KNOW', 'NO_TIME',
      'UNCLEAR', 'BORED', 'SYSTEM_ALLOWED', 'ABANDONED'
    ]
    if (!validReasons.includes(body.reason)) {
      return NextResponse.json(
        { error: 'Invalid skip reason' },
        { status: 400 }
      )
    }

    // Verify step belongs to user and is current
    const step = await prisma.roadmapStep.findUnique({
      where: { id: body.stepId },
      include: { roadmap: true }
    })

    if (!step || step.roadmap.userId !== user.id) {
      return NextResponse.json(
        { error: 'Step not found or access denied' },
        { status: 404 }
      )
    }

    if (step.status !== 'CURRENT') {
      return NextResponse.json(
        { error: 'Can only skip the current step' },
        { status: 400 }
      )
    }

    // Evaluate skip decision (this applies enforcement logic)
    const decision = await EnforcementEngine.evaluateSkip(
      user.id,
      body.roadmapId,
      body.stepId,
      body.reason,
      body.explanation
    )

    // If skip not allowed, return the reason
    if (!decision.allowed) {
      log.info('Skip denied', {
        userId: user.id,
        stepId: body.stepId,
        reason: body.reason,
        denialReason: decision.message,
      })

      return NextResponse.json({
        success: false,
        allowed: false,
        message: decision.message,
        consequence: null,
      }, {
        headers: { 'x-correlation-id': correlationId },
      })
    }

    // Record the skip and apply consequences
    const skipRecord = await EnforcementEngine.recordSkip(
      user.id,
      body.roadmapId,
      body.stepId,
      body.reason,
      decision,
      body.explanation
    )

    // Progress to next step if allowed
    const nextStep = await prisma.roadmapStep.findFirst({
      where: {
        roadmapId: body.roadmapId,
        order: step.order + 1,
      }
    })

    if (nextStep) {
      // Unlock next step
      await prisma.roadmapStep.update({
        where: { id: nextStep.id },
        data: { status: 'CURRENT' }
      })

      // Update roadmap progress
      await prisma.learningRoadmap.update({
        where: { id: body.roadmapId },
        data: {
          currentStepIndex: nextStep.order,
          lastActivityAt: new Date(),
        }
      })
    } else {
      // Last step - mark roadmap as completed (with skipped steps)
      await prisma.learningRoadmap.update({
        where: { id: body.roadmapId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        }
      })
    }

    log.info('Skip recorded', {
      userId: user.id,
      stepId: body.stepId,
      reason: body.reason,
      consequence: decision.consequence,
      debtAdded: decision.debtMinutes,
    })

    return NextResponse.json({
      success: true,
      allowed: true,
      message: decision.message,
      consequence: decision.consequence ? {
        type: decision.consequence,
        debtMinutes: decision.debtMinutes,
        requiresRemediation: decision.requiresRemediation,
      } : null,
      skipRecord: {
        id: skipRecord.id,
        reason: skipRecord.reason,
        consequenceApplied: skipRecord.consequenceApplied,
      },
      nextStep: nextStep ? {
        id: nextStep.id,
        order: nextStep.order,
        title: nextStep.title,
      } : null,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to process skip request', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to process skip request' },
      { status: 500 }
    )
  }
}
