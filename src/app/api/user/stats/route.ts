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
 * - Session counts
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

    // Extract studyStreak from profile
    const studyStreak = userData.profile?.studyStreak || 0

    // Calculate study time from completed study sessions
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0)

    // Get study sessions in parallel
    const [todaySessions, weekSessions, allTimeSessions] = await Promise.all([
      // Today's completed study sessions
      prisma.studySession.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } }
          ],
          status: 'COMPLETED',
          endedAt: { gte: startOfToday }
        },
        select: {
          startedAt: true,
          endedAt: true
        }
      }),

      // This week's completed study sessions
      prisma.studySession.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } }
          ],
          status: 'COMPLETED',
          endedAt: { gte: startOfWeek }
        },
        select: {
          startedAt: true,
          endedAt: true
        }
      }),

      // All time completed study sessions
      prisma.studySession.findMany({
        where: {
          OR: [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } }
          ],
          status: 'COMPLETED'
        },
        select: {
          startedAt: true,
          endedAt: true
        }
      })
    ])

    // Calculate minutes from sessions
    const calculateMinutes = (sessions: { startedAt: Date | null; endedAt: Date | null }[]) => {
      return sessions.reduce((total, session) => {
        if (session.startedAt && session.endedAt) {
          const diff = session.endedAt.getTime() - session.startedAt.getTime()
          return total + Math.round(diff / (1000 * 60)) // Convert to minutes
        }
        return total
      }, 0)
    }

    const todayMinutes = calculateMinutes(todaySessions)
    const weekMinutes = calculateMinutes(weekSessions)
    const allTimeMinutes = calculateMinutes(allTimeSessions)

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
          today: todaySessions.length,
          thisWeek: weekSessions.length,
          allTime: allTimeSessions.length,
        },
        points: 0, // Points system not implemented yet
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
