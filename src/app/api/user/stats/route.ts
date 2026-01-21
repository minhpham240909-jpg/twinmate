import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheKeys, CacheTTL } from '@/lib/redis'

/**
 * GET /api/user/stats
 * Fetches user's study statistics for dashboard display
 *
 * Returns:
 * - Study streak (current and longest)
 * - Total study time (today, this week, all time)
 * - Session counts (includes StudySession, FocusSession, AIPartnerSession)
 * - Points/XP
 *
 * OPTIMIZED:
 * - Redis caching (2 minute TTL)
 * - Parallel queries with Promise.all
 * - NO N+1 issues - all data fetched efficiently
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Try to get from Redis cache first
    const stats = await cacheGet(
      CacheKeys.USER_STATS(user.id),
      () => fetchUserStats(user.id),
      CacheTTL.USER_STATS
    )

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('[USER STATS ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Fetch user stats from database (called on cache miss)
 * OPTIMIZED: 6 parallel queries - no N+1 issues
 * - Uses date filters at DB level for recent data (today/week)
 * - Fetches actual durations for all-time stats (no estimates)
 * - Handles timezone correctly using Monday as week start
 * - Properly aggregates ALL non-solo modes for quick focus
 */
async function fetchUserStats(userId: string) {
  const now = new Date()

  // Start of today (midnight) - explicitly set all time components to 0
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  // Start of week (Monday) - ISO standard
  const dayOfWeek = now.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Sunday = 6 days ago
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - daysFromMonday)
  startOfWeek.setHours(0, 0, 0, 0)

  // For all-time, only go back 2 years max (prevents huge queries)
  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(now.getFullYear() - 2)

  // OPTIMIZED: 6 parallel queries - filtered at DB level for scale
  const [userData, focusSessions, studySessions, aiSessions, allTimeCounts, allTimeSessionDurations] = await Promise.all([
    // 1. User profile (streaks, points)
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        profile: {
          select: {
            studyStreak: true,
            totalPoints: true,
            coins: true,
            soloStudyStreak: true,
            lastSoloStudyDate: true,
            quickFocusStreak: true,
            lastQuickFocusDate: true,
          }
        }
      }
    }),
    // 2. Focus sessions from this week (for today/week filtering)
    prisma.focusSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: { gte: startOfWeek }
      },
      select: { actualMinutes: true, durationMinutes: true, mode: true, completedAt: true }
    }),
    // 3. Study sessions from this week
    prisma.studySession.findMany({
      where: {
        OR: [{ createdBy: userId }, { participants: { some: { userId } } }],
        status: 'COMPLETED',
        endedAt: { gte: startOfWeek }
      },
      select: { startedAt: true, endedAt: true }
    }),
    // 4. AI sessions from this week
    prisma.aIPartnerSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        endedAt: { gte: startOfWeek }
      },
      select: { startedAt: true, endedAt: true }
    }),
    // 5. All-time aggregates (efficient count + sum at DB level)
    Promise.all([
      // Focus sessions all-time stats
      prisma.focusSession.aggregate({
        where: { userId, status: 'COMPLETED', completedAt: { gte: twoYearsAgo } },
        _count: true,
        _sum: { actualMinutes: true, durationMinutes: true }
      }),
      // Focus sessions by mode count
      prisma.focusSession.groupBy({
        by: ['mode'],
        where: { userId, status: 'COMPLETED', completedAt: { gte: twoYearsAgo } },
        _count: true,
        _sum: { actualMinutes: true, durationMinutes: true }
      }),
      // Study sessions all-time count
      prisma.studySession.count({
        where: {
          OR: [{ createdBy: userId }, { participants: { some: { userId } } }],
          status: 'COMPLETED',
          endedAt: { gte: twoYearsAgo }
        }
      }),
      // AI sessions all-time count
      prisma.aIPartnerSession.count({
        where: { userId, status: 'COMPLETED', endedAt: { gte: twoYearsAgo } }
      }),
    ]),
    // 6. All-time actual durations for StudySession and AIPartnerSession (no estimates!)
    Promise.all([
      // StudySession all-time durations - fetch actual startedAt/endedAt
      prisma.studySession.findMany({
        where: {
          OR: [{ createdBy: userId }, { participants: { some: { userId } } }],
          status: 'COMPLETED',
          endedAt: { gte: twoYearsAgo }
        },
        select: { startedAt: true, endedAt: true }
      }),
      // AIPartnerSession all-time durations
      prisma.aIPartnerSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          endedAt: { gte: twoYearsAgo }
        },
        select: { startedAt: true, endedAt: true }
      }),
    ])
  ])

  if (!userData) {
    throw new Error('User not found')
  }

  // Extract all-time aggregates
  const [focusAggregate, focusByMode, allTimeStudyCount, allTimeAICount] = allTimeCounts
  const [allTimeStudySessions, allTimeAISessions] = allTimeSessionDurations

  const studyStreak = userData.profile?.studyStreak || 0
  const totalPoints = userData.profile?.totalPoints || 0
  const coins = userData.profile?.coins || 0
  const soloStudyStreak = userData.profile?.soloStudyStreak || 0
  const quickFocusStreak = userData.profile?.quickFocusStreak || 0

  // Filter this week's sessions in-memory (already filtered at DB level)
  const soloSessions = focusSessions.filter(s => s.mode === 'solo')
  const quickSessions = focusSessions.filter(s => s.mode !== 'solo')

  const todaySoloStudySessions = soloSessions.filter(s => s.completedAt && s.completedAt >= startOfToday)
  const weekSoloStudySessions = soloSessions // Already filtered to this week

  const todayQuickFocusSessions = quickSessions.filter(s => s.completedAt && s.completedAt >= startOfToday)
  const weekQuickFocusSessions = quickSessions // Already filtered to this week

  const todayStudySessions = studySessions.filter(s => s.endedAt && s.endedAt >= startOfToday)
  const weekStudySessions = studySessions // Already filtered to this week

  const todayAISessions = aiSessions.filter(s => s.endedAt && s.endedAt >= startOfToday)
  const weekAISessions = aiSessions // Already filtered to this week

  // Calculate minutes from study sessions (startedAt/endedAt)
  const calculateSessionMinutes = (sessions: { startedAt: Date | null; endedAt: Date | null }[]) => {
    return sessions.reduce((total, session) => {
      if (session.startedAt && session.endedAt) {
        const diff = session.endedAt.getTime() - session.startedAt.getTime()
        // Clamp to reasonable values (0-480 minutes = 8 hours max per session)
        const minutes = Math.max(0, Math.min(480, Math.round(diff / (1000 * 60))))
        return total + minutes
      }
      return total
    }, 0)
  }

  // Calculate minutes from focus sessions (actualMinutes or durationMinutes)
  // FIX: Handle actualMinutes being 0 correctly (use durationMinutes only if actualMinutes is null)
  const calculateFocusMinutes = (sessions: { actualMinutes: number | null; durationMinutes: number }[]) => {
    return sessions.reduce((total, session) => {
      // Use actualMinutes if not null, otherwise fall back to durationMinutes
      const minutes = session.actualMinutes !== null ? session.actualMinutes : session.durationMinutes
      return total + minutes
    }, 0)
  }

  // SOLO STUDY stats - today/week from filtered sessions
  const todaySoloStudyMins = calculateFocusMinutes(todaySoloStudySessions)
  const weekSoloStudyMins = calculateFocusMinutes(weekSoloStudySessions)

  // QUICK FOCUS stats - today/week from filtered sessions
  const todayQuickFocusMins = calculateFocusMinutes(todayQuickFocusSessions)
  const weekQuickFocusMins = calculateFocusMinutes(weekQuickFocusSessions)

  // Partner Study stats - today/week
  const todayStudyMins = calculateSessionMinutes(todayStudySessions)
  const weekStudyMins = calculateSessionMinutes(weekStudySessions)

  // AI Study stats - today/week
  const todayAIMins = calculateSessionMinutes(todayAISessions)
  const weekAIMins = calculateSessionMinutes(weekAISessions)

  // ALL-TIME stats from aggregates (efficient DB-level calculation)
  const soloModeStats = focusByMode.find(m => m.mode === 'solo')

  // FIX: Aggregate ALL non-solo modes (not just the first one found)
  const quickModeStatsList = focusByMode.filter(m => m.mode !== 'solo')
  const quickModeStatsAggregated = {
    _count: quickModeStatsList.reduce((sum, s) => sum + (s._count || 0), 0),
    _sum: {
      actualMinutes: quickModeStatsList.reduce((sum, s) => sum + (s._sum?.actualMinutes || 0), 0),
      durationMinutes: quickModeStatsList.reduce((sum, s) => sum + (s._sum?.durationMinutes || 0), 0),
    }
  }

  // Calculate all-time minutes: prefer actualMinutes, fall back to durationMinutes
  // actualMinutes = actual time spent (may be less if user ended early)
  // durationMinutes = planned duration (fallback if actualMinutes not recorded)
  const calculateAllTimeMinutes = (stats: { _sum?: { actualMinutes: number | null; durationMinutes: number | null } } | undefined) => {
    if (!stats?._sum) return 0
    // Use actualMinutes if available and > 0, otherwise use durationMinutes
    const actual = stats._sum.actualMinutes || 0
    const planned = stats._sum.durationMinutes || 0
    return actual > 0 ? actual : planned
  }

  const allTimeSoloStudyMins = calculateAllTimeMinutes(soloModeStats)
  const allTimeQuickFocusMins = calculateAllTimeMinutes(quickModeStatsAggregated)

  // Total focus minutes (both modes)
  const totalFocusMinutes = (focusAggregate._sum?.actualMinutes || 0) || (focusAggregate._sum?.durationMinutes || 0)

  // FIX: Use actual durations for StudySession and AIPartnerSession (no more estimates!)
  const allTimeStudyMins = calculateSessionMinutes(allTimeStudySessions)
  const allTimeAIMins = calculateSessionMinutes(allTimeAISessions)

  // COMBINED totals (for dashboard stats row)
  const todayMinutes = todaySoloStudyMins + todayQuickFocusMins + todayStudyMins + todayAIMins
  const weekMinutes = weekSoloStudyMins + weekQuickFocusMins + weekStudyMins + weekAIMins
  const allTimeMinutes = totalFocusMinutes + allTimeStudyMins + allTimeAIMins

  // Session counts - today/week
  const todaySoloStudyCount = todaySoloStudySessions.length
  const weekSoloStudyCount = weekSoloStudySessions.length

  const todayQuickFocusCount = todayQuickFocusSessions.length
  const weekQuickFocusCount = weekQuickFocusSessions.length

  // All-time counts from aggregates
  const allTimeSoloStudyCount = soloModeStats?._count || 0
  const allTimeQuickFocusCount = quickModeStatsAggregated._count || 0

  // COMBINED session counts (for dashboard)
  const todaySessionCount = todaySoloStudyCount + todayQuickFocusCount + todayStudySessions.length + todayAISessions.length
  const weekSessionCount = weekSoloStudyCount + weekQuickFocusCount + weekStudySessions.length + weekAISessions.length
  const allTimeSessionCount = (focusAggregate._count || 0) + allTimeStudyCount + allTimeAICount

  // Format study time
  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) {
      return { value: minutes, unit: 'min', display: `${minutes}m` }
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return {
      value: hours,
      unit: 'hr',
      display: mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
  }

  return {
    // Combined streak (legacy - use separate streaks below)
    streak: {
      current: studyStreak,
      longest: studyStreak,
    },
    // SEPARATE STREAKS
    soloStudyStreak,
    quickFocusStreak,
    // Combined study time (for dashboard stats row)
    studyTime: {
      today: formatStudyTime(todayMinutes),
      thisWeek: formatStudyTime(weekMinutes),
      allTime: formatStudyTime(allTimeMinutes),
      todayMinutes,
      weekMinutes,
      allTimeMinutes,
    },
    // Combined session counts (for dashboard)
    sessions: {
      today: todaySessionCount,
      thisWeek: weekSessionCount,
      allTime: allTimeSessionCount,
    },
    // SOLO STUDY specific stats
    soloStudy: {
      streak: soloStudyStreak,
      studyTime: {
        today: formatStudyTime(todaySoloStudyMins),
        thisWeek: formatStudyTime(weekSoloStudyMins),
        allTime: formatStudyTime(allTimeSoloStudyMins),
        todayMinutes: todaySoloStudyMins,
        weekMinutes: weekSoloStudyMins,
        allTimeMinutes: allTimeSoloStudyMins,
      },
      sessions: {
        today: todaySoloStudyCount,
        thisWeek: weekSoloStudyCount,
        allTime: allTimeSoloStudyCount,
      },
    },
    // QUICK FOCUS specific stats
    quickFocus: {
      streak: quickFocusStreak,
      studyTime: {
        today: formatStudyTime(todayQuickFocusMins),
        thisWeek: formatStudyTime(weekQuickFocusMins),
        allTime: formatStudyTime(allTimeQuickFocusMins),
        todayMinutes: todayQuickFocusMins,
        weekMinutes: weekQuickFocusMins,
        allTimeMinutes: allTimeQuickFocusMins,
      },
      sessions: {
        today: todayQuickFocusCount,
        thisWeek: weekQuickFocusCount,
        allTime: allTimeQuickFocusCount,
      },
    },
    points: totalPoints,
    coins,
    memberSince: userData.createdAt,
  }
}
