import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

// GET /api/history/achievements - Get user's badges and achievements
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for achievements reads
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

    // Get user badges
    const userBadges = await prisma.userBadge.findMany({
      where: {
        userId: user.id,
      },
      include: {
        badge: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    })

    // Get user profile for gamification stats
    const profile = await prisma.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        studyStreak: true,
        totalStudyHours: true,
        lastStudyDate: true,
      },
    })

    // Get all available badges to show progress
    const allBadges = await prisma.badge.findMany({
      orderBy: {
        type: 'asc',
      },
    })

    // Calculate which badges user hasn't earned yet
    const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId))
    const unearnedBadges = allBadges.filter(badge => !earnedBadgeIds.has(badge.id))

    return NextResponse.json({
      badges: userBadges.map(ub => ({
        id: ub.id,
        badge: {
          id: ub.badge.id,
          name: ub.badge.name,
          description: ub.badge.description,
          type: ub.badge.type,
          iconUrl: ub.badge.iconUrl,
          requirement: ub.badge.requirement,
        },
        earnedAt: ub.earnedAt,
      })),
      milestones: {
        studyStreak: profile?.studyStreak || 0,
        totalStudyHours: profile?.totalStudyHours || 0,
        lastStudyDate: profile?.lastStudyDate,
      },
      progress: {
        totalBadges: allBadges.length,
        earnedBadges: userBadges.length,
        unearnedBadges: unearnedBadges.map(badge => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          type: badge.type,
          iconUrl: badge.iconUrl,
          requirement: badge.requirement,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    )
  }
}

