/**
 * DAILY COMMITMENT SERVICE
 *
 * Manages user's daily learning commitment and progress tracking.
 * Core service for the engagement system.
 *
 * Key Features:
 * - Set/update daily commitment (minutes per day)
 * - Track daily progress
 * - Calculate if daily goal is met
 * - Integrate with streak system
 *
 * N+1 Prevention:
 * - Uses Prisma's include for related data
 * - Batches updates where possible
 * - Uses transactions for consistency
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

// ============================================
// TYPES
// ============================================

export interface DailyCommitmentSettings {
  dailyMinutes: number
  preferredStartTime?: string
  preferredEndTime?: string
  preferredDays?: string[]
  reminderEnabled?: boolean
  reminderTime?: string
  weekendMode?: 'SAME' | 'REDUCED' | 'OFF'
}

export interface DailyProgressData {
  id: string
  date: Date
  targetMinutes: number
  actualMinutes: number
  goalMet: boolean
  stepsCompleted: number
  capturesCreated: number
  reviewsCompleted: number
  xpEarned: number
  bonusXp: number
  firstActivityAt: Date | null
  lastActivityAt: Date | null
}

export interface TodayProgress {
  commitment: {
    dailyMinutes: number
    reminderEnabled: boolean
  } | null
  progress: DailyProgressData | null
  percentComplete: number
  minutesRemaining: number
  goalMet: boolean
}

export interface WeekProgress {
  days: Array<{
    date: Date
    goalMet: boolean
    actualMinutes: number
    targetMinutes: number
  }>
  daysCompleted: number
  totalDays: number
  totalMinutes: number
}

// ============================================
// COMMITMENT SETTINGS
// ============================================

/**
 * Get user's daily commitment settings
 */
export async function getDailyCommitment(userId: string) {
  const commitment = await prisma.dailyCommitment.findUnique({
    where: { userId },
  })

  return commitment
}

/**
 * Set or update user's daily commitment
 */
export async function setDailyCommitment(
  userId: string,
  settings: DailyCommitmentSettings
) {
  const { dailyMinutes, ...rest } = settings

  // Validate daily minutes
  const validMinutes = [5, 15, 30, 45, 60]
  if (!validMinutes.includes(dailyMinutes)) {
    throw new Error(`Daily minutes must be one of: ${validMinutes.join(', ')}`)
  }

  const commitment = await prisma.dailyCommitment.upsert({
    where: { userId },
    create: {
      userId,
      dailyMinutes,
      ...rest,
    },
    update: {
      dailyMinutes,
      ...rest,
    },
  })

  logger.info('[Commitment] Updated daily commitment', {
    userId,
    dailyMinutes,
  })

  return commitment
}

// ============================================
// DAILY PROGRESS TRACKING
// ============================================

/**
 * Get today's date in user's timezone (or UTC)
 */
function getTodayDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

/**
 * Get or create today's progress record
 * FIX: Use upsert for atomic get-or-create to prevent race conditions
 */
export async function getOrCreateTodayProgress(
  userId: string
): Promise<DailyProgressData> {
  const today = getTodayDate()

  // Get user's commitment to know target
  const commitment = await prisma.dailyCommitment.findUnique({
    where: { userId },
  })

  const targetMinutes = commitment?.dailyMinutes || 15

  // FIX: Use upsert for atomic get-or-create operation
  const progress = await prisma.dailyProgress.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    create: {
      userId,
      date: today,
      targetMinutes,
    },
    update: {}, // No update needed, just return existing
  })

  return progress as DailyProgressData
}

/**
 * Get today's progress with commitment info
 */
export async function getTodayProgress(userId: string): Promise<TodayProgress> {
  const today = getTodayDate()

  // Fetch both in parallel (N+1 prevention)
  const [commitment, progress] = await Promise.all([
    prisma.dailyCommitment.findUnique({
      where: { userId },
    }),
    prisma.dailyProgress.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    }),
  ])

  const targetMinutes = commitment?.dailyMinutes || 15
  const actualMinutes = progress?.actualMinutes || 0
  const goalMet = actualMinutes >= targetMinutes

  return {
    commitment: commitment
      ? {
          dailyMinutes: commitment.dailyMinutes,
          reminderEnabled: commitment.reminderEnabled,
        }
      : null,
    progress: progress as DailyProgressData | null,
    percentComplete: Math.min(100, Math.round((actualMinutes / targetMinutes) * 100)),
    minutesRemaining: Math.max(0, targetMinutes - actualMinutes),
    goalMet,
  }
}

/**
 * Record learning activity time
 */
