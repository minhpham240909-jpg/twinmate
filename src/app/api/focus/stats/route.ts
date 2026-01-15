import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/focus/stats
 * Get live focus session stats for engagement features:
 * - Current active users count
 * - User's current streak (from stored profile field)
 * - User's percentile rank (simplified)
 * - Total community sessions today
 *
 * OPTIMIZED FOR SCALE:
 * - Uses COUNT() queries instead of fetching all records
 * - Uses stored streak from profile instead of calculating on-the-fly
 * - Removed expensive groupBy for percentile (uses simplified approach)
 * - Parallel queries where possible
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

    // Run global counts in parallel
    const [liveUsersCount, todayCompletedCount] = await Promise.all([
      // Count of currently active focus sessions (real live users only)
      prisma.focusSession.count({
        where: {
          status: 'ACTIVE',
          // Session started in last 30 minutes (reasonable active window)
          startedAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000),
          },
        },
      }),
      // Today's community completed sessions
      prisma.focusSession.count({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
    ])

    // User-specific stats
    let userStreak = 0
    let userTodaySessions = 0
    let userTotalSessions = 0
    let userPercentile = 0
    let activeSession: { id: string; durationMinutes: number; startedAt: string; timeRemaining: number; sessionType: 'solo_study' | 'quick_focus' } | null = null

    if (user) {
      // Run user-specific queries in parallel (no expensive groupBy)
      const [
        userActiveSession,
        userProfile,
        todayCount,
        totalCount,
      ] = await Promise.all([
        // Check for active session
        prisma.focusSession.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            durationMinutes: true,
            startedAt: true,
            label: true,
          },
        }),
        // Get stored streak from profile
        prisma.profile.findUnique({
          where: { userId: user.id },
          select: { studyStreak: true },
        }),
        // User's sessions today (count only)
        prisma.focusSession.count({
          where: {
            userId: user.id,
            status: 'COMPLETED',
            completedAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        }),
        // User's total completed sessions (count only)
        prisma.focusSession.count({
          where: {
            userId: user.id,
            status: 'COMPLETED',
          },
        }),
      ])

      // Extract values
      userStreak = userProfile?.studyStreak || 0
      userTodaySessions = todayCount
      userTotalSessions = totalCount

      // Process active session
      if (userActiveSession) {
        const startTime = new Date(userActiveSession.startedAt).getTime()
        const durationMs = userActiveSession.durationMinutes * 60 * 1000
        const elapsed = Date.now() - startTime
        const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))

        // Determine session type based on label
        const isSoloStudy = userActiveSession.label?.startsWith('Solo Study') || false

        if (remainingSeconds > 0) {
          activeSession = {
            id: userActiveSession.id,
            durationMinutes: userActiveSession.durationMinutes,
            startedAt: userActiveSession.startedAt.toISOString(),
            timeRemaining: remainingSeconds,
            sessionType: isSoloStudy ? 'solo_study' : 'quick_focus',
          }
        } else {
          // Session has expired - auto-complete it in the background
          prisma.focusSession.update({
            where: { id: userActiveSession.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              actualMinutes: userActiveSession.durationMinutes,
            },
          }).catch((err) => {
            logger.error('Failed to auto-complete expired session', {
              sessionId: userActiveSession.id,
              error: err
            })
          })
        }
      }

      // Simplified percentile estimation based on session count thresholds
      // Avoids expensive groupBy queries - uses simple heuristic
      if (userTotalSessions >= 100) {
        userPercentile = 95 // Top 5%
      } else if (userTotalSessions >= 50) {
        userPercentile = 85 // Top 15%
      } else if (userTotalSessions >= 25) {
        userPercentile = 70 // Top 30%
      } else if (userTotalSessions >= 10) {
        userPercentile = 50 // Top 50%
      } else if (userTotalSessions >= 5) {
        userPercentile = 30 // Top 70%
      } else if (userTotalSessions > 0) {
        userPercentile = 10 // Has some sessions
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        liveUsersCount,
        todayCompletedCount,
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
