/**
 * Admin Analytics API
 * Comprehensive analytics data for CEO dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
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
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d
    const userId = searchParams.get('userId')

    // Calculate date range
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    if (view === 'overview') {
      // Platform-wide analytics
      const [
        totalUsers,
        newUsersThisPeriod,
        activeUsersThisPeriod,
        totalSessions,
        totalPageViews,
        totalMessages,
        totalPosts,
        totalConnections,
        suspiciousActivities,
        dailyStats,
      ] = await Promise.all([
        // Total users
        prisma.user.count(),

        // New users this period
        prisma.user.count({
          where: { createdAt: { gte: startDate } }
        }),

        // Active users (had a session)
        prisma.userSessionAnalytics.groupBy({
          by: ['userId'],
          where: { startedAt: { gte: startDate } },
        }).then(r => r.length),

        // Total sessions
        prisma.userSessionAnalytics.count({
          where: { startedAt: { gte: startDate } }
        }),

        // Total page views
        prisma.userPageVisit.count({
          where: { createdAt: { gte: startDate } }
        }),

        // Total messages
        prisma.message.count({
          where: { createdAt: { gte: startDate } }
        }),

        // Total posts
        prisma.post.count({
          where: { createdAt: { gte: startDate } }
        }),

        // Total new connections
        prisma.match.count({
          where: {
            status: 'ACCEPTED',
            updatedAt: { gte: startDate }
          }
        }),

        // Suspicious activities
        prisma.suspiciousActivityLog.count({
          where: {
            createdAt: { gte: startDate },
            isReviewed: false
          }
        }),

        // Daily stats for chart
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

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalUsers,
            newUsersThisPeriod,
            activeUsersThisPeriod,
            totalSessions,
            totalPageViews,
            totalMessages,
            totalPosts,
            totalConnections,
            suspiciousActivities,
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

      // Get user info for each activity
      const userIds = [...new Set(activities.map(a => a.userId))]
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, avatarUrl: true }
      })
      const userMap = new Map(users.map(u => [u.id, u]))

      // Stats by type
      const statsByType = await prisma.suspiciousActivityLog.groupBy({
        by: ['type'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true }
      })

      // Stats by severity
      const statsBySeverity = await prisma.suspiciousActivityLog.groupBy({
        by: ['severity'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true }
      })

      return NextResponse.json({
        success: true,
        data: {
          activities: activities.map(a => ({
            ...a,
            user: userMap.get(a.userId)
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

    const activity = await prisma.suspiciousActivityLog.update({
      where: { id: activityId },
      data: {
        isReviewed: true,
        reviewedById: user.id,
        reviewedAt: new Date(),
        actionTaken,
      }
    })

    // Log the admin action
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'REVIEW_SUSPICIOUS_ACTIVITY',
        targetType: 'suspicious_activity',
        targetId: activityId,
        details: { actionTaken },
      }
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
