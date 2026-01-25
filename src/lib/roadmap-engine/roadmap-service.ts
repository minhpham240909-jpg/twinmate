/**
 * CLERVA ROADMAP SERVICE
 *
 * Database operations for roadmap persistence.
 * This is SYSTEM logic - it controls the roadmap state.
 *
 * Key Principles:
 * - System decides: when steps unlock, when roadmap is complete
 * - User can: mark steps done, add notes, pause/resume
 * - AI cannot: change structure, skip steps, decide completion
 */

import { prisma } from '@/lib/prisma'
import { RoadmapStatus, RoadmapStepStatus } from '@prisma/client'

// ============================================
// TYPES
// ============================================

export interface CreateRoadmapInput {
  userId: string
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

export interface RoadmapWithSteps {
  id: string
  userId: string
  goal: string
  subject: string | null
  goalType: string | null
  title: string
  overview: string | null
  pitfalls: string[]
  successLooksLike: string | null
  status: RoadmapStatus
  currentStepIndex: number
  totalSteps: number
  completedSteps: number
  estimatedMinutes: number
  actualMinutesSpent: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastActivityAt: Date
  completedAt: Date | null
  steps: {
    id: string
    order: number
    title: string
    description: string
    timeframe: string | null
    method: string | null
    avoid: string | null
    doneWhen: string | null
    duration: number
    status: RoadmapStepStatus
    startedAt: Date | null
    completedAt: Date | null
    minutesSpent: number
    userNotes: string | null
    difficultyRating: number | null
  }[]
}

// ============================================
// CREATE OPERATIONS
// ============================================

/**
 * Create a new roadmap for user
 * Automatically deactivates any existing active roadmap
 */
export async function createRoadmap(input: CreateRoadmapInput): Promise<RoadmapWithSteps> {
  const { userId, steps, ...roadmapData } = input

  // Use transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // Deactivate any existing active roadmaps (user can only have one active)
    await tx.learningRoadmap.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        status: RoadmapStatus.ABANDONED,
      },
    })

    // Create the new roadmap
    const roadmap = await tx.learningRoadmap.create({
      data: {
        userId,
        ...roadmapData,
        totalSteps: steps.length,
        estimatedMinutes: roadmapData.estimatedMinutes || steps.reduce((sum, s) => sum + (s.duration || 5), 0),
        isActive: true,
        status: RoadmapStatus.ACTIVE,
        steps: {
          create: steps.map((step, index) => ({
            order: step.order || index + 1,
            title: step.title,
            description: step.description,
            timeframe: step.timeframe,
            method: step.method,
            avoid: step.avoid,
            doneWhen: step.doneWhen,
            duration: step.duration || 5,
            // First step is CURRENT, rest are LOCKED
            status: index === 0 ? RoadmapStepStatus.CURRENT : RoadmapStepStatus.LOCKED,
            startedAt: index === 0 ? new Date() : null,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return roadmap as RoadmapWithSteps
  })
}

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get user's active roadmap (if any)
 */
export async function getActiveRoadmap(userId: string): Promise<RoadmapWithSteps | null> {
  const roadmap = await prisma.learningRoadmap.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  return roadmap as RoadmapWithSteps | null
}

/**
 * Get a specific roadmap by ID
 */
export async function getRoadmapById(roadmapId: string, userId: string): Promise<RoadmapWithSteps | null> {
  const roadmap = await prisma.learningRoadmap.findFirst({
    where: {
      id: roadmapId,
      userId, // Ensure user owns this roadmap
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  return roadmap as RoadmapWithSteps | null
}

/**
 * Get user's roadmap history
 */
export async function getUserRoadmaps(
  userId: string,
  options: { limit?: number; includeAbandoned?: boolean } = {}
): Promise<RoadmapWithSteps[]> {
  const { limit = 10, includeAbandoned = false } = options

  const where: Record<string, unknown> = { userId }
  if (!includeAbandoned) {
    where.status = { not: RoadmapStatus.ABANDONED }
  }

  const roadmaps = await prisma.learningRoadmap.findMany({
    where,
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return roadmaps as RoadmapWithSteps[]
}

// ============================================
// UPDATE OPERATIONS
// ============================================

/**
 * Mark a step as completed and unlock the next one
 * This is SYSTEM logic - controls progression
 */
export async function completeStep(
  roadmapId: string,
  stepId: string,
  userId: string,
  options: { userNotes?: string; difficultyRating?: number; minutesSpent?: number } = {}
): Promise<RoadmapWithSteps> {
  return prisma.$transaction(async (tx) => {
    // Verify ownership
    const roadmap = await tx.learningRoadmap.findFirst({
      where: { id: roadmapId, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    if (!roadmap) {
      throw new Error('Roadmap not found')
    }

    const stepIndex = roadmap.steps.findIndex((s) => s.id === stepId)
    if (stepIndex === -1) {
      throw new Error('Step not found')
    }

    const step = roadmap.steps[stepIndex]
    if (step.status !== RoadmapStepStatus.CURRENT) {
      throw new Error('Can only complete the current step')
    }

    // Mark step as completed
    await tx.roadmapStep.update({
      where: { id: stepId },
      data: {
        status: RoadmapStepStatus.COMPLETED,
        completedAt: new Date(),
        userNotes: options.userNotes,
        difficultyRating: options.difficultyRating,
        minutesSpent: options.minutesSpent || step.duration,
      },
    })

    // Calculate new state
    const newCompletedSteps = roadmap.completedSteps + 1
    const isLastStep = stepIndex === roadmap.steps.length - 1

    if (isLastStep) {
      // Roadmap complete!
      await tx.learningRoadmap.update({
        where: { id: roadmapId },
        data: {
          status: RoadmapStatus.COMPLETED,
          completedSteps: newCompletedSteps,
          currentStepIndex: stepIndex,
          completedAt: new Date(),
          lastActivityAt: new Date(),
          actualMinutesSpent: {
            increment: options.minutesSpent || step.duration,
          },
        },
      })
    } else {
      // Unlock next step
      const nextStep = roadmap.steps[stepIndex + 1]
      await tx.roadmapStep.update({
        where: { id: nextStep.id },
        data: {
          status: RoadmapStepStatus.CURRENT,
          startedAt: new Date(),
        },
      })

      await tx.learningRoadmap.update({
        where: { id: roadmapId },
        data: {
          completedSteps: newCompletedSteps,
          currentStepIndex: stepIndex + 1,
          lastActivityAt: new Date(),
          actualMinutesSpent: {
            increment: options.minutesSpent || step.duration,
          },
        },
      })
    }

    // Return updated roadmap
    const updated = await tx.learningRoadmap.findUnique({
      where: { id: roadmapId },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    return updated as RoadmapWithSteps
  })
}

/**
 * Pause the current roadmap
 */
export async function pauseRoadmap(roadmapId: string, userId: string): Promise<RoadmapWithSteps> {
  const roadmap = await prisma.learningRoadmap.update({
    where: { id: roadmapId, userId },
    data: {
      status: RoadmapStatus.PAUSED,
      lastActivityAt: new Date(),
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  return roadmap as RoadmapWithSteps
}

/**
 * Resume a paused roadmap
 */
export async function resumeRoadmap(roadmapId: string, userId: string): Promise<RoadmapWithSteps> {
  return prisma.$transaction(async (tx) => {
    // Deactivate any other active roadmaps
    await tx.learningRoadmap.updateMany({
      where: {
        userId,
        isActive: true,
        id: { not: roadmapId },
      },
      data: {
        isActive: false,
        status: RoadmapStatus.ABANDONED,
      },
    })

    // Resume this roadmap
    const roadmap = await tx.learningRoadmap.update({
      where: { id: roadmapId, userId },
      data: {
        status: RoadmapStatus.ACTIVE,
        isActive: true,
        lastActivityAt: new Date(),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    return roadmap as RoadmapWithSteps
  })
}

/**
 * Update time spent on current step
 */
export async function updateStepTime(
  roadmapId: string,
  stepId: string,
  userId: string,
  minutesSpent: number
): Promise<void> {
  // Verify ownership
  const roadmap = await prisma.learningRoadmap.findFirst({
    where: { id: roadmapId, userId },
  })

  if (!roadmap) {
    throw new Error('Roadmap not found')
  }

  await prisma.roadmapStep.update({
    where: { id: stepId },
    data: {
      minutesSpent: { increment: minutesSpent },
    },
  })

  await prisma.learningRoadmap.update({
    where: { id: roadmapId },
    data: {
      actualMinutesSpent: { increment: minutesSpent },
      lastActivityAt: new Date(),
    },
  })
}

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * Delete a roadmap (soft delete by marking as abandoned)
 */
export async function deleteRoadmap(roadmapId: string, userId: string): Promise<void> {
  await prisma.learningRoadmap.update({
    where: { id: roadmapId, userId },
    data: {
      status: RoadmapStatus.ABANDONED,
      isActive: false,
    },
  })
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get user's roadmap statistics
 */
export async function getUserRoadmapStats(userId: string): Promise<{
  totalRoadmaps: number
  completedRoadmaps: number
  activeRoadmap: RoadmapWithSteps | null
  totalMinutesLearned: number
  averageCompletionRate: number
}> {
  const [stats, activeRoadmap] = await Promise.all([
    prisma.learningRoadmap.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { actualMinutesSpent: true },
    }),
    getActiveRoadmap(userId),
  ])

  const completed = await prisma.learningRoadmap.count({
    where: { userId, status: RoadmapStatus.COMPLETED },
  })

  const allRoadmaps = await prisma.learningRoadmap.findMany({
    where: { userId, status: { not: RoadmapStatus.ABANDONED } },
    select: { completedSteps: true, totalSteps: true },
  })

  const avgCompletion =
    allRoadmaps.length > 0
      ? allRoadmaps.reduce((sum, r) => sum + (r.totalSteps > 0 ? r.completedSteps / r.totalSteps : 0), 0) /
        allRoadmaps.length
      : 0

  return {
    totalRoadmaps: stats._count.id,
    completedRoadmaps: completed,
    activeRoadmap,
    totalMinutesLearned: stats._sum.actualMinutesSpent || 0,
    averageCompletionRate: Math.round(avgCompletion * 100),
  }
}
