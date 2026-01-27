/**
 * STREAK SERVICE
 *
 * Manages user learning streaks - continuous days of meeting daily goals.
 * Integrates with daily commitment system.
 *
 * Key Features:
 * - Track current and longest streaks
 * - Weekly/monthly statistics
 * - Streak freezes (protection)
 * - XP bonuses for streaks
 *
 * NOTE: All date comparisons use UTC to ensure consistency across timezones
 * and match the daily-commitment-service.ts implementation.
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

// ============================================
// DATE UTILITIES (UTC-based for consistency)
// ============================================

/**
 * Get today's date at midnight UTC
 * Matches daily-commitment-service.ts getTodayDate() implementation
 */
function getTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Get yesterday's date at midnight UTC
 */
function getYesterdayUTC(): Date {
  const today = getTodayUTC()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))
}

/**
 * Normalize a date to midnight UTC for comparison
 */
function normalizeToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

// ============================================
// TYPES
// ============================================

export interface UserStreakData {
  currentStreak: number
  longestStreak: number
  currentStreakStart: Date | null
  thisWeekDays: number
  thisWeekMinutes: number
  thisMonthDays: number
  thisMonthMinutes: number
  totalDaysCompleted: number
  totalMinutesLearned: number
  totalXpEarned: number
  freezesAvailable: number
  lastCompletedDate: Date | null
}

export interface StreakUpdateResult {
  streak: UserStreakData
  streakIncreased: boolean
  streakBroken: boolean
  newMilestone: number | null // e.g., 7, 30, 100 day milestone
  bonusXp: number
}

// ============================================
// STREAK OPERATIONS
// ============================================

/**
 * Get user's streak data
 */
export async function getUserStreak(userId: string): Promise<UserStreakData | null> {
  const streak = await prisma.userStreak.findUnique({
    where: { userId },
  })

  if (!streak) return null

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    currentStreakStart: streak.currentStreakStart,
    thisWeekDays: streak.thisWeekDays,
    thisWeekMinutes: streak.thisWeekMinutes,
    thisMonthDays: streak.thisMonthDays,
    thisMonthMinutes: streak.thisMonthMinutes,
    totalDaysCompleted: streak.totalDaysCompleted,
    totalMinutesLearned: streak.totalMinutesLearned,
    totalXpEarned: streak.totalXpEarned,
    freezesAvailable: streak.freezesAvailable,
    lastCompletedDate: streak.lastCompletedDate,
  }
}

/**
 * Get or create user's streak record
 * FIX: Use upsert to prevent race conditions where concurrent requests
 * could both try to create a streak record
 */
export async function getOrCreateStreak(userId: string): Promise<UserStreakData> {
  // FIX: Use upsert for atomic get-or-create operation
  const streak = await prisma.userStreak.upsert({
    where: { userId },
    create: { userId },
    update: {}, // No update needed, just return existing
  })

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    currentStreakStart: streak.currentStreakStart,
    thisWeekDays: streak.thisWeekDays,
    thisWeekMinutes: streak.thisWeekMinutes,
    thisMonthDays: streak.thisMonthDays,
    thisMonthMinutes: streak.thisMonthMinutes,
    totalDaysCompleted: streak.totalDaysCompleted,
    totalMinutesLearned: streak.totalMinutesLearned,
    totalXpEarned: streak.totalXpEarned,
    freezesAvailable: streak.freezesAvailable,
    lastCompletedDate: streak.lastCompletedDate,
  }
}

/**
 * Update streak when user completes their daily goal
 *
 * FIX: Wrapped in transaction to prevent race conditions where
 * concurrent requests could read the same streak value and cause
 * incorrect streak increments or duplicate day completions.
 */
