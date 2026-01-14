import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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
 * OPTIMIZED: Parallel queries with Promise.all
 * NO N+1 issues - all data fetched efficiently
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

    // Get user data with study statistics from profile
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        createdAt: true,
        profile: {
          select: {
            studyStreak: true,
            totalPoints: true,
          }
        }
      }
    })

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Extract from profile
    const studyStreak = userData.profile?.studyStreak || 0
    const totalPoints = userData.profile?.totalPoints || 0

    // Calculate study time from all session types
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0)

    // Get all session types in parallel
    const [
      todayStudySessions,
      weekStudySessions,
      allTimeStudySessions,
      todayFocusSessions,
      weekFocusSessions,
      allTimeFocusSessions,
      todayAISessions,
      weekAISessions,
      allTimeAISessions,
    ] = await Promise.all([
      // Study Sessions - Today
      prisma.studySession.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } }
          ],
          status: 'COMPLETED',
          endedAt: { gte: startOfToday }
        },
        select: { startedAt: true, endedAt: true }
      }),
      // Study Sessions - Week
      prisma.studySession.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } }
          ],
          status: 'COMPLETED',
          endedAt: { gte: startOfWeek }
        },
        select: { startedAt: true, endedAt: true }
      }),
      // Study Sessions - All Time
      prisma.studySession.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } }
          ],
          status: 'COMPLETED'
        },
        select: { startedAt: true, endedAt: true }
      }),
      // Focus Sessions - Today
      prisma.focusSession.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          completedAt: { gte: startOfToday }
        },
        select: { actualMinutes: true, durationMinutes: true }
      }),
      // Focus Sessions - Week
      prisma.focusSession.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          completedAt: { gte: startOfWeek }
        },
        select: { actualMinutes: true, durationMinutes: true }
      }),
      // Focus Sessions - All Time
      prisma.focusSession.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED'
        },
        select: { actualMinutes: true, durationMinutes: true }
      }),
      // AI Sessions - Today
      prisma.aIPartnerSession.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          endedAt: { gte: startOfToday }
        },
        select: { startedAt: true, endedAt: true }
      }),
      // AI Sessions - Week
      prisma.aIPartnerSession.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          endedAt: { gte: startOfWeek }
        },
        select: { startedAt: true, endedAt: true }
      }),
      // AI Sessions - All Time
      prisma.aIPartnerSession.findMany({
        where: {
          userId: user.id,
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

    // Today's totals
    const todayStudyMins = calculateSessionMinutes(todayStudySessions)
    const todayFocusMins = calculateFocusMinutes(todayFocusSessions)
    const todayAIMins = calculateSessionMinutes(todayAISessions)
    const todayMinutes = todayStudyMins + todayFocusMins + todayAIMins

    // Week totals
    const weekStudyMins = calculateSessionMinutes(weekStudySessions)
    const weekFocusMins = calculateFocusMinutes(weekFocusSessions)
    const weekAIMins = calculateSessionMinutes(weekAISessions)
    const weekMinutes = weekStudyMins + weekFocusMins + weekAIMins

    // All time totals
    const allTimeStudyMins = calculateSessionMinutes(allTimeStudySessions)
    const allTimeFocusMins = calculateFocusMinutes(allTimeFocusSessions)
    const allTimeAIMins = calculateSessionMinutes(allTimeAISessions)
    const allTimeMinutes = allTimeStudyMins + allTimeFocusMins + allTimeAIMins

    // Session counts
    const todaySessionCount = todayStudySessions.length + todayFocusSessions.length + todayAISessions.length
    const weekSessionCount = weekStudySessions.length + weekFocusSessions.length + weekAISessions.length
    const allTimeSessionCount = allTimeStudySessions.length + allTimeFocusSessions.length + allTimeAISessions.length

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

    return NextResponse.json({
      success: true,
      stats: {
        streak: {
          current: studyStreak,
          longest: studyStreak, // Use current as longest for now
        },
        studyTime: {
          today: formatStudyTime(todayMinutes),
          thisWeek: formatStudyTime(weekMinutes),
          allTime: formatStudyTime(allTimeMinutes),
          todayMinutes,
          weekMinutes,
          allTimeMinutes,
        },
        sessions: {
          today: todaySessionCount,
          thisWeek: weekSessionCount,
          allTime: allTimeSessionCount,
        },
        points: totalPoints,
        memberSince: userData.createdAt,
      }
    })
  } catch (error) {
    console.error('[USER STATS ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
