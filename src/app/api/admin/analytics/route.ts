/**
 * Admin Analytics API
 * Comprehensive analytics data for CEO dashboard
 * Performance optimized with Redis caching
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrSetCached } from '@/lib/cache'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// Cache TTL for analytics (2 minutes for overview, less for real-time data)
const ANALYTICS_CACHE_TTL = 120

// Users are considered online if heartbeat within last 2 minutes
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (default preset: 100 requests/minute)
    const rateLimitResult = await adminRateLimit(request, 'default')
    if (rateLimitResult) return rateLimitResult

    // Check if user is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'overview'
    const periodParam = searchParams.get('period') || '7d'
    const userId = searchParams.get('userId')

    // SECURITY: Strict validation of period parameter to prevent SQL injection
    const validPeriods = ['7d', '30d', '90d'] as const
    type ValidPeriod = typeof validPeriods[number]

    if (!validPeriods.includes(periodParam as ValidPeriod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period parameter. Allowed values: 7d, 30d, 90d' },
        { status: 400 }
      )
    }

    const period = periodParam as ValidPeriod

    // Calculate date range (safe now that period is validated)
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    if (view === 'overview') {
      // Use cache for overview analytics (most expensive queries)
      const cacheKey = `admin:analytics:overview:${period}`

      const analyticsData = await getOrSetCached(cacheKey, ANALYTICS_CACHE_TTL, async () => {
        // Calculate online threshold
        const now = new Date()
        const onlineThreshold = new Date(now.getTime() - ONLINE_THRESHOLD_MS)

        // PERFORMANCE OPTIMIZATION: Use raw SQL to get all counts in a single query
        // This reduces 10+ database round-trips to just 2-3 queries
        // Each COUNT is executed in parallel by the database, not sequentially
        type CountResult = { name: string; count: bigint }[]

        const [countsResult, dailyStats] = await Promise.all([
          // Single query with multiple counts using UNION ALL
          prisma.$queryRaw<CountResult>`
            SELECT 'totalUsers' as name, COUNT(*)::bigint as count FROM "User"
            UNION ALL
            SELECT 'newUsersThisPeriod', COUNT(*)::bigint FROM "User" WHERE "createdAt" >= ${startDate}
            UNION ALL
            SELECT 'onlineUsersNow', COUNT(*)::bigint FROM "user_presence" WHERE status = 'online' AND "lastSeenAt" >= ${onlineThreshold}
            UNION ALL
            SELECT 'totalSessions', COUNT(*)::bigint FROM "UserSessionAnalytics" WHERE "startedAt" >= ${startDate}
            UNION ALL
            SELECT 'totalPageViews', COUNT(*)::bigint FROM "UserPageVisit" WHERE "createdAt" >= ${startDate}
            UNION ALL
            SELECT 'totalMessages', COUNT(*)::bigint FROM "Message" WHERE "createdAt" >= ${startDate}
            UNION ALL
            SELECT 'totalPosts', COUNT(*)::bigint FROM "Post" WHERE "createdAt" >= ${startDate}
            UNION ALL
            SELECT 'totalConnections', COUNT(*)::bigint FROM "Match" WHERE status = 'ACCEPTED' AND "updatedAt" >= ${startDate}
            UNION ALL
            SELECT 'suspiciousActivities', COUNT(*)::bigint FROM "SuspiciousActivityLog" WHERE "createdAt" >= ${startDate} AND "isReviewed" = false
          `,

          // Daily stats for chart (kept separate as it returns multiple rows)
          prisma.userActivitySummary.groupBy({
            by: ['date'],
            where: { date: { gte: startDate } },
            _sum: {
              totalSessions: true,
              totalPageViews: true,
              messagesSent: true,
              postsCreated: true,
            },
            _count: { userId: true },
            orderBy: { date: 'asc' }
          })
        ])

        // Convert counts array to object for easy access
        const counts: Record<string, number> = {}
        for (const row of countsResult) {
          counts[row.name] = Number(row.count)
        }

        // Get active users count (requires DISTINCT, done separately)
        const activeUsersResult = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT "userId")::bigint as count
          FROM "UserSessionAnalytics"
          WHERE "startedAt" >= ${startDate}
        `
        const activeUsersThisPeriod = Number(activeUsersResult[0]?.count || 0)

        // Get top pages
        const topPages = await prisma.userPageVisit.groupBy({
          by: ['path'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10
        })

        // Get top features
        const topFeatures = await prisma.userFeatureUsage.groupBy({
          by: ['feature'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10
        })

        // Get search analytics
        const topSearches = await prisma.userSearchQuery.groupBy({
          by: ['searchType'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
          _avg: { resultCount: true },
          orderBy: { _count: { id: 'desc' } }
        })

        // Return data object (not Response) for caching
        return {
          summary: {
            totalUsers: counts.totalUsers || 0,
            newUsersThisPeriod: counts.newUsersThisPeriod || 0,
            activeUsersThisPeriod,
            onlineUsersNow: counts.onlineUsersNow || 0,
            totalSessions: counts.totalSessions || 0,
            totalPageViews: counts.totalPageViews || 0,
            totalMessages: counts.totalMessages || 0,
            totalPosts: counts.totalPosts || 0,
            totalConnections: counts.totalConnections || 0,
            suspiciousActivities: counts.suspiciousActivities || 0,
          },
          dailyStats: dailyStats.map(day => ({
            date: day.date,
            sessions: day._sum.totalSessions || 0,
            pageViews: day._sum.totalPageViews || 0,
            messages: day._sum.messagesSent || 0,
            posts: day._sum.postsCreated || 0,
            uniqueUsers: day._count.userId || 0,
          })),
          topPages: topPages.map(p => ({ path: p.path, views: p._count.id })),
          topFeatures: topFeatures.map(f => ({ feature: f.feature, usage: f._count.id })),
          searchAnalytics: topSearches.map(s => ({
            type: s.searchType,
            count: s._count.id,
            avgResults: Math.round(s._avg.resultCount || 0)
          })),
        }
      })

      return NextResponse.json({
        success: true,
        data: analyticsData,
      })
    }

    if (view === 'user' && userId) {
      // Individual user analytics
      const [
        userInfo,
        userSessions,
        userPageVisits,
        userFeatureUsage,
        userSearches,
        userSuspiciousActivity,
        dailyActivity,
      ] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
            lastLoginAt: true,
          }
        }),

        prisma.userSessionAnalytics.findMany({
          where: {
            userId,
            startedAt: { gte: startDate }
          },
          orderBy: { startedAt: 'desc' },
          take: 50
        }),

        prisma.userPageVisit.findMany({
          where: {
            userId,
            createdAt: { gte: startDate }
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        }),

        prisma.userFeatureUsage.groupBy({
          by: ['feature', 'category'],
          where: {
            userId,
            createdAt: { gte: startDate }
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } }
        }),

        prisma.userSearchQuery.findMany({
          where: {
            userId,
            createdAt: { gte: startDate }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),

        prisma.suspiciousActivityLog.findMany({
          where: {
            userId,
            createdAt: { gte: startDate }
          },
          orderBy: { createdAt: 'desc' }
        }),

        prisma.userActivitySummary.findMany({
          where: {
            userId,
            date: { gte: startDate }
          },
          orderBy: { date: 'asc' }
        })
      ])

      // Calculate session stats
      const totalSessionTime = userSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0)
      const avgSessionTime = userSessions.length > 0 ? totalSessionTime / userSessions.length : 0

      return NextResponse.json({
        success: true,
        data: {
          user: userInfo,
          sessionStats: {
            totalSessions: userSessions.length,
            totalTime: totalSessionTime,
            avgSessionTime: Math.round(avgSessionTime),
            totalPageViews: userPageVisits.length,
          },
          recentSessions: userSessions.slice(0, 10),
          pageVisitsByPath: Object.entries(
            userPageVisits.reduce((acc, v) => {
              acc[v.path] = (acc[v.path] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          ).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count),
          featureUsage: userFeatureUsage.map(f => ({
            feature: f.feature,
            category: f.category,
            count: f._count.id
          })),
          recentSearches: userSearches.slice(0, 20),
          suspiciousActivity: userSuspiciousActivity,
          dailyActivity: dailyActivity.map(d => ({
            date: d.date,
            sessions: d.totalSessions,
            duration: d.totalDuration,
            pageViews: d.totalPageViews,
            messages: d.messagesSent,
            posts: d.postsCreated,
          })),
        }
      })
    }

    if (view === 'charts') {
      // Enhanced chart data with proper time-series for Recharts
      const cacheKey = `admin:analytics:charts:${period}`

      const chartData = await getOrSetCached(cacheKey, ANALYTICS_CACHE_TTL, async () => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

        // User growth time series
        const userGrowthRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM "User"
          WHERE "createdAt" >= ${startDate}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `

        // Messages time series
        const messagesRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM "Message"
          WHERE "createdAt" >= ${startDate}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `

        // Study sessions time series
        const sessionsRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM "StudySession"
          WHERE "createdAt" >= ${startDate}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `

        // Active users time series (by login)
        const activeUsersRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("lastLoginAt") as date, COUNT(DISTINCT id) as count
          FROM "User"
          WHERE "lastLoginAt" >= ${startDate} AND "lastLoginAt" IS NOT NULL
          GROUP BY DATE("lastLoginAt")
          ORDER BY date ASC
        `

        // Matches time series
        const matchesRaw = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("createdAt") as date, COUNT(*) as count
          FROM "Match"
          WHERE "createdAt" >= ${startDate} AND status = 'ACCEPTED'
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `

        // Helper to fill in missing dates
        const fillDates = (data: Array<{ date: Date; count: bigint }>) => {
          const map = new Map<string, number>()
          data.forEach(d => {
            const dateStr = new Date(d.date).toISOString().split('T')[0]
            map.set(dateStr, Number(d.count))
          })

          const result = []
          for (let i = 0; i < periodDays; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
            const dateStr = date.toISOString().split('T')[0]
            const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            result.push({
              date: dateStr,
              label: shortDate,
              value: map.get(dateStr) || 0,
            })
          }
          return result
        }

        // User breakdown by role
        const usersByRole = await prisma.user.groupBy({
          by: ['role'],
          _count: true,
        })

        // Signup methods
        const signupMethods = await prisma.$queryRaw<Array<{ method: string; count: bigint }>>`
          SELECT
            CASE WHEN "googleId" IS NOT NULL THEN 'Google' ELSE 'Email' END as method,
            COUNT(*) as count
          FROM "User"
          GROUP BY CASE WHEN "googleId" IS NOT NULL THEN 'Google' ELSE 'Email' END
        `

        // Top groups by members
        const topGroups = await prisma.group.findMany({
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
          orderBy: { members: { _count: 'desc' } },
          take: 5,
        })

        // Hourly activity (last 24h messages)
        const hourlyRaw = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
          SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*) as count
          FROM "Message"
          WHERE "createdAt" >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}
          GROUP BY EXTRACT(HOUR FROM "createdAt")
          ORDER BY hour ASC
        `

        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          label: `${i.toString().padStart(2, '0')}:00`,
          value: 0,
        }))
        hourlyRaw.forEach(h => {
          const idx = Number(h.hour)
          if (idx >= 0 && idx < 24) {
            hourlyData[idx].value = Number(h.count)
          }
        })

        // Calculate summary stats with accurate comparisons
        const [
          totalUsers,
          newUsersThisMonth,
          newUsersLastMonth,
          newUsersThisWeek,
          activeToday,
          premiumUsers,
          deactivatedUsers,
          totalMessages,
          totalSessions,
          totalMatches,
          totalGroups,
          pendingReports,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { createdAt: { gte: thisMonthStart } } }),
          prisma.user.count({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
          prisma.user.count({ where: { createdAt: { gte: thisWeekStart } } }),
          prisma.user.count({ where: { lastLoginAt: { gte: today } } }),
          prisma.user.count({ where: { role: 'PREMIUM' } }),
          prisma.user.count({ where: { deactivatedAt: { not: null } } }),
          prisma.message.count(),
          prisma.studySession.count(),
          prisma.match.count({ where: { status: 'ACCEPTED' } }),
          prisma.group.count({ where: { isDeleted: false } }),
          prisma.report.count({ where: { status: 'PENDING' } }),
        ])

        // Accurate growth calculation
        const userGrowthPercent = newUsersLastMonth > 0
          ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
          : newUsersThisMonth > 0 ? 100 : 0

        return {
          overview: {
            totalUsers,
            newUsersThisMonth,
            newUsersThisWeek,
            activeToday,
            premiumUsers,
            deactivatedUsers,
            totalMessages,
            totalSessions,
            totalMatches,
            totalGroups,
            pendingReports,
            userGrowthPercent,
          },
          timeSeries: {
            userGrowth: fillDates(userGrowthRaw),
            messages: fillDates(messagesRaw),
            sessions: fillDates(sessionsRaw),
            activeUsers: fillDates(activeUsersRaw),
            matches: fillDates(matchesRaw),
          },
          breakdowns: {
            usersByRole: usersByRole.map(r => ({
              name: r.role === 'PREMIUM' ? 'Premium' : 'Free',
              value: r._count,
              fill: r.role === 'PREMIUM' ? '#fbbf24' : '#6b7280',
            })),
            signupMethods: signupMethods.map(s => ({
              name: s.method,
              value: Number(s.count),
              fill: s.method === 'Google' ? '#4285f4' : '#10b981',
            })),
            topGroups: topGroups.map(g => ({
              name: g.name.length > 15 ? g.name.slice(0, 15) + '...' : g.name,
              members: g._count.members,
            })),
          },
          activity: {
            hourly: hourlyData,
          },
        }
      })

      return NextResponse.json({
        success: true,
        data: chartData,
      })
    }

    if (view === 'suspicious') {
      // Suspicious activity overview
      const activities = await prisma.suspiciousActivityLog.findMany({
        where: {
          createdAt: { gte: startDate },
          ...(searchParams.get('unreviewed') === 'true' && { isReviewed: false }),
          ...(searchParams.get('severity') && {
            severity: searchParams.get('severity') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
          }),
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 100
      })

      // Get user info for each activity (userId is a string, not a relation)
      // This is acceptable for paginated results (max 100 activities)
      const userIds = [...new Set(activities.map(a => a.userId))]
      const users = userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, avatarUrl: true }
          })
        : []
      const userMap = new Map(users.map(u => [u.id, u]))

      // Stats by type and severity in parallel
      const [statsByType, statsBySeverity] = await Promise.all([
        prisma.suspiciousActivityLog.groupBy({
          by: ['type'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true }
        }),
        prisma.suspiciousActivityLog.groupBy({
          by: ['severity'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true }
        }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          activities: activities.map(a => ({
            ...a,
            user: userMap.get(a.userId) || null
          })),
          statsByType: statsByType.map(s => ({ type: s.type, count: s._count.id })),
          statsBySeverity: statsBySeverity.map(s => ({ severity: s.severity, count: s._count.id })),
          total: activities.length,
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

// Mark suspicious activity as reviewed
export async function PATCH(request: NextRequest) {
  try {
    // Apply rate limiting (bulk preset: 10 operations per 5 minutes)
    const rateLimitResult = await adminRateLimit(request, 'bulk')
    if (rateLimitResult) return rateLimitResult

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { activityId, actionTaken } = body

    // CRITICAL: Use transaction for activity update + audit log to ensure atomicity
    // This prevents race conditions where update succeeds but audit log fails
    const adminInfo = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true },
    })

    const activity = await prisma.$transaction(async (tx) => {
      const updatedActivity = await tx.suspiciousActivityLog.update({
        where: { id: activityId },
        data: {
          isReviewed: true,
          reviewedById: user.id,
          reviewedAt: new Date(),
          actionTaken,
        }
      })

      // Log the admin action within transaction
      // Note: adminName/adminEmail fields exist in schema - run `npx prisma generate` to update types
      await tx.adminAuditLog.create({
        data: {
          adminId: user.id,
          adminName: adminInfo?.name || 'Unknown Admin',
          adminEmail: adminInfo?.email || 'unknown@deleted',
          action: 'REVIEW_SUSPICIOUS_ACTIVITY',
          targetType: 'suspicious_activity',
          targetId: activityId,
          details: { actionTaken },
        } as any,
      })

      return updatedActivity
    })

    return NextResponse.json({ success: true, activity })
  } catch (error) {
    console.error('Error updating suspicious activity:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}
