/**
 * Admin Retention Analytics API
 * 
 * GET: Fetch retention metrics including:
 * - Study Debt statistics
 * - Weekly Reflection completion rates
 * - Pro/Silent mode adoption
 * - Gamification engagement
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/retention
 * Fetch retention analytics for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin access
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, isSuperAdmin: true },
    })

    if (!adminUser?.isAdmin && !adminUser?.isSuperAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Time ranges
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ==========================================
    // STUDY DEBT & REFLECTION ANALYTICS
    // ==========================================
    // PERF: Run all analytics queries in parallel for better performance at scale
    const [
      studyDebtStats,
      studyDebtBySource,
      recentDebts,
      completedDebtsThisWeek,
      avgDebtCompletion,
      totalReflections,
      reflectionsThisMonth,
      avgSatisfaction,
      usersWithSummaries,
      usersWithCompletedReflections,
    ] = await Promise.all([
      // Study Debt queries
      prisma.studyDebt.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { debtMinutes: true, paidMinutes: true },
      }),
      prisma.studyDebt.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
      prisma.studyDebt.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      prisma.studyDebt.count({
        where: { status: 'COMPLETED', completedAt: { gte: weekAgo } },
      }),
      prisma.studyDebt.aggregate({
        where: { status: 'COMPLETED' },
        _avg: { paidMinutes: true, debtMinutes: true },
      }),
      // Weekly Reflection queries
      prisma.weeklySummary.count({
        where: { isComplete: true },
      }),
      prisma.weeklySummary.count({
        where: { isComplete: true, reflectionCompletedAt: { gte: monthAgo } },
      }),
      prisma.weeklySummary.aggregate({
        where: { isComplete: true, weekSatisfactionRating: { not: null } },
        _avg: { weekSatisfactionRating: true },
      }),
      // PERF: Use count instead of groupBy to avoid unbounded results
      // Count distinct users with summaries
      prisma.weeklySummary.groupBy({
        by: ['userId'],
        _count: { id: true },
        orderBy: { userId: 'asc' }, // Required when using take
        take: 10000, // Bounded limit to prevent memory explosion
      }),
      prisma.weeklySummary.groupBy({
        by: ['userId'],
        where: { isComplete: true },
        _count: { id: true },
        orderBy: { userId: 'asc' }, // Required when using take
        take: 10000, // Bounded limit
      }),
    ])

    // ==========================================
    // PRO/SILENT MODE ANALYTICS
    // ==========================================
    // PERF: Run all count queries in parallel instead of sequential
    const [
      proModeUsers,
      silentModeUsers,
      gamificationSettings,
      streakBadgesDisabled,
      leaderboardsDisabled,
      xpAnimationsDisabled,
      achievementPopupsDisabled,
      studyCaptainBadgeDisabled,
    ] = await Promise.all([
      prisma.userSettings.count({ where: { proModeEnabled: true } }),
      prisma.userSettings.count({ where: { silentModeEnabled: true } }),
      prisma.userSettings.aggregate({ _count: { id: true } }),
      prisma.userSettings.count({ where: { showStreakBadges: false } }),
      prisma.userSettings.count({ where: { showLeaderboards: false } }),
      prisma.userSettings.count({ where: { showXPAnimations: false } }),
      prisma.userSettings.count({ where: { showAchievementPopups: false } }),
      prisma.userSettings.count({ where: { showStudyCaptainBadge: false } }),
    ])

    // ==========================================
    // STUDY CAPTAIN ANALYTICS
    // ==========================================
    const totalCaptainBadges = await prisma.studyCaptain.count()

    const activeCaptains = await prisma.studyCaptain.count({
      where: { isActive: true },
    })

    const captainsThisWeek = await prisma.studyCaptain.count({
      where: { createdAt: { gte: weekAgo } },
    })

    // Top captains (most badges)
    const topCaptains = await prisma.studyCaptain.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    // Get user info for top captains
    const topCaptainUsers = topCaptains.length > 0 ? await prisma.user.findMany({
      where: { id: { in: topCaptains.map(c => c.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    }) : []

    const topCaptainsWithUsers = topCaptains.map(captain => ({
      ...captain,
      user: topCaptainUsers.find(u => u.id === captain.userId) || null,
    }))

    // ==========================================
    // GAMIFICATION EVENTS (if implemented)
    // ==========================================
    let gamificationEventsCount = 0
    let eventsThisWeek = 0
    try {
      gamificationEventsCount = await prisma.gamificationEvent.count()
      eventsThisWeek = await prisma.gamificationEvent.count({
        where: { createdAt: { gte: weekAgo } },
      })
    } catch {
      // Table might not exist yet
    }

    // ==========================================
    // COMPILE ANALYTICS
    // ==========================================
    const totalUsers = await prisma.user.count()
    const totalSettings = gamificationSettings._count.id || 0

    return NextResponse.json({
      success: true,
      analytics: {
        // Study Debt
        studyDebt: {
          byStatus: studyDebtStats.reduce((acc, stat) => {
            acc[stat.status] = {
              count: stat._count.id,
              totalMinutes: stat._sum.debtMinutes || 0,
              paidMinutes: stat._sum.paidMinutes || 0,
            }
            return acc
          }, {} as Record<string, { count: number; totalMinutes: number; paidMinutes: number }>),
          bySource: studyDebtBySource.reduce((acc, stat) => {
            acc[stat.source] = stat._count.id
            return acc
          }, {} as Record<string, number>),
          recentDebts,
          completedDebtsThisWeek,
          avgCompletionMinutes: avgDebtCompletion._avg.paidMinutes || 0,
        },

        // Weekly Reflections
        reflections: {
          total: totalReflections,
          thisMonth: reflectionsThisMonth,
          avgSatisfactionRating: avgSatisfaction._avg.weekSatisfactionRating || 0,
          usersWithSummaries: usersWithSummaries.length,
          usersWithCompletedReflections: usersWithCompletedReflections.length,
          completionRate: usersWithSummaries.length > 0
            ? Math.round((usersWithCompletedReflections.length / usersWithSummaries.length) * 100)
            : 0,
        },

        // Pro/Silent Mode
        modes: {
          proModeUsers,
          silentModeUsers,
          proModeAdoptionRate: totalSettings > 0 ? Math.round((proModeUsers / totalSettings) * 100) : 0,
          silentModeAdoptionRate: totalSettings > 0 ? Math.round((silentModeUsers / totalSettings) * 100) : 0,
        },

        // Gamification Opt-outs
        gamificationOptOuts: {
          streakBadges: streakBadgesDisabled,
          leaderboards: leaderboardsDisabled,
          xpAnimations: xpAnimationsDisabled,
          achievementPopups: achievementPopupsDisabled,
          studyCaptainBadge: studyCaptainBadgeDisabled,
          totalSettingsRecords: totalSettings,
        },

        // Study Captains
        studyCaptains: {
          totalBadges: totalCaptainBadges,
          activeCaptains,
          captainsThisWeek,
          topCaptains: topCaptainsWithUsers,
        },

        // Gamification Events
        gamificationEvents: {
          total: gamificationEventsCount,
          thisWeek: eventsThisWeek,
        },

        // General
        totalUsers,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Admin Retention] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch retention analytics' },
      { status: 500 }
    )
  }
}
