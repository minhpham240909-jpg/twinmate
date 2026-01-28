/**
 * User Milestones API
 *
 * GET: Fetch user's earned milestones and progress
 * POST: Check and award new milestones
 *
 * Performance:
 * - Single query with includes (no N+1)
 * - Redis caching for 5 minutes
 * - Lightweight response
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheDelete, CacheTTL, CacheKeys } from '@/lib/redis'
import { addXp } from '@/lib/xp/xp-manager'
import {
  MILESTONES,
  checkNewMilestones,
  calculateXpProgress,
  getNextMilestone,
  type MilestoneDefinition,
} from '@/lib/milestones'
// Note: We removed badge/XP push notifications
// They don't align with guidance-focused notification philosophy
// Badges are shown in-app via the celebration modal instead

// Extend CacheKeys if not already there
const MILESTONE_CACHE_KEY = (userId: string) => `user:milestones:${userId}`

// Pre-compute milestone lookup map for O(1) access instead of O(n) find()
const MILESTONES_BY_NAME = new Map(MILESTONES.map(m => [m.name, m]))

interface MilestoneResponse {
  success: boolean
  earnedMilestones: {
    id: string
    definitionId: string
    earnedAt: string
    definition: MilestoneDefinition
  }[]
  xpProgress: {
    currentLevel: number
    xpForCurrentLevel: number
    xpForNextLevel: number
    progressPercent: number
    xpNeeded: number
    totalXp: number
  }
  nextMilestones: {
    streak: MilestoneDefinition | null
    xp: MilestoneDefinition | null
    sessions: MilestoneDefinition | null
  }
  stats: {
    streak: number
    totalXp: number
    totalSessions: number
  }
  streakShields: number
}

/**
 * GET /api/user/milestones
 * Fetch user's milestones and progress
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for milestones (results are cached)
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try cache first
    const cacheKey = MILESTONE_CACHE_KEY(user.id)
    const cached = await cacheGet<MilestoneResponse>(
      cacheKey,
      async () => {
        // Single query with all needed data - no N+1
        const [profile, earnedBadges] = await Promise.all([
          prisma.profile.findUnique({
            where: { userId: user.id },
            select: {
              totalPoints: true,
              quickFocusStreak: true,
              soloStudyStreak: true,
              // For streak shields - check UserUnlock for streak_shield type
            },
          }),
          prisma.userBadge.findMany({
            where: { userId: user.id },
            select: {
              id: true,
              earnedAt: true,
              badge: {
                select: {
                  name: true,
                },
              },
            },
          }),
        ])

        if (!profile) {
          throw new Error('Profile not found')
        }

        // Get streak shields count
        const streakShieldUnlock = await prisma.userUnlock.findFirst({
          where: {
            userId: user.id,
            unlockable: {
              category: 'STREAK_SHIELD',
            },
          },
          select: {
            quantity: true,
          },
        })

        const streak = Math.max(profile.quickFocusStreak || 0, profile.soloStudyStreak || 0)
        const totalXp = profile.totalPoints || 0

        // Count sessions from guide-me interactions (approximate from XP)
        // Each guide-me action gives 10 XP
        const totalSessions = Math.floor(totalXp / 10)

        // Map earned badges to our milestone IDs (O(1) lookup via Map)
        const earnedMilestoneIds = earnedBadges
          .map(b => {
            // O(1) lookup instead of O(n) find()
            const milestone = MILESTONES_BY_NAME.get(b.badge.name)
            return milestone?.id
          })
          .filter((id): id is string => !!id)

        // Build earned milestones with definitions (O(1) lookup via Map)
        const earnedMilestones = earnedBadges
          .map(badge => {
            const milestone = MILESTONES_BY_NAME.get(badge.badge.name)
            if (!milestone) return null
            return {
              id: badge.id,
              definitionId: milestone.id,
              earnedAt: badge.earnedAt.toISOString(),
              definition: milestone,
            }
          })
          .filter((m): m is NonNullable<typeof m> => m !== null)

        // Calculate XP progress
        const xpProgress = {
          ...calculateXpProgress(totalXp),
          totalXp,
        }

        // Get next milestones for each category
        const nextMilestones = {
          streak: getNextMilestone('streak', streak, earnedMilestoneIds),
          xp: getNextMilestone('xp', totalXp, earnedMilestoneIds),
          sessions: getNextMilestone('sessions', totalSessions, earnedMilestoneIds),
        }

        return {
          success: true,
          earnedMilestones,
          xpProgress,
          nextMilestones,
          stats: {
            streak,
            totalXp,
            totalSessions,
          },
          streakShields: streakShieldUnlock?.quantity || 0,
        }
      },
      CacheTTL.USER_STATS // 5 minutes
    )

    return NextResponse.json(cached)
  } catch (error) {
    console.error('[Milestones API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/milestones
 * Check and award new milestones after an action
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - moderate for milestone checks
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { actionType } = body as { actionType?: 'explain' | 'flashcard' | 'guide' }

    // Get current stats in single query
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        totalPoints: true,
        quickFocusStreak: true,
        soloStudyStreak: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get already earned badges
    const earnedBadges = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: {
        badge: {
          select: { name: true },
        },
      },
    })

    const earnedMilestoneIds = earnedBadges
      .map(b => {
        const milestone = MILESTONES_BY_NAME.get(b.badge.name)
        return milestone?.id
      })
      .filter((id): id is string => !!id)

    const streak = Math.max(profile.quickFocusStreak || 0, profile.soloStudyStreak || 0)
    const totalXp = profile.totalPoints || 0
    const totalSessions = Math.floor(totalXp / 10)

    // Check for new milestones
    const newMilestones = checkNewMilestones(
      {
        streak,
        totalXp,
        totalSessions,
        hasExplainPack: actionType === 'explain' || totalSessions > 0,
        hasFlashcard: actionType === 'flashcard' || totalSessions > 0,
        hasGuide: actionType === 'guide' || totalSessions > 0,
      },
      earnedMilestoneIds
    )

    if (newMilestones.length === 0) {
      return NextResponse.json({
        success: true,
        newMilestones: [],
        xpAwarded: 0,
      })
    }

    // Award new milestones - use transaction with batched operations
    let totalXpBonus = 0
    const awardedMilestones: MilestoneDefinition[] = []

    await prisma.$transaction(async (tx) => {
      // 1. Batch fetch all badges at once (avoiding N+1)
      const milestoneNames = newMilestones.map(m => m.name)
      const existingBadges = await tx.badge.findMany({
        where: { name: { in: milestoneNames } },
      })
      const badgesByName = new Map(existingBadges.map(b => [b.name, b]))

      // 2. Create missing badges in parallel
      const missingMilestones = newMilestones.filter(m => !badgesByName.has(m.name))
      if (missingMilestones.length > 0) {
        await tx.badge.createMany({
          data: missingMilestones.map(milestone => ({
            name: milestone.name,
            description: milestone.description,
            type: milestone.category === 'streak' ? 'STUDY_STREAK' :
                  milestone.category === 'xp' ? 'HOURS_LOGGED' :
                  milestone.category === 'sessions' ? 'QUIZZES_PASSED' : 'SPECIAL',
            iconUrl: milestone.icon,
            requirement: milestone.requirement,
          })),
          skipDuplicates: true,
        })

        // Refetch to get the newly created badges
        const newlyCreatedBadges = await tx.badge.findMany({
          where: { name: { in: missingMilestones.map(m => m.name) } },
        })
        newlyCreatedBadges.forEach(b => badgesByName.set(b.name, b))
      }

      // 3. Get all badge IDs for the milestones
      const badgeIds = newMilestones
        .map(m => badgesByName.get(m.name)?.id)
        .filter((id): id is string => !!id)

      // 4. Batch check which badges user already has (avoiding N+1)
      const existingUserBadges = await tx.userBadge.findMany({
        where: {
          userId: user.id,
          badgeId: { in: badgeIds },
        },
        select: { badgeId: true },
      })
      const earnedBadgeIds = new Set(existingUserBadges.map(ub => ub.badgeId))

      // 5. Create user badges for ones not yet earned
      const badgesToAward = newMilestones.filter(m => {
        const badge = badgesByName.get(m.name)
        return badge && !earnedBadgeIds.has(badge.id)
      })

      if (badgesToAward.length > 0) {
        await tx.userBadge.createMany({
          data: badgesToAward.map(m => ({
            userId: user.id,
            badgeId: badgesByName.get(m.name)!.id,
          })),
          skipDuplicates: true,
        })

        // Track awarded milestones and XP bonus
        badgesToAward.forEach(milestone => {
          totalXpBonus += milestone.xpBonus
          awardedMilestones.push(milestone)
        })
      }
    })

    // Award bonus XP using centralized XP manager (outside transaction for proper logging)
    if (totalXpBonus > 0) {
      await addXp(user.id, totalXpBonus, 'mission', {
        action: 'milestone_bonus',
        milestones: awardedMilestones.map(m => m.name),
        milestoneCount: awardedMilestones.length,
      })
    }

    // Invalidate cache
    await cacheDelete(MILESTONE_CACHE_KEY(user.id))
    await cacheDelete(CacheKeys.USER_STATS(user.id))

    // Note: We don't send push notifications for badges/XP milestones
    // These are gamification features that don't align with our guidance philosophy
    // Badges are celebrated in-app via the celebration modal instead

    return NextResponse.json({
      success: true,
      newMilestones: awardedMilestones,
      xpAwarded: totalXpBonus,
    })
  } catch (error) {
    console.error('[Milestones API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to check milestones' },
      { status: 500 }
    )
  }
}
