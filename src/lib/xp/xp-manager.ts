/**
 * CENTRALIZED XP MANAGEMENT
 *
 * Single source of truth for user XP calculations.
 * Resolves the duplicate XP storage issue by:
 * 1. Using Profile.totalPoints as the canonical total
 * 2. Providing helpers to add XP and sync across tables
 * 3. Calculating level from total XP consistently
 *
 * NOTE: totalPoints is stored on the Profile model, not User model
 *
 * USAGE:
 * ```typescript
 * import { addXp, getUserLevel, syncUserXp } from '@/lib/xp/xp-manager'
 *
 * // Add XP to user (updates Profile.totalPoints)
 * await addXp(userId, 50, 'step_complete', { stepId: '...' })
 *
 * // Get user's current level
 * const level = await getUserLevel(userId)
 *
 * // Sync XP totals if needed (maintenance task)
 * await syncUserXp(userId)
 * ```
 */

import { prisma } from '@/lib/prisma'

// ============================================================================
// Types
// ============================================================================

export interface XpSource {
  type: 'step_complete' | 'quiz_pass' | 'streak_bonus' | 'daily_bonus' | 'arena' | 'flashcard' | 'mission' | 'other'
  metadata?: Record<string, unknown>
}

export interface XpTransaction {
  userId: string
  amount: number
  source: XpSource
  timestamp: Date
}

export interface UserXpSummary {
  totalXp: number
  level: number
  xpToNextLevel: number
  progressPercent: number
  rank?: string
}

// ============================================================================
// Level Calculation
// ============================================================================

/**
 * XP thresholds for each level
 * Uses a progressive curve: each level requires more XP
 */
const LEVEL_THRESHOLDS = [
  0,      // Level 1: 0 XP
  100,    // Level 2: 100 XP
  250,    // Level 3: 250 XP
  500,    // Level 4: 500 XP
  900,    // Level 5: 900 XP
  1500,   // Level 6: 1500 XP
  2300,   // Level 7: 2300 XP
  3500,   // Level 8: 3500 XP
  5000,   // Level 9: 5000 XP
  7000,   // Level 10: 7000 XP
  9500,   // Level 11
  12500,  // Level 12
  16000,  // Level 13
  20000,  // Level 14
  25000,  // Level 15
  31000,  // Level 16
  38000,  // Level 17
  46000,  // Level 18
  55000,  // Level 19
  65000,  // Level 20
] as const

const RANK_NAMES = [
  'Beginner',      // 1-4
  'Learner',       // 5-8
  'Scholar',       // 9-12
  'Expert',        // 13-16
  'Master',        // 17-20
  'Grandmaster',   // 20+
] as const

/**
 * Calculate level from total XP
 * Pure function - no database access
 */
export function calculateLevel(totalXp: number): number {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    } else {
      break
    }
  }
  return level
}

/**
 * Calculate XP needed for next level
 */
export function getXpToNextLevel(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp)
  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    // Max level - use formula for infinite progression
    const baseXp = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
    const extraLevels = currentLevel - LEVEL_THRESHOLDS.length
    const nextThreshold = baseXp + (extraLevels + 1) * 10000
    return nextThreshold - totalXp
  }
  return LEVEL_THRESHOLDS[currentLevel] - totalXp
}

/**
 * Get progress percentage to next level
 */
export function getLevelProgress(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp)
  const currentThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel - 1, LEVEL_THRESHOLDS.length - 1)]
  const nextThreshold = currentLevel < LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[currentLevel]
    : currentThreshold + 10000

  const progress = totalXp - currentThreshold
  const needed = nextThreshold - currentThreshold
  return Math.min(100, Math.round((progress / needed) * 100))
}

/**
 * Get rank name for a level
 */
export function getRankForLevel(level: number): string {
  if (level <= 4) return RANK_NAMES[0]
  if (level <= 8) return RANK_NAMES[1]
  if (level <= 12) return RANK_NAMES[2]
  if (level <= 16) return RANK_NAMES[3]
  if (level <= 20) return RANK_NAMES[4]
  return RANK_NAMES[5]
}

// ============================================================================
// XP Operations
// ============================================================================

/**
 * Add XP to a user
 * This is the ONLY way XP should be added - ensures consistency
 *
 * NOTE: Updates Profile.totalPoints (not User.totalPoints)
 *
 * @param userId - User ID
 * @param amount - XP amount to add
 * @param sourceType - Where the XP came from
 * @param metadata - Additional context
 * @returns Updated XP summary
 */
