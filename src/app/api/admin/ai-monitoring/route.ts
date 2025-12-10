/**
 * Admin AI Monitoring API
 * GET /api/admin/ai-monitoring - Get AI usage stats, costs, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getRealTimeStats } from '@/lib/ai-partner/monitoring'

// GET: Get AI monitoring data for admin dashboard
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!dbUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'day' // day, week, month
    const detailed = searchParams.get('detailed') === 'true'

    // Get real-time in-memory stats
    const realTimeStats = getRealTimeStats()

    // Calculate date range
    const now = new Date()
    let startDate: Date
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Get database stats
    const [
      periodLogs,
      errorLogs,
      operationStats,
      modelStats,
      dailySummaries,
      recentLogs,
      topUsers,
      cacheStats,
    ] = await Promise.all([
      // Period logs count
      prisma.aIUsageLog.count({
        where: { createdAt: { gte: startDate } },
      }),

      // Error count in period
      prisma.aIUsageLog.count({
        where: { createdAt: { gte: startDate }, success: false },
      }),

      // Stats by operation
      prisma.aIUsageLog.groupBy({
        by: ['operation'],
        where: { createdAt: { gte: startDate } },
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCost: true },
        _avg: { latencyMs: true },
      }),

      // Stats by model
      prisma.aIUsageLog.groupBy({
        by: ['model'],
        where: { createdAt: { gte: startDate } },
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCost: true },
      }),

      // Daily summaries for the period
      prisma.aIUsageDailySummary.findMany({
        where: { date: { gte: startDate } },
        orderBy: { date: 'asc' },
      }),

      // Recent logs for detailed view
      detailed ? prisma.aIUsageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          userId: true,
          operation: true,
          model: true,
          totalTokens: true,
          estimatedCost: true,
          latencyMs: true,
          success: true,
          errorMessage: true,
          createdAt: true,
        },
      }) : [],

      // Top users by usage
      prisma.aIUsageLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: startDate },
          userId: { not: null },
        },
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCost: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),

      // Cache stats
      prisma.aIResponseCache.aggregate({
        _count: { _all: true },
        _sum: { accessCount: true },
      }),
    ])

    // Calculate aggregate stats
    const totalCost = operationStats.reduce((sum, op) => sum + (op._sum?.estimatedCost || 0), 0)
    const totalTokens = operationStats.reduce((sum, op) => sum + (op._sum?.totalTokens || 0), 0)
    const avgLatency = operationStats.length > 0
      ? operationStats.reduce((sum, op) => sum + (op._avg?.latencyMs || 0), 0) / operationStats.length
      : 0
    const errorRate = periodLogs > 0 ? (errorLogs / periodLogs) * 100 : 0

    // Enrich top users with user info
    const userIds = topUsers.map(u => u.userId).filter(Boolean) as string[]
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }) : []
    const usersMap = users.reduce((acc, u) => {
      acc[u.id] = u
      return acc
    }, {} as Record<string, typeof users[0]>)

    const enrichedTopUsers = topUsers.map(u => ({
      userId: u.userId,
      requestCount: u._count?._all || 0,
      totalTokens: u._sum?.totalTokens || 0,
      totalCost: u._sum?.estimatedCost || 0,
      user: u.userId ? usersMap[u.userId] : null,
    }))

    return NextResponse.json({
      success: true,
      period,
      realTimeStats,
      stats: {
        totalRequests: periodLogs,
        totalTokens,
        totalCost: Math.round(totalCost * 10000) / 10000, // 4 decimal places
        avgLatencyMs: Math.round(avgLatency),
        errorCount: errorLogs,
        errorRate: Math.round(errorRate * 100) / 100,
        cacheEntries: cacheStats._count?._all || 0,
        cacheHits: cacheStats._sum?.accessCount || 0,
      },
      operationStats: operationStats.map(op => ({
        operation: op.operation,
        count: op._count?._all || 0,
        totalTokens: op._sum?.totalTokens || 0,
        totalCost: Math.round((op._sum?.estimatedCost || 0) * 10000) / 10000,
        avgLatencyMs: Math.round(op._avg?.latencyMs || 0),
      })),
      modelStats: modelStats.map(m => ({
        model: m.model,
        count: m._count?._all || 0,
        totalTokens: m._sum?.totalTokens || 0,
        totalCost: Math.round((m._sum?.estimatedCost || 0) * 10000) / 10000,
      })),
      dailySummaries: dailySummaries.map(d => ({
        date: d.date,
        requests: d.totalRequests,
        tokens: d.totalTokens,
        cost: Math.round(d.totalCost * 10000) / 10000,
        avgLatencyMs: d.avgLatencyMs,
      })),
      topUsers: enrichedTopUsers,
      ...(detailed ? { recentLogs } : {}),
    })
  } catch (error) {
    console.error('[Admin AI Monitoring] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get monitoring data' },
      { status: 500 }
    )
  }
}
