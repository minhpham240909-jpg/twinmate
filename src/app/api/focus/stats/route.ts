import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/focus/stats
 * Get live focus session stats for engagement features:
 * - Current active users count
 * - User's current streak
 * - User's percentile rank
 * - Total community sessions today
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Calculate today's date boundaries
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    // Get count of currently active focus sessions (real live users only)
    const liveUsersCount = await prisma.focusSession.count({
      where: {
        status: 'ACTIVE',
        // Session started in last 30 minutes (reasonable active window)
        startedAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
    })

    // Get today's community completed sessions
    const todayCompletedCount = await prisma.focusSession.count({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    })

    // User-specific stats
    let userStreak = 0
    let userTodaySessions = 0
    let userTotalSessions = 0
    let userPercentile = 0
    let activeSession: { id: string; durationMinutes: number; startedAt: string; timeRemaining: number } | null = null

    if (user) {
      // Check for active session first (single query)
      const userActiveSession = await prisma.focusSession.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          durationMinutes: true,
          startedAt: true,
        },
      })

      if (userActiveSession) {
        // Calculate remaining time
        const startTime = new Date(userActiveSession.startedAt).getTime()
        const durationMs = userActiveSession.durationMinutes * 60 * 1000
        const elapsed = Date.now() - startTime
        const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))

        // Only show if there's still time remaining
        if (remainingSeconds > 0) {
          activeSession = {
            id: userActiveSession.id,
            durationMinutes: userActiveSession.durationMinutes,
            startedAt: userActiveSession.startedAt.toISOString(),
            timeRemaining: remainingSeconds,
          }
        }
      }

      // Calculate user's streak (consecutive days with completed sessions)
      userStreak = await calculateStreak(user.id)

      // User's sessions today
      userTodaySessions = await prisma.focusSession.count({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          completedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      })

      // User's total completed sessions
      userTotalSessions = await prisma.focusSession.count({
        where: {
          userId: user.id,
          status: 'COMPLETED',
        },
      })

      // Calculate user's percentile (how they compare to others)
      // Get all users' session counts
      const userSessionCounts = await prisma.focusSession.groupBy({
        by: ['userId'],
        where: {
          status: 'COMPLETED',
        },
        _count: {
          id: true,
        },
      })

      if (userSessionCounts.length > 0) {
        const sortedCounts = userSessionCounts
          .map((u) => u._count.id)
          .sort((a, b) => a - b)

        const userRank = sortedCounts.filter((count) => count <= userTotalSessions).length
        userPercentile = Math.round((userRank / sortedCounts.length) * 100)
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        liveUsersCount,
        todayCompletedCount, // Real data only
        userStreak,
        userTodaySessions,
        userTotalSessions,
        userPercentile,
        activeSession,
      },
    })
  } catch (error) {
    logger.error('Error fetching focus stats', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate user's streak (consecutive days with completed focus sessions)
 */
async function calculateStreak(userId: string): Promise<number> {
  try {
    // Get all completed sessions ordered by date
    const sessions = await prisma.focusSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    })

    if (sessions.length === 0) return 0

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Group sessions by date
    const sessionDates = new Set<string>()
    for (const session of sessions) {
      if (session.completedAt) {
        const date = new Date(session.completedAt)
        date.setHours(0, 0, 0, 0)
        sessionDates.add(date.toISOString())
      }
    }

    // Check consecutive days starting from today or yesterday
    const checkDate = new Date(today)

    // First check if user has done a session today
    const todayStr = today.toISOString()
    if (!sessionDates.has(todayStr)) {
      // Check yesterday - if they did yesterday but not today, they still have a streak
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString()

      if (!sessionDates.has(yesterdayStr)) {
        // No session today or yesterday, streak is broken
        return 0
      }

      // Start counting from yesterday
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Count consecutive days backwards
    while (sessionDates.has(checkDate.toISOString())) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    return streak
  } catch (error) {
    logger.error('Error calculating streak', { userId, error })
    return 0
  }
}
