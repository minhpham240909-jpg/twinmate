/**
 * ACTIVE ROADMAP API
 *
 * GET /api/roadmap/active - Get user's currently active roadmap
 * DELETE /api/roadmap/active - Delete/abandon the active roadmap
 *
 * This is the primary endpoint for the dashboard to know:
 * - Does user have an active roadmap?
 * - What step are they on?
 * - What's their "Today's Mission"?
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-auth'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { getActiveRoadmap, getUserRoadmapStats, deleteRoadmap } from '@/lib/roadmap-engine/roadmap-service'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - lenient for dashboard reads
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

    // Get active roadmap and stats
    const [activeRoadmap, stats] = await Promise.all([
      getActiveRoadmap(user.id),
      getUserRoadmapStats(user.id),
    ])

    if (!activeRoadmap) {
      return NextResponse.json({
        success: true,
        hasActiveRoadmap: false,
        activeRoadmap: null,
        currentStep: null,
        todaysMission: null,
        stats: {
          totalRoadmaps: stats.totalRoadmaps,
          completedRoadmaps: stats.completedRoadmaps,
          totalMinutesLearned: stats.totalMinutesLearned,
          averageCompletionRate: stats.averageCompletionRate,
        },
      }, {
        headers: { 'x-correlation-id': correlationId },
      })
    }

    // Defensive check: ensure steps array exists
    if (!activeRoadmap.steps || !Array.isArray(activeRoadmap.steps)) {
      log.error('Roadmap found but steps missing!', {
        roadmapId: activeRoadmap.id,
        hasSteps: !!activeRoadmap.steps,
        stepsType: typeof activeRoadmap.steps,
      })
      // Return roadmap with empty steps rather than crashing
      return NextResponse.json({
        success: true,
        hasActiveRoadmap: true,
        activeRoadmap: {
          id: activeRoadmap.id,
          title: activeRoadmap.title,
          goal: activeRoadmap.goal,
          status: activeRoadmap.status,
          currentStepIndex: 0,
          totalSteps: 0,
          completedSteps: 0,
          estimatedMinutes: 0,
          actualMinutesSpent: 0,
          createdAt: activeRoadmap.createdAt,
          lastActivityAt: activeRoadmap.lastActivityAt,
          steps: [],
        },
        currentStep: null,
        todaysMission: null,
        stats: {
          totalRoadmaps: stats.totalRoadmaps,
          completedRoadmaps: stats.completedRoadmaps,
          totalMinutesLearned: stats.totalMinutesLearned,
          averageCompletionRate: stats.averageCompletionRate,
        },
      }, {
        headers: { 'x-correlation-id': correlationId },
      })
    }

    // Get current step
    const currentStep = activeRoadmap.steps.find(s => s.status === 'CURRENT') || null

    // Build "Today's Mission" from current step
    const todaysMission = currentStep ? {
      stepId: currentStep.id,
      title: currentStep.title,
      description: currentStep.description,
      timeframe: currentStep.timeframe,
      method: currentStep.method,
      avoid: currentStep.avoid,
      doneWhen: currentStep.doneWhen,
      estimatedMinutes: currentStep.duration,
      stepNumber: currentStep.order,
      totalSteps: activeRoadmap.totalSteps,
    } : null

    return NextResponse.json({
      success: true,
      hasActiveRoadmap: true,
      activeRoadmap: {
        id: activeRoadmap.id,
        title: activeRoadmap.title,
        overview: activeRoadmap.overview,
        goal: activeRoadmap.goal,
        subject: activeRoadmap.subject,
        status: activeRoadmap.status,
        currentStepIndex: activeRoadmap.currentStepIndex,
        totalSteps: activeRoadmap.totalSteps,
        completedSteps: activeRoadmap.completedSteps,
        estimatedMinutes: activeRoadmap.estimatedMinutes,
        actualMinutesSpent: activeRoadmap.actualMinutesSpent,
        pitfalls: activeRoadmap.pitfalls,
        successLooksLike: activeRoadmap.successLooksLike,
        recommendedPlatforms: activeRoadmap.recommendedPlatforms,
        targetDate: activeRoadmap.targetDate,
        createdAt: activeRoadmap.createdAt,
        lastActivityAt: activeRoadmap.lastActivityAt,
        // Vision & Strategy fields
        vision: activeRoadmap.vision,
        targetUser: activeRoadmap.targetUser,
        successMetrics: activeRoadmap.successMetrics,
        outOfScope: activeRoadmap.outOfScope,
        criticalWarning: activeRoadmap.criticalWarning,
        estimatedDays: activeRoadmap.estimatedDays,
        dailyCommitment: activeRoadmap.dailyCommitment,
        steps: activeRoadmap.steps.map(step => ({
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
          completedAt: step.completedAt,
          minutesSpent: step.minutesSpent,
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
          // Micro-tasks for task-based progression
          microTasks: step.microTasks?.map(task => ({
            id: task.id,
            order: task.order,
            title: task.title,
            description: task.description,
            taskType: task.taskType,
            duration: task.duration,
            verificationMethod: task.verificationMethod,
            proofRequired: task.proofRequired,
            status: task.status,
            completedAt: task.completedAt,
            attempts: task.attempts,
          })) || [],
        })),
      },
      currentStep: currentStep ? {
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
      todaysMission,
      stats: {
        totalRoadmaps: stats.totalRoadmaps,
        completedRoadmaps: stats.completedRoadmaps,
        totalMinutesLearned: stats.totalMinutesLearned,
        averageCompletionRate: stats.averageCompletionRate,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to get active roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get active roadmap' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/roadmap/active - Delete/abandon the active roadmap
 */
export async function DELETE(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
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

    // Get the active roadmap first
    const activeRoadmap = await getActiveRoadmap(user.id)

    if (!activeRoadmap) {
      return NextResponse.json(
        { error: 'No active roadmap to delete' },
        { status: 404 }
      )
    }

    // Delete (abandon) the roadmap
    await deleteRoadmap(activeRoadmap.id, user.id)

    log.info('Roadmap deleted', { roadmapId: activeRoadmap.id, userId: user.id })

    return NextResponse.json({
      success: true,
      message: 'Roadmap deleted successfully',
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Failed to delete roadmap', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined })

    // Handle specific errors
    if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
      return NextResponse.json(
        { error: 'Roadmap not found or you do not have permission to delete it' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete roadmap. Please try again.' },
      { status: 500 }
    )
  }
}
