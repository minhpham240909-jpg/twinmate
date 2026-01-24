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
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheDelete, CacheTTL, CacheKeys } from '@/lib/redis'
import {
  MILESTONES,
  checkNewMilestones,
  calculateXpProgress,
  getNextMilestone,
  type MilestoneDefinition,
} from '@/lib/milestones'

// Extend CacheKeys if not already there
const MILESTONE_CACHE_KEY = (userId: string) => `user:milestones:${userId}`

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
export async function GET() {
  try {
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

        // Map earned badges to our milestone IDs
        const earnedMilestoneIds = earnedBadges
          .map(b => {
            // Find matching milestone by badge name
            const milestone = MILESTONES.find(m => m.name === b.badge.name)
            return milestone?.id
          })
          .filter((id): id is string => !!id)

        // Build earned milestones with definitions
        const earnedMilestones = earnedBadges
          .map(badge => {
            const milestone = MILESTONES.find(m => m.name === badge.badge.name)
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
        const milestone = MILESTONES.find(m => m.name === b.badge.name)
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

    // Award new milestones - use transaction
    let totalXpBonus = 0
    const awardedMilestones: MilestoneDefinition[] = []

    await prisma.$transaction(async (tx) => {
      for (const milestone of newMilestones) {
        // Find or create badge
        let badge = await tx.badge.findUnique({
          where: { name: milestone.name },
        })

        if (!badge) {
          // Create badge if it doesn't exist
          badge = await tx.badge.create({
            data: {
              name: milestone.name,
              description: milestone.description,
              type: milestone.category === 'streak' ? 'STUDY_STREAK' :
                    milestone.category === 'xp' ? 'HOURS_LOGGED' :
                    milestone.category === 'sessions' ? 'QUIZZES_PASSED' : 'SPECIAL',
              iconUrl: milestone.icon,
              requirement: milestone.requirement,
            },
          })
        }

        // Check if already earned (race condition protection)
        const existing = await tx.userBadge.findFirst({
          where: {
            userId: user.id,
            badgeId: badge.id,
          },
        })

        if (!existing) {
          // Award badge
          await tx.userBadge.create({
            data: {
              userId: user.id,
              badgeId: badge.id,
            },
          })

          totalXpBonus += milestone.xpBonus
          awardedMilestones.push(milestone)
        }
      }

      // Award bonus XP
      if (totalXpBonus > 0) {
        await tx.profile.update({
          where: { userId: user.id },
          data: {
            totalPoints: { increment: totalXpBonus },
          },
        })
      }
    })

    // Invalidate cache
    await cacheDelete(MILESTONE_CACHE_KEY(user.id))
    await cacheDelete(CacheKeys.USER_STATS(user.id))

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