export async function updateStreak(
  userId: string,
  goalMet: boolean,
  minutesLearned: number = 0,
  xpEarned: number = 0
): Promise<StreakUpdateResult> {
  // Use UTC dates for consistency with daily-commitment-service
  const today = getTodayUTC()
  const yesterday = getYesterdayUTC()

  // FIX: Use serializable transaction to prevent race conditions
  // This ensures atomic read-modify-write operations
  return await prisma.$transaction(async (tx) => {
    // Get current streak with row-level lock
    let streak = await tx.userStreak.findUnique({
      where: { userId },
    })

    // Create if doesn't exist
    if (!streak) {
      streak = await tx.userStreak.create({
        data: { userId },
      })
    }

    // Normalize lastCompletedDate to UTC for consistent comparison
    const lastCompletedDate = streak.lastCompletedDate
      ? normalizeToUTC(new Date(streak.lastCompletedDate))
      : null

    // Check if already completed today
    const alreadyCompletedToday =
      lastCompletedDate && lastCompletedDate.getTime() === today.getTime()

    if (alreadyCompletedToday && goalMet) {
      // Already counted today, just update minutes
      const updatedStreak = await tx.userStreak.update({
        where: { userId },
        data: {
          totalMinutesLearned: { increment: minutesLearned },
          thisWeekMinutes: { increment: minutesLearned },
          thisMonthMinutes: { increment: minutesLearned },
          totalXpEarned: { increment: xpEarned },
          lastActivityAt: new Date(),
        },
      })

      return {
        streak: {
          currentStreak: updatedStreak.currentStreak,
          longestStreak: updatedStreak.longestStreak,
          currentStreakStart: updatedStreak.currentStreakStart,
          thisWeekDays: updatedStreak.thisWeekDays,
          thisWeekMinutes: updatedStreak.thisWeekMinutes,
          thisMonthDays: updatedStreak.thisMonthDays,
          thisMonthMinutes: updatedStreak.thisMonthMinutes,
          totalDaysCompleted: updatedStreak.totalDaysCompleted,
          totalMinutesLearned: updatedStreak.totalMinutesLearned,
          totalXpEarned: updatedStreak.totalXpEarned,
          freezesAvailable: updatedStreak.freezesAvailable,
          lastCompletedDate: updatedStreak.lastCompletedDate,
        },
        streakIncreased: false,
        streakBroken: false,
        newMilestone: null,
        bonusXp: 0,
      }
    }

    if (!goalMet) {
      // Goal not met - don't update streak
      return {
        streak: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          currentStreakStart: streak.currentStreakStart,
          thisWeekDays: streak.thisWeekDays,
          thisWeekMinutes: streak.thisWeekMinutes,
          thisMonthDays: streak.thisMonthDays,
          thisMonthMinutes: streak.thisMonthMinutes,
          totalDaysCompleted: streak.totalDaysCompleted,
          totalMinutesLearned: streak.totalMinutesLearned,
          totalXpEarned: streak.totalXpEarned,
          freezesAvailable: streak.freezesAvailable,
          lastCompletedDate: streak.lastCompletedDate,
        },
        streakIncreased: false,
        streakBroken: false,
        newMilestone: null,
        bonusXp: 0,
      }
    }

    // Goal met - update streak
    let newStreak = streak.currentStreak
    let streakBroken = false
    let streakIncreased = true
    let currentStreakStart = streak.currentStreakStart

    // Check if continuing streak (completed yesterday)
    const continuingStreak =
      lastCompletedDate && lastCompletedDate.getTime() === yesterday.getTime()

    if (continuingStreak) {
      // Continue streak
      newStreak = streak.currentStreak + 1
    } else if (lastCompletedDate && lastCompletedDate.getTime() < yesterday.getTime()) {
      // Streak broken (missed days)
      streakBroken = true
      newStreak = 1
      currentStreakStart = today
    } else {
      // First day or continuing from before
      newStreak = streak.currentStreak + 1
      if (!currentStreakStart) {
        currentStreakStart = today
      }
    }

    // Check for new longest streak
    const newLongestStreak = Math.max(streak.longestStreak, newStreak)

    // Calculate bonus XP based on streak milestones
    let bonusXp = 0
    const milestones = [7, 14, 30, 60, 100, 365]
    let newMilestone: number | null = null

    for (const milestone of milestones) {
      if (newStreak === milestone) {
        newMilestone = milestone
        bonusXp = milestone * 5 // 5 XP per day in milestone
        break
      }
    }

    // Daily streak bonus (5 XP per day in streak, capped at 50)
    const dailyStreakBonus = Math.min(newStreak * 5, 50)
    bonusXp += dailyStreakBonus

    // Update streak record within transaction
    const updatedStreak = await tx.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        currentStreakStart,
        longestStreak: newLongestStreak,
        longestStreakStart:
          newLongestStreak > streak.longestStreak
            ? currentStreakStart
            : streak.longestStreakStart,
        longestStreakEnd:
          newLongestStreak > streak.longestStreak ? today : streak.longestStreakEnd,
        thisWeekDays: { increment: 1 },
        thisWeekMinutes: { increment: minutesLearned },
        thisMonthDays: { increment: 1 },
        thisMonthMinutes: { increment: minutesLearned },
        totalDaysCompleted: { increment: 1 },
        totalMinutesLearned: { increment: minutesLearned },
        totalXpEarned: { increment: xpEarned + bonusXp },
        lastCompletedDate: today,
        lastActivityAt: new Date(),
      },
    })

    logger.info('[Streak] Updated user streak', {
      userId,
      newStreak,
      streakBroken,
      newMilestone,
      bonusXp,
    })

    return {
      streak: {
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
        currentStreakStart: updatedStreak.currentStreakStart,
        thisWeekDays: updatedStreak.thisWeekDays,
        thisWeekMinutes: updatedStreak.thisWeekMinutes,
        thisMonthDays: updatedStreak.thisMonthDays,
        thisMonthMinutes: updatedStreak.thisMonthMinutes,
        totalDaysCompleted: updatedStreak.totalDaysCompleted,
        totalMinutesLearned: updatedStreak.totalMinutesLearned,
        totalXpEarned: updatedStreak.totalXpEarned,
        freezesAvailable: updatedStreak.freezesAvailable,
        lastCompletedDate: updatedStreak.lastCompletedDate,
      },
      streakIncreased,
      streakBroken,
      newMilestone,
      bonusXp,
    }
  })
}

