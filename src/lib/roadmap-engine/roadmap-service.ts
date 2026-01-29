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
import { RoadmapStatus, RoadmapStepStatus, Prisma } from '@prisma/client'

// ============================================
// TYPES
// ============================================

// Critical warning structure
export interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
}

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
    // Micro-tasks for task-based progression
    microTasks?: {
      order: number
      title: string
      description: string
      taskType: 'ACTION' | 'LEARN' | 'PRACTICE' | 'TEST' | 'REFLECT'
      duration: number
      verificationMethod?: string
      proofRequired?: boolean
    }[]
  }[]
}

// Recommended platform type
export interface RecommendedPlatform {
  id: string
  name: string
  description: string
  url: string
  icon: string
  color: string
  searchUrl?: string
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
  recommendedPlatforms: RecommendedPlatform[] | null
  status: RoadmapStatus
  currentStepIndex: number
  totalSteps: number
  completedSteps: number
  estimatedMinutes: number
  actualMinutesSpent: number
  isActive: boolean
  targetDate: Date | null // Accountability deadline
  createdAt: Date
  updatedAt: Date
  lastActivityAt: Date
  completedAt: Date | null
  // Vision & Strategy fields
  vision: string | null
  targetUser: string | null
  successMetrics: string[]
  outOfScope: string[]
  criticalWarning: CriticalWarning | null
  estimatedDays: number | null
  dailyCommitment: string | null
  milestones: { order: number; title: string; description: string; marker: string; unlocks: string }[] | null
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
    resources: StepResource[] | null
    status: RoadmapStepStatus
    startedAt: Date | null
    completedAt: Date | null
    minutesSpent: number
    userNotes: string | null
    difficultyRating: number | null
    // Enhanced professor-level fields
    phase: string | null
    whyFirst: string | null
    whyAfterPrevious: string | null
    timeBreakdown: { daily: string; total: string; flexible: string } | null
    commonMistakes: string[]
    selfTest: { challenge: string; passCriteria: string } | null
    abilities: string[]
    previewAbilities: string[]
    milestone: string | null
    risk: { warning: string; consequence: string; severity: string } | null
    // Micro-tasks
    microTasks?: {
      id: string
      order: number
      title: string
      description: string
      taskType: string
      duration: number
      verificationMethod: string | null
      proofRequired: boolean
      status: string
      completedAt: Date | null
      attempts: number
    }[]
  }[]
}

// Resource suggestion type
export interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  url?: string // Optional - user finds their own if not provided
  searchQuery?: string // Suggested search term
}

// ============================================
// CREATE OPERATIONS
// ============================================

/**
 * Create a new roadmap for user
 * Automatically deactivates any existing active roadmap
 */
export async function createRoadmap(input: CreateRoadmapInput): Promise<RoadmapWithSteps> {
  const { userId, steps, recommendedPlatforms, criticalWarning, milestones, ...roadmapData } = input

  // Validate input before database operation
  if (!userId) {
    throw new Error('userId is required')
  }
  if (!roadmapData.goal) {
    throw new Error('goal is required')
  }
  if (!roadmapData.title) {
    throw new Error('title is required')
  }
  if (!steps || steps.length === 0) {
    throw new Error('At least one step is required')
  }

  // Validate each step has required fields (be lenient with description)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step.title) {
      throw new Error(`Step ${i + 1} is missing a title`)
    }
    // Description can be empty - use title as fallback
    if (!step.description) {
      steps[i].description = step.title
    }
  }

  // Use transaction to ensure atomicity
  try {
    return await prisma.$transaction(async (tx) => {
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
        recommendedPlatforms: recommendedPlatforms ? (recommendedPlatforms as unknown as Prisma.InputJsonValue) : undefined,
        criticalWarning: criticalWarning ? (criticalWarning as unknown as Prisma.InputJsonValue) : undefined,
        milestones: milestones ? (milestones as unknown as Prisma.InputJsonValue) : undefined,
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
            resources: step.resources ? (step.resources as unknown as Prisma.InputJsonValue) : undefined,
            // Enhanced professor-level fields
            phase: step.phase,
            whyFirst: step.whyFirst,
            whyAfterPrevious: step.whyAfterPrevious,
            timeBreakdown: step.timeBreakdown ? (step.timeBreakdown as unknown as Prisma.InputJsonValue) : undefined,
            commonMistakes: step.commonMistakes || [],
            selfTest: step.selfTest ? (step.selfTest as unknown as Prisma.InputJsonValue) : undefined,
            abilities: step.abilities || [],
            previewAbilities: step.previewAbilities || [],
            milestone: step.milestone,
            risk: step.risk ? (step.risk as unknown as Prisma.InputJsonValue) : undefined,
            // First step is CURRENT, rest are LOCKED
            status: index === 0 ? RoadmapStepStatus.CURRENT : RoadmapStepStatus.LOCKED,
            startedAt: index === 0 ? new Date() : null,
            // NOTE: microTasks creation removed - table may not exist yet
            // Run add_enhanced_roadmap_fields.sql migration to enable microTasks
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          // NOTE: microTasks include removed - table may not exist yet
        },
      },
    })

      return roadmap as RoadmapWithSteps
    })
  } catch (error) {
    // Re-throw with more context for debugging
    const prismaError = error as { code?: string; meta?: { target?: string[] }; message?: string }
    
    if (prismaError.code === 'P2002') {
      throw new Error(`Unique constraint violation: ${prismaError.meta?.target?.join(', ')}`)
    }
    if (prismaError.code === 'P2003') {
      throw new Error(`Foreign key constraint failed: ${prismaError.meta?.target?.join(', ')}`)
    }
    if (prismaError.code === 'P2025') {
      throw new Error('Record not found during operation')
    }
    
    // Log and re-throw the original error with context
    console.error('[RoadmapService] createRoadmap failed:', {
      errorCode: prismaError.code,
      errorMessage: prismaError.message,
      userId,
      stepsCount: steps.length,
    })
    
    throw error
  }
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
        // NOTE: microTasks include removed - table may not exist yet
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
        // NOTE: microTasks include removed - table may not exist yet
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
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!updated) {
      throw new Error('Roadmap verification failed after completion')
    }

    // Return steps without microTasks - they're optional and table may not exist
    // If microTasks are needed, fetch them separately outside this transaction
    const stepsWithEmptyMicroTasks = updated.steps.map((step) => ({
      ...step,
      microTasks: [],
    }))

    return { ...updated, steps: stepsWithEmptyMicroTasks } as RoadmapWithSteps
  })
}

