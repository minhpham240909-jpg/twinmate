/**
 * Arena Weekly Leaderboard API
 *
 * GET /api/arena/leaderboard
 *
 * Returns the top 5 arena players for the current week.
 * Rankings are based on combined score formula.
 * Cached for 1 minute via Redis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheKeys, isRedisAvailable } from '@/lib/redis'
import { getCurrentWeekStart, getCurrentWeekEnd } from '@/lib/arena/scoring'

// Cache TTL: 1 minute
const LEADERBOARD_TTL = 60

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const weekStart = getCurrentWeekStart()
    const weekEnd = getCurrentWeekEnd()

    // Cache key includes week start for automatic invalidation on week change
    const cacheKey = `arena:leaderboard:${weekStart.toISOString().split('T')[0]}`

    // Fetch leaderboard (cached)
    const leaderboardData = await cacheGet(
      cacheKey,
      async () => {
        // Fetch top 5 by combined score
        const stats = await prisma.arenaWeeklyStats.findMany({
          where: {
            weekStart,
          },
          orderBy: {
            combinedScore: 'desc',
          },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        })

        return stats.map((s, index) => ({
          rank: index + 1,
          userId: s.userId,
          userName: s.user.name || 'Player',
          avatarUrl: s.user.avatarUrl,
          totalXP: s.totalXP,
          correctAnswers: s.correctAnswers,
          bestStreak: s.bestStreak,
          combinedScore: s.combinedScore,
          gamesPlayed: s.gamesPlayed,
          gamesWon: s.gamesWon,
        }))
      },
      LEADERBOARD_TTL
    )

    // Get current user's stats if not in top 5
    let currentUser = leaderboardData.find(e => e.userId === user.id)

    if (!currentUser) {
      // Fetch user's stats
      const userStats = await prisma.arenaWeeklyStats.findUnique({
        where: {
          userId_weekStart: {
            userId: user.id,
            weekStart,
          },
        },
        include: {
          user: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
      })

      if (userStats) {
        // Get user's rank
        const higherRanked = await prisma.arenaWeeklyStats.count({
          where: {
            weekStart,
            combinedScore: {
              gt: userStats.combinedScore,
            },
          },
        })

        currentUser = {
          rank: higherRanked + 1,
          userId: userStats.userId,
          userName: userStats.user.name || 'Player',
          avatarUrl: userStats.user.avatarUrl,
          totalXP: userStats.totalXP,
          correctAnswers: userStats.correctAnswers,
          bestStreak: userStats.bestStreak,
          combinedScore: userStats.combinedScore,
          gamesPlayed: userStats.gamesPlayed,
          gamesWon: userStats.gamesWon,
        }
      }
    }

    const totalDuration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      leaderboard: leaderboardData,
      currentUser: currentUser || null,
      _meta: {
        cached: isRedisAvailable(),
        responseTimeMs: totalDuration,
      },
    })
  } catch (error) {
    console.error('[Arena Leaderboard] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    // Return empty leaderboard on error (graceful degradation)
    return NextResponse.json({
      success: true,
      weekStart: getCurrentWeekStart().toISOString(),
      weekEnd: getCurrentWeekEnd().toISOString(),
      leaderboard: [],
      currentUser: null,
      _meta: {
        error: 'Leaderboard temporarily unavailable',
        responseTimeMs: Date.now() - startTime,
      },
    })
  }
}