export async function recordLearningTime(
  userId: string,
  minutesSpent: number,
  options: {
    roadmapId?: string
    stepCompleted?: boolean
    xpEarned?: number
  } = {}
): Promise<{ progress: DailyProgressData; goalJustMet: boolean }> {
  const today = getTodayDate()

  // Get current progress and commitment in parallel
  const [commitment, existingProgress] = await Promise.all([
    prisma.dailyCommitment.findUnique({ where: { userId } }),
    prisma.dailyProgress.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
  ])

  const targetMinutes = commitment?.dailyMinutes || 15
  const wasGoalMet = existingProgress?.goalMet || false
  const previousMinutes = existingProgress?.actualMinutes || 0
  const newTotalMinutes = previousMinutes + minutesSpent

  // Check if goal is now met
  const goalNowMet = newTotalMinutes >= targetMinutes
  const goalJustMet = !wasGoalMet && goalNowMet

  // Update or create progress
  const progress = await prisma.dailyProgress.upsert({
    where: {
      userId_date: { userId, date: today },
    },
    create: {
      userId,
      date: today,
      targetMinutes,
      actualMinutes: minutesSpent,
      goalMet: goalNowMet,
      stepsCompleted: options.stepCompleted ? 1 : 0,
      xpEarned: options.xpEarned || 0,
      activeRoadmapId: options.roadmapId,
      firstActivityAt: new Date(),
      lastActivityAt: new Date(),
    },
    update: {
      actualMinutes: { increment: minutesSpent },
      goalMet: goalNowMet,
      stepsCompleted: options.stepCompleted
        ? { increment: 1 }
        : undefined,
      xpEarned: options.xpEarned
        ? { increment: options.xpEarned }
        : undefined,
      activeRoadmapId: options.roadmapId || undefined,
      lastActivityAt: new Date(),
      firstActivityAt: existingProgress?.firstActivityAt || new Date(),
    },
  })

  logger.info('[Commitment] Recorded learning time', {
    userId,
    minutesSpent,
    totalMinutes: progress.actualMinutes,
    goalMet: progress.goalMet,
    goalJustMet,
  })

  return {
    progress: progress as DailyProgressData,
    goalJustMet,
  }
}

/**
 * Record a step completion
 */
export async function recordStepCompletion(
  userId: string,
  stepId: string,
  roadmapId: string,
  minutesSpent: number,
  xpEarned: number = 10
): Promise<{ progress: DailyProgressData; goalJustMet: boolean }> {
  return recordLearningTime(userId, minutesSpent, {
    roadmapId,
    stepCompleted: true,
    xpEarned,
  })
}

/**
 * Record a capture creation
 */
export async function recordCapture(userId: string): Promise<void> {
  const today = getTodayDate()

  await prisma.dailyProgress.upsert({
    where: {
      userId_date: { userId, date: today },
    },
    create: {
      userId,
      date: today,
      targetMinutes: 15, // Default, will be overwritten on first learning
      capturesCreated: 1,
      lastActivityAt: new Date(),
    },
    update: {
      capturesCreated: { increment: 1 },
      lastActivityAt: new Date(),
    },
  })
}

/**
 * Record a review completion
 */
export async function recordReview(userId: string): Promise<void> {
  const today = getTodayDate()

  await prisma.dailyProgress.upsert({
    where: {
      userId_date: { userId, date: today },
    },
    create: {
      userId,
      date: today,
      targetMinutes: 15,
      reviewsCompleted: 1,
      lastActivityAt: new Date(),
    },
    update: {
      reviewsCompleted: { increment: 1 },
      lastActivityAt: new Date(),
    },
  })
}

// ============================================
// WEEK PROGRESS
// ============================================

/**
 * Get this week's progress
 */
export async function getWeekProgress(userId: string): Promise<WeekProgress> {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday

  // Calculate start of week (Monday)
  const startOfWeek = new Date(today)
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  startOfWeek.setDate(today.getDate() - daysToSubtract)
  startOfWeek.setHours(0, 0, 0, 0)

  // Calculate end of week (Sunday)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // Get all progress records for this week
  const progressRecords = await prisma.dailyProgress.findMany({
    where: {
      userId,
      date: {
        gte: startOfWeek,
        lte: endOfWeek,
      },
    },
    orderBy: { date: 'asc' },
  })

  // Get user's commitment for target
  const commitment = await prisma.dailyCommitment.findUnique({
    where: { userId },
  })

  const targetMinutes = commitment?.dailyMinutes || 15

  // Build week array
  const days: WeekProgress['days'] = []
  let daysCompleted = 0
  let totalMinutes = 0

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)

    const dayProgress = progressRecords.find(
      (p) => p.date.toDateString() === date.toDateString()
    )

    const actualMinutes = dayProgress?.actualMinutes || 0
    const goalMet = actualMinutes >= targetMinutes

    if (goalMet) daysCompleted++
    totalMinutes += actualMinutes

    days.push({
      date,
      goalMet,
      actualMinutes,
      targetMinutes,
    })
  }

  return {
    days,
    daysCompleted,
    totalDays: 7,
    totalMinutes,
  }
}

// ============================================
// CALENDAR DATA
// ============================================

/**
 * Get calendar data for a month
 */
export async function getMonthProgress(
  userId: string,
  year: number,
  month: number // 1-indexed (1 = January) for API consistency
): Promise<
  Array<{
    date: Date
    goalMet: boolean
    actualMinutes: number
    targetMinutes: number
    stepsCompleted: number
    capturesCreated: number
  }>
