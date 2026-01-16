import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheKeys, CacheTTL } from '@/lib/redis'

// Types for cached leaderboard data
interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatarUrl: string | null
  value: number
  label: string
}

interface CachedLeaderboard {
  title: string
  entries: LeaderboardEntry[]
  totalParticipants: number
  courseCode: string
}

/**
 * GET /api/courses/[courseId]/leaderboard
 * Get micro-leaderboard for a course (top 5 only)
 *
 * IMPORTANT: This follows the advice:
 * - Shows only Top 3-5, not full ranking
 * - Weekly reset to keep it fair
 * - Focus on consistency (streak) not just total time
 *
 * PERFORMANCE: Uses Redis caching (2 min TTL)
 * - Leaderboard data is cached per course per type
 * - User-specific data (rank, isCurrentUser) computed on response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'weekly' // weekly, streak, sessions

    // Verify user is enrolled (not cached - security check)
    const userEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    })

    if (!userEnrollment || userEnrollment.leftAt !== null) {
      return NextResponse.json(
        { error: 'You are not enrolled in this course' },
        { status: 403 }
      )
    }

    // Get cached leaderboard data (or compute if cache miss)
    const cacheKey = CacheKeys.COURSE_LEADERBOARD(courseId, type)
    const cachedData = await cacheGet<CachedLeaderboard>(
      cacheKey,
      () => computeLeaderboard(courseId, type),
      CacheTTL.COURSE_LEADERBOARD
    )

    // Compute user-specific data (not cached - changes per user)
    const isInTop5 = cachedData.entries.some(e => e.userId === user.id)
    let userRank: number | null = null

    if (!isInTop5) {
      // Count how many are ahead of user
      const fieldName = type === 'streak' ? 'currentStreak' : type === 'sessions' ? 'weeklySessions' : 'weeklyStudyMinutes'
      const userValue = type === 'streak'
        ? userEnrollment.currentStreak
        : type === 'sessions'
          ? userEnrollment.weeklySessions
          : userEnrollment.weeklyStudyMinutes

      const aheadCount = await prisma.courseEnrollment.count({
        where: {
          courseId,
          leftAt: null,
          [fieldName]: { gt: userValue },
        },
      })
      userRank = aheadCount + 1
    }

    // Mark current user in entries
    const entriesWithUser = cachedData.entries.map(e => ({
      ...e,
      isCurrentUser: e.userId === user.id,
    }))

    // Calculate when week resets (Sunday midnight)
    const now = new Date()
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7
    const nextReset = new Date(now)
    nextReset.setDate(now.getDate() + daysUntilSunday)
    nextReset.setHours(0, 0, 0, 0)

    return NextResponse.json({
      success: true,
      leaderboard: {
        title: cachedData.title,
        type,
        entries: entriesWithUser,
        userStats: {
          rank: isInTop5 ? entriesWithUser.find(l => l.isCurrentUser)?.rank : userRank,
          isInTop5,
          weeklyMinutes: userEnrollment.weeklyStudyMinutes,
          weeklySessions: userEnrollment.weeklySessions,
          currentStreak: userEnrollment.currentStreak,
        },
        resetsAt: nextReset.toISOString(),
        totalParticipants: cachedData.totalParticipants,
      },
    })
  } catch (error) {
    console.error('[Course Leaderboard] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}

/**
 * Compute leaderboard data (called on cache miss)
 * This is the expensive operation we want to cache
 */
async function computeLeaderboard(courseId: string, type: string): Promise<CachedLeaderboard> {
  // Get course name
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true, code: true },
  })

  if (!course) {
    throw new Error('Course not found')
  }

  // Build orderBy based on leaderboard type
  let orderBy: Record<string, 'desc'>
  let title: string

  switch (type) {
    case 'streak':
      orderBy = { currentStreak: 'desc' }
      title = `Most Consistent in ${course.code}`
      break
    case 'sessions':
      orderBy = { weeklySessions: 'desc' }
      title = `Most Sessions This Week in ${course.code}`
      break
    case 'weekly':
    default:
      orderBy = { weeklyStudyMinutes: 'desc' }
      title = `This Week's Focus Leaders in ${course.code}`
      break
  }

  // Get top 5 performers and total count in parallel
  const [topPerformers, totalParticipants] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: {
        courseId,
        leftAt: null,
        // Only include people with some activity
        OR: [
          { weeklyStudyMinutes: { gt: 0 } },
          { currentStreak: { gt: 0 } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy,
      take: 5, // Only top 5 - keeps it motivating, not intimidating
    }),
    prisma.courseEnrollment.count({
      where: { courseId, leftAt: null },
    }),
  ])

  // Format entries
  const entries: LeaderboardEntry[] = topPerformers.map((p, index) => ({
    rank: index + 1,
    userId: p.user.id,
    name: p.user.name,
    avatarUrl: p.user.avatarUrl,
    value: type === 'streak'
      ? p.currentStreak
      : type === 'sessions'
        ? p.weeklySessions
        : p.weeklyStudyMinutes,
    label: type === 'streak'
      ? `${p.currentStreak} day streak`
      : type === 'sessions'
        ? `${p.weeklySessions} sessions`
        : `${Math.round(p.weeklyStudyMinutes / 60 * 10) / 10}h studied`,
  }))

  return {
    title,
    entries,
    totalParticipants,
    courseCode: course.code,
  }
}
