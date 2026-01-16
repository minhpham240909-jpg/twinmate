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
 */
async function fetchUserStats(userId: string) {
  // Get user data with study statistics from profile
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      profile: {
        select: {
          studyStreak: true,
          totalPoints: true,
          coins: true,
          // Separate streaks
          soloStudyStreak: true,
          lastSoloStudyDate: true,
          quickFocusStreak: true,
          lastQuickFocusDate: true,
        }
      }
    }
  })

  if (!userData) {
    throw new Error('User not found')
  }

  // Extract from profile
  const studyStreak = userData.profile?.studyStreak || 0
  const totalPoints = userData.profile?.totalPoints || 0
  const coins = userData.profile?.coins || 0
  const soloStudyStreak = userData.profile?.soloStudyStreak || 0
  const quickFocusStreak = userData.profile?.quickFocusStreak || 0

  // Calculate study time from all session types
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0)

  // Get all session types in parallel - SEPARATE Solo Study vs Quick Focus
  const [
    todayStudySessions,
    weekStudySessions,
    allTimeStudySessions,
    // Solo Study sessions (mode = 'solo')
    todaySoloStudySessions,
    weekSoloStudySessions,
    allTimeSoloStudySessions,
    // Quick Focus sessions (mode != 'solo')
    todayQuickFocusSessions,
    weekQuickFocusSessions,
    allTimeQuickFocusSessions,
    todayAISessions,
    weekAISessions,
    allTimeAISessions,
  ] = await Promise.all([
    // Study Sessions (Partner) - Today
    prisma.studySession.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { participants: { some: { userId: userId } } }
        ],
        status: 'COMPLETED',
        endedAt: { gte: startOfToday }
      },
      select: { startedAt: true, endedAt: true }
    }),
    // Study Sessions (Partner) - Week
    prisma.studySession.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { participants: { some: { userId: userId } } }
        ],
        status: 'COMPLETED',
        endedAt: { gte: startOfWeek }
      },
      select: { startedAt: true, endedAt: true }
    }),
    // Study Sessions (Partner) - All Time
    prisma.studySession.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { participants: { some: { userId: userId } } }
        ],
        status: 'COMPLETED'
      },
      select: { startedAt: true, endedAt: true }
    }),
    // SOLO STUDY Sessions - Today (mode = 'solo')
    prisma.focusSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        mode: 'solo',
        completedAt: { gte: startOfToday }
      },
      select: { actualMinutes: true, durationMinutes: true }
    }),
    // SOLO STUDY Sessions - Week
    prisma.focusSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        mode: 'solo',
        completedAt: { gte: startOfWeek }
      },
      select: { actualMinutes: true, durationMinutes: true }
    }),
    // SOLO STUDY Sessions - All Time
    prisma.focusSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        mode: 'solo'
      },
      select: { actualMinutes: true, durationMinutes: true }
    }),
    // QUICK FOCUS Sessions - Today (mode != 'solo')
    prisma.focusSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        mode: { not: 'solo' },
        completedAt: { gte: startOfToday }
      },
      select: { actualMinutes: true, durationMinutes: true }
    }),
    // QUICK FOCUS Sessions - Week
    prisma.focusSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        mode: { not: 'solo' },
        completedAt: { gte: startOfWeek }
      },
      select: { actualMinutes: true, durationMinutes: true }
    }),
    // QUICK FOCUS Sessions - All Time
    prisma.focusSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        mode: { not: 'solo' }
      },
      select: { actualMinutes: true, durationMinutes: true }
    }),
    // AI Sessions - Today
    prisma.aIPartnerSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        endedAt: { gte: startOfToday }
      },
      select: { startedAt: true, endedAt: true }
    }),
    // AI Sessions - Week
    prisma.aIPartnerSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED',
        endedAt: { gte: startOfWeek }
      },
      select: { startedAt: true, endedAt: true }
    }),
    // AI Sessions - All Time
    prisma.aIPartnerSession.findMany({
      where: {
        userId: userId,
        status: 'COMPLETED'
      },
      select: { startedAt: true, endedAt: true }
    }),
  ])

  // Calculate minutes from study sessions (startedAt/endedAt)
  const calculateSessionMinutes = (sessions: { startedAt: Date | null; endedAt: Date | null }[]) => {
    return sessions.reduce((total, session) => {
      if (session.startedAt && session.endedAt) {
        const diff = session.endedAt.getTime() - session.startedAt.getTime()
        return total + Math.round(diff / (1000 * 60))
      }
      return total
    }, 0)
  }

  // Calculate minutes from focus sessions (actualMinutes or durationMinutes)
  const calculateFocusMinutes = (sessions: { actualMinutes: number | null; durationMinutes: number }[]) => {
    return sessions.reduce((total, session) => {
      return total + (session.actualMinutes || session.durationMinutes)
    }, 0)
  }

  // SOLO STUDY stats
  const todaySoloStudyMins = calculateFocusMinutes(todaySoloStudySessions)
  const weekSoloStudyMins = calculateFocusMinutes(weekSoloStudySessions)
  const allTimeSoloStudyMins = calculateFocusMinutes(allTimeSoloStudySessions)

  // QUICK FOCUS stats
  const todayQuickFocusMins = calculateFocusMinutes(todayQuickFocusSessions)
  const weekQuickFocusMins = calculateFocusMinutes(weekQuickFocusSessions)
  const allTimeQuickFocusMins = calculateFocusMinutes(allTimeQuickFocusSessions)

  // Partner Study stats
  const todayStudyMins = calculateSessionMinutes(todayStudySessions)
  const weekStudyMins = calculateSessionMinutes(weekStudySessions)
  const allTimeStudyMins = calculateSessionMinutes(allTimeStudySessions)

  // AI Study stats
  const todayAIMins = calculateSessionMinutes(todayAISessions)
  const weekAIMins = calculateSessionMinutes(weekAISessions)
  const allTimeAIMins = calculateSessionMinutes(allTimeAISessions)

  // COMBINED totals (for dashboard stats row)
  const todayMinutes = todaySoloStudyMins + todayQuickFocusMins + todayStudyMins + todayAIMins
  const weekMinutes = weekSoloStudyMins + weekQuickFocusMins + weekStudyMins + weekAIMins
  const allTimeMinutes = allTimeSoloStudyMins + allTimeQuickFocusMins + allTimeStudyMins + allTimeAIMins

  // Session counts - SEPARATE
  const todaySoloStudyCount = todaySoloStudySessions.length
  const weekSoloStudyCount = weekSoloStudySessions.length
  const allTimeSoloStudyCount = allTimeSoloStudySessions.length

  const todayQuickFocusCount = todayQuickFocusSessions.length
  const weekQuickFocusCount = weekQuickFocusSessions.length
  const allTimeQuickFocusCount = allTimeQuickFocusSessions.length

  // COMBINED session counts (for dashboard)
  const todaySessionCount = todaySoloStudyCount + todayQuickFocusCount + todayStudySessions.length + todayAISessions.length
  const weekSessionCount = weekSoloStudyCount + weekQuickFocusCount + weekStudySessions.length + weekAISessions.length
  const allTimeSessionCount = allTimeSoloStudyCount + allTimeQuickFocusCount + allTimeStudySessions.length + allTimeAISessions.length

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