> {
  // Convert to 0-indexed for Date constructor
  const monthIndex = month - 1
  const startDate = new Date(Date.UTC(year, monthIndex, 1))
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0)) // Last day of month

  // Get all progress records for this month
  const progressRecords = await prisma.dailyProgress.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  })

  // Get user's commitment
  const commitment = await prisma.dailyCommitment.findUnique({
    where: { userId },
  })

  const targetMinutes = commitment?.dailyMinutes || 15

  // Build month array
  const days: Array<{
    date: Date
    goalMet: boolean
    actualMinutes: number
    targetMinutes: number
    stepsCompleted: number
    capturesCreated: number
  }> = []

  const daysInMonth = endDate.getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, monthIndex, day))
    const dayProgress = progressRecords.find(
      (p) => p.date.getDate() === day
    )

    const actualMinutes = dayProgress?.actualMinutes || 0
    const goalMet = dayProgress?.goalMet || false
    const stepsCompleted = dayProgress?.stepsCompleted || 0
    const capturesCreated = dayProgress?.capturesCreated || 0

    days.push({
      date,
      goalMet,
      actualMinutes,
      targetMinutes,
      stepsCompleted,
      capturesCreated,
    })
  }

  return days
}

// ============================================
// SCHEDULED SESSIONS
// ============================================

/**
 * Get today's scheduled sessions
 */
export async function getTodayScheduledSessions(userId: string) {
  const today = getTodayDate()

  const sessions = await prisma.scheduledSession.findMany({
    where: {
      userId,
      scheduledDate: today,
    },
    orderBy: { scheduledTime: 'asc' },
  })

  return sessions
}

/**
 * Get upcoming scheduled sessions (next 7 days)
 */
export async function getUpcomingSessions(userId: string, days: number = 7) {
  const today = getTodayDate()
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + days)

  const sessions = await prisma.scheduledSession.findMany({
    where: {
      userId,
      scheduledDate: {
        gte: today,
        lte: endDate,
      },
      status: 'SCHEDULED',
    },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
  })

  return sessions
}

/**
 * Create a scheduled session
 */
export async function createScheduledSession(
  userId: string,
  data: {
    roadmapId?: string
    stepId?: string
    title: string
    description?: string
    scheduledDate: Date
    scheduledTime?: string
    durationMinutes?: number
  }
) {
  const session = await prisma.scheduledSession.create({
    data: {
      userId,
      roadmapId: data.roadmapId,
      stepId: data.stepId,
      title: data.title,
      description: data.description,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      durationMinutes: data.durationMinutes || 15,
    },
  })

  return session
}

/**
 * Auto-schedule roadmap steps based on daily commitment
 */
export async function autoScheduleRoadmap(
  userId: string,
  roadmapId: string,
  startDate?: Date
): Promise<number> {
  // Get roadmap with steps
  const roadmap = await prisma.learningRoadmap.findUnique({
    where: { id: roadmapId },
    include: {
      steps: {
        where: {
          status: { in: ['LOCKED', 'CURRENT'] },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!roadmap || roadmap.userId !== userId) {
    throw new Error('Roadmap not found')
  }

  // Get user's commitment
  const commitment = await prisma.dailyCommitment.findUnique({
    where: { userId },
  })

  const dailyMinutes = commitment?.dailyMinutes || 15
  const preferredDays = commitment?.preferredDays || [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]

  // Start scheduling from tomorrow (or provided date)
  let currentDate = startDate || new Date()
  if (!startDate) {
    currentDate.setDate(currentDate.getDate() + 1)
  }
  currentDate.setHours(0, 0, 0, 0)

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  let sessionsCreated = 0
  let stepIndex = 0
  let remainingMinutesInDay = dailyMinutes

  // Delete existing scheduled sessions for this roadmap
  await prisma.scheduledSession.deleteMany({
    where: {
      userId,
      roadmapId,
      status: 'SCHEDULED',
    },
  })

  // Schedule each step
  while (stepIndex < roadmap.steps.length) {
    const step = roadmap.steps[stepIndex]
    const dayName = dayNames[currentDate.getDay()]

    // Skip days not in preferred days
    if (!preferredDays.includes(dayName)) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    // Check if step fits in remaining time
    if (step.duration <= remainingMinutesInDay) {
      // Create scheduled session
      await prisma.scheduledSession.create({
        data: {
          userId,
          roadmapId,
          stepId: step.id,
          title: step.title,
          description: step.description,
          scheduledDate: new Date(currentDate),
          durationMinutes: step.duration,
        },
      })

      sessionsCreated++
      remainingMinutesInDay -= step.duration
      stepIndex++

      // Move to next day if no time left
      if (remainingMinutesInDay < 5) {
        currentDate.setDate(currentDate.getDate() + 1)
        remainingMinutesInDay = dailyMinutes
      }
    } else {
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      remainingMinutesInDay = dailyMinutes
    }
  }

  logger.info('[Commitment] Auto-scheduled roadmap', {
    userId,
    roadmapId,
    sessionsCreated,
    stepsScheduled: roadmap.steps.length,
  })

  return sessionsCreated
}