export async function addXp(
  userId: string,
  amount: number,
  sourceType: XpSource['type'],
  metadata?: Record<string, unknown>
): Promise<UserXpSummary> {
  if (amount <= 0) {
    throw new Error('XP amount must be positive')
  }

  // Update Profile.totalPoints (canonical source - totalPoints is on Profile model)
  const profile = await prisma.profile.update({
    where: { userId },
    data: {
      totalPoints: { increment: amount },
    },
    select: {
      totalPoints: true,
    },
  })

  // Also log to DailyProgress if it exists for today
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    await prisma.dailyProgress.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        xpEarned: { increment: amount },
      },
      create: {
        userId,
        date: today,
        xpEarned: amount,
        targetMinutes: 15, // Default target
        actualMinutes: 0,
        stepsCompleted: 0,
      },
    })
  } catch {
    // DailyProgress table may not exist in all environments
  }

  // Log to GamificationEvent for audit trail
  try {
    await prisma.gamificationEvent.create({
      data: {
        userId,
        eventType: 'xp_earned',
        eventData: {
          source: sourceType,
          ...metadata,
        },
        xpEarned: amount,
        wasVisible: true,
      },
    })
  } catch {
    // GamificationEvent table may not exist
  }

  const totalXp = profile.totalPoints
  return {
    totalXp,
    level: calculateLevel(totalXp),
    xpToNextLevel: getXpToNextLevel(totalXp),
    progressPercent: getLevelProgress(totalXp),
    rank: getRankForLevel(calculateLevel(totalXp)),
  }
}

/**
 * Get user's current XP summary
 * Reads from Profile.totalPoints
 */
export async function getUserXpSummary(userId: string): Promise<UserXpSummary | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { totalPoints: true },
  })

  if (!profile) return null

  const totalXp = profile.totalPoints
  return {
    totalXp,
    level: calculateLevel(totalXp),
    xpToNextLevel: getXpToNextLevel(totalXp),
    progressPercent: getLevelProgress(totalXp),
    rank: getRankForLevel(calculateLevel(totalXp)),
  }
}

/**
 * Get user's level (convenience function)
 */
export async function getUserLevel(userId: string): Promise<number> {
  const summary = await getUserXpSummary(userId)
  return summary?.level ?? 1
}

/**
 * Sync user's total XP from all sources
 * Use this for data migration or fixing inconsistencies
 *
 * Aggregates XP from:
 * - DailyProgress.xpEarned + bonusXp
 * - GamificationEvent.xpEarned
 */
export async function syncUserXp(userId: string): Promise<{
  previousTotal: number
  newTotal: number
  difference: number
}> {
  // Get current total from Profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { totalPoints: true },
  })

  if (!profile) {
    throw new Error('Profile not found')
  }

  const previousTotal = profile.totalPoints

  // Aggregate from DailyProgress
  const dailyXp = await prisma.dailyProgress.aggregate({
    where: { userId },
    _sum: {
      xpEarned: true,
      bonusXp: true,
    },
  })

  const calculatedTotal = (dailyXp._sum.xpEarned || 0) + (dailyXp._sum.bonusXp || 0)

  // Only update if different (use the higher value to not lose progress)
  const newTotal = Math.max(previousTotal, calculatedTotal)

  if (newTotal !== previousTotal) {
    await prisma.profile.update({
      where: { userId },
      data: { totalPoints: newTotal },
    })
  }

  return {
    previousTotal,
    newTotal,
    difference: newTotal - previousTotal,
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Get XP leaderboard
 * Fetches from Profile.totalPoints with user info
 */
export async function getXpLeaderboard(limit = 10): Promise<Array<{
  userId: string
  name: string
  avatarUrl: string | null
  totalXp: number
  level: number
  rank: string
}>> {
  const profiles = await prisma.profile.findMany({
    where: {
      user: {
        deactivatedAt: null,
      },
    },
    orderBy: {
      totalPoints: 'desc',
    },
    take: limit,
    select: {
      userId: true,
      totalPoints: true,
      user: {
        select: {
          name: true,
          avatarUrl: true,
        },
      },
    },
  })

  return profiles.map((profile) => ({
    userId: profile.userId,
    name: profile.user.name,
    avatarUrl: profile.user.avatarUrl,
    totalXp: profile.totalPoints,
    level: calculateLevel(profile.totalPoints),
    rank: getRankForLevel(calculateLevel(profile.totalPoints)),
  }))
}

// ============================================================================
// Export Constants for UI
// ============================================================================

export { LEVEL_THRESHOLDS, RANK_NAMES }