/**
 * Pause the current roadmap
 */
export async function pauseRoadmap(roadmapId: string, userId: string): Promise<RoadmapWithSteps> {
  // First verify the roadmap exists and belongs to user
  const existing = await prisma.learningRoadmap.findFirst({
    where: { id: roadmapId, userId },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('Roadmap not found or access denied')
  }

  const roadmap = await prisma.learningRoadmap.update({
    where: { id: roadmapId },
    data: {
      status: RoadmapStatus.PAUSED,
      lastActivityAt: new Date(),
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  return roadmap as RoadmapWithSteps
}

/**
 * Resume a paused roadmap
 */
export async function resumeRoadmap(roadmapId: string, userId: string): Promise<RoadmapWithSteps> {
  return prisma.$transaction(async (tx) => {
    // First verify the roadmap exists and belongs to user
    const existing = await tx.learningRoadmap.findFirst({
      where: { id: roadmapId, userId },
      select: { id: true, status: true },
    })

    if (!existing) {
      throw new Error('Roadmap not found or access denied')
    }

    if (existing.status === RoadmapStatus.ABANDONED) {
      throw new Error('Cannot resume an abandoned roadmap')
    }

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
      where: { id: roadmapId },
      data: {
        status: RoadmapStatus.ACTIVE,
        isActive: true,
        lastActivityAt: new Date(),
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

/**
 * Update time spent on current step
 * Uses a transaction to ensure atomic updates
 */
export async function updateStepTime(
  roadmapId: string,
  stepId: string,
  userId: string,
  minutesSpent: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Verify ownership
    const roadmap = await tx.learningRoadmap.findFirst({
      where: { id: roadmapId, userId },
      select: { id: true },
    })

    if (!roadmap) {
      throw new Error('Roadmap not found or access denied')
    }

    // Update both step and roadmap atomically
    await tx.roadmapStep.update({
      where: { id: stepId },
      data: {
        minutesSpent: { increment: minutesSpent },
      },
    })

    await tx.learningRoadmap.update({
      where: { id: roadmapId },
      data: {
        actualMinutesSpent: { increment: minutesSpent },
        lastActivityAt: new Date(),
      },
    })
  })
}

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * Delete a roadmap (soft delete by marking as abandoned)
 */
export async function deleteRoadmap(roadmapId: string, userId: string): Promise<void> {
  // First verify the roadmap exists and belongs to user
  const roadmap = await prisma.learningRoadmap.findFirst({
    where: { id: roadmapId, userId },
    select: { id: true },
  })

  if (!roadmap) {
    throw new Error('Roadmap not found or access denied')
  }

  await prisma.learningRoadmap.update({
    where: { id: roadmapId },
    data: {
      status: RoadmapStatus.ABANDONED,
      isActive: false,
    },
  })
}

/**
 * Archive a roadmap (save for later without abandoning)
 * This pauses the roadmap but keeps progress intact
 */
export async function archiveRoadmap(roadmapId: string, userId: string): Promise<RoadmapWithSteps> {
  const roadmap = await prisma.learningRoadmap.update({
    where: { id: roadmapId, userId },
    data: {
      status: RoadmapStatus.PAUSED,
      isActive: false,
      lastActivityAt: new Date(),
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  return roadmap as RoadmapWithSteps
}

/**
 * Set a specific roadmap as active (switch to it)
 * Deactivates all other roadmaps for this user
 */
export async function setActiveRoadmap(roadmapId: string, userId: string): Promise<RoadmapWithSteps> {
  return prisma.$transaction(async (tx) => {
    // Verify the roadmap exists and belongs to user
    const targetRoadmap = await tx.learningRoadmap.findFirst({
      where: { id: roadmapId, userId },
    })

    if (!targetRoadmap) {
      throw new Error('Roadmap not found')
    }

    // Cannot activate an abandoned roadmap
    if (targetRoadmap.status === RoadmapStatus.ABANDONED) {
      throw new Error('Cannot activate an abandoned roadmap')
    }

    // Archive (pause) any other active roadmaps
    await tx.learningRoadmap.updateMany({
      where: {
        userId,
        isActive: true,
        id: { not: roadmapId },
      },
      data: {
        isActive: false,
        status: RoadmapStatus.PAUSED,
      },
    })

    // Activate the target roadmap
    const roadmap = await tx.learningRoadmap.update({
      where: { id: roadmapId, userId },
      data: {
        status: targetRoadmap.status === RoadmapStatus.COMPLETED
          ? RoadmapStatus.COMPLETED // Keep completed status
          : RoadmapStatus.ACTIVE,
        isActive: true,
        lastActivityAt: new Date(),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    return roadmap as RoadmapWithSteps
  })
}

/**
 * Get all user's roadmaps with filtering and pagination
 * Supports filtering by status, search, and sorting
 */
export async function getAllUserRoadmaps(
  userId: string,
  options: {
    status?: 'active' | 'paused' | 'completed' | 'all'
    search?: string
    sortBy?: 'recent' | 'oldest' | 'progress' | 'name'
    limit?: number
    offset?: number
  } = {}
): Promise<{
  roadmaps: RoadmapWithSteps[]
  total: number
  hasMore: boolean
}> {
  const {
    status = 'all',
    search,
    sortBy = 'recent',
    limit = 20,
    offset = 0,
  } = options

  // Build where clause
  const where: Prisma.LearningRoadmapWhereInput = {
    userId,
    // Always exclude abandoned unless explicitly requested
    status: { not: RoadmapStatus.ABANDONED },
  }

  // Filter by status
  if (status !== 'all') {
    switch (status) {
      case 'active':
        where.isActive = true
        where.status = RoadmapStatus.ACTIVE
        break
      case 'paused':
        where.status = RoadmapStatus.PAUSED
        break
      case 'completed':
        where.status = RoadmapStatus.COMPLETED
        break
    }
  }

  // Search by title or goal
  if (search && search.trim()) {
    const searchTerm = search.trim()
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { goal: { contains: searchTerm, mode: 'insensitive' } },
      { subject: { contains: searchTerm, mode: 'insensitive' } },
    ]
  }

  // Determine sort order
  let orderBy: Prisma.LearningRoadmapOrderByWithRelationInput
  switch (sortBy) {
    case 'oldest':
      orderBy = { createdAt: 'asc' }
      break
    case 'progress':
      // Sort by completion percentage (completedSteps/totalSteps)
      // Prisma doesn't support computed fields, so we'll sort by completedSteps
      orderBy = { completedSteps: 'desc' }
      break
    case 'name':
      orderBy = { title: 'asc' }
      break
    case 'recent':
    default:
      orderBy = { lastActivityAt: 'desc' }
  }

  // Execute queries in parallel for efficiency
  const [roadmaps, total] = await Promise.all([
    prisma.learningRoadmap.findMany({
      where,
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.learningRoadmap.count({ where }),
  ])

  return {
    roadmaps: roadmaps as RoadmapWithSteps[],
    total,
    hasMore: offset + roadmaps.length < total,
  }
}

/**
 * Get roadmap summary (lightweight, without steps)
 * For list views where full step data isn't needed
 */
export async function getRoadmapSummaries(
  userId: string,
  options: { limit?: number; status?: RoadmapStatus } = {}
): Promise<{
  id: string
  title: string
  goal: string
  subject: string | null
  status: RoadmapStatus
  isActive: boolean
  completedSteps: number
  totalSteps: number
  estimatedMinutes: number
  actualMinutesSpent: number
  createdAt: Date
  lastActivityAt: Date
  completedAt: Date | null
}[]> {
  const { limit = 20, status } = options

  const where: Prisma.LearningRoadmapWhereInput = {
    userId,
    status: status || { not: RoadmapStatus.ABANDONED },
  }

  const roadmaps = await prisma.learningRoadmap.findMany({
    where,
    select: {
      id: true,
      title: true,
      goal: true,
      subject: true,
      status: true,
      isActive: true,
      completedSteps: true,
      totalSteps: true,
      estimatedMinutes: true,
      actualMinutesSpent: true,
      createdAt: true,
      lastActivityAt: true,
      completedAt: true,
    },
    orderBy: { lastActivityAt: 'desc' },
    take: limit,
  })

  return roadmaps
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