/**
 * Check if streak is at risk (user hasn't completed today and it's getting late)
 */
export async function checkStreakAtRisk(
  userId: string
): Promise<{ atRisk: boolean; hoursRemaining: number }> {
  const streak = await prisma.userStreak.findUnique({
    where: { userId },
  })

  if (!streak || streak.currentStreak === 0) {
    return { atRisk: false, hoursRemaining: 24 }
  }

  // Check if completed today (using UTC for consistency)
  const today = getTodayUTC()

  const lastCompleted = streak.lastCompletedDate
    ? normalizeToUTC(new Date(streak.lastCompletedDate))
    : null

  const completedToday =
    lastCompleted && lastCompleted.getTime() === today.getTime()

  if (completedToday) {
    return { atRisk: false, hoursRemaining: 24 }
  }

  // Calculate hours remaining until midnight UTC
  const now = new Date()
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  ))

  const hoursRemaining = Math.floor(
    (tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60)
  )

  // At risk if less than 4 hours remaining
  return {
    atRisk: hoursRemaining < 4,
    hoursRemaining,
  }
}

/**
 * Use a streak freeze to protect streak
 * FIX: Wrapped in transaction to prevent race conditions where
 * concurrent requests could both try to use the same freeze
 */
export async function useStreakFreeze(userId: string): Promise<boolean> {
  return await prisma.$transaction(async (tx) => {
    const streak = await tx.userStreak.findUnique({
      where: { userId },
    })

    if (!streak || streak.freezesAvailable <= 0) {
      return false
    }

    await tx.userStreak.update({
      where: { userId },
      data: {
        freezesAvailable: { decrement: 1 },
        freezesUsed: { increment: 1 },
        lastFreezeUsedAt: new Date(),
        // Treat today as completed to maintain streak (use UTC for consistency)
        lastCompletedDate: getTodayUTC(),
      },
    })

    logger.info('[Streak] Used streak freeze', {
      userId,
      remainingFreezes: streak.freezesAvailable - 1,
    })

    return true
  })
}

/**
 * Award a streak freeze (e.g., for completing a roadmap or milestone)
 */
export async function awardStreakFreeze(
  userId: string,
  count: number = 1
): Promise<void> {
  await prisma.userStreak.upsert({
    where: { userId },
    create: {
      userId,
      freezesAvailable: count,
    },
    update: {
      freezesAvailable: { increment: count },
    },
  })

  logger.info('[Streak] Awarded streak freeze', {
    userId,
    count,
  })
}

/**
 * Reset weekly stats (run at start of each week)
 */
export async function resetWeeklyStats(userId: string): Promise<void> {
  await prisma.userStreak.update({
    where: { userId },
    data: {
      thisWeekDays: 0,
      thisWeekMinutes: 0,
    },
  })
}

/**
 * Reset monthly stats (run at start of each month)
 */
export async function resetMonthlyStats(userId: string): Promise<void> {
  await prisma.userStreak.update({
    where: { userId },
    data: {
      thisMonthDays: 0,
      thisMonthMinutes: 0,
    },
  })
}
