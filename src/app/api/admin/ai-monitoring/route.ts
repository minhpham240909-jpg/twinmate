/**
 * Admin AI Monitoring API
 * GET /api/admin/ai-monitoring - Get AI usage stats, costs, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getRealTimeStats } from '@/lib/ai-partner/monitoring'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// GET: Get AI monitoring data for admin dashboard
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (default preset: 100 requests/minute)
    const rateLimitResult = await adminRateLimit(request, 'default')
    if (rateLimitResult) return rateLimitResult

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

    // Get database stats - wrapped in try/catch to handle missing tables gracefully
    let periodLogs = 0
    let errorLogs = 0
    let operationStats: Array<{ operation: string; _count: { _all: number }; _sum: { totalTokens: number | null; estimatedCost: number | null }; _avg: { latencyMs: number | null } }> = []
    let modelStats: Array<{ model: string; _count: { _all: number }; _sum: { totalTokens: number | null; estimatedCost: number | null } }> = []
    let dailySummaries: Array<{ date: Date; totalRequests: number; totalTokens: number; totalCost: number; avgLatencyMs: number }> = []
    let recentLogs: Array<any> = []
    let topUsers: Array<{ userId: string | null; _count: { _all: number }; _sum: { totalTokens: number | null; estimatedCost: number | null } }> = []
    let cacheStats: { _count: { _all: number }; _sum: { hitCount: number | null } } = { _count: { _all: 0 }, _sum: { hitCount: 0 } }
    let cachedRequests = 0
    let miniModelRequests = 0
    let fullModelRequests = 0

    try {
      // Run all queries in parallel with individual error handling
      const results = await Promise.all([
        // Period logs count
        prisma.aIUsageLog.count({
          where: { createdAt: { gte: startDate } },
        }).catch(() => 0),

        // Error count in period
        prisma.aIUsageLog.count({
          where: { createdAt: { gte: startDate }, success: false },
        }).catch(() => 0),

        // Stats by operation
        prisma.aIUsageLog.groupBy({
          by: ['operation'],
          where: { createdAt: { gte: startDate } },
          _count: { _all: true },
          _sum: { totalTokens: true, estimatedCost: true },
          _avg: { latencyMs: true },
        }).catch(() => []),

        // Stats by model
        prisma.aIUsageLog.groupBy({
          by: ['model'],
          where: { createdAt: { gte: startDate } },
          _count: { _all: true },
          _sum: { totalTokens: true, estimatedCost: true },
        }).catch(() => []),

        // Daily summaries for the period
        prisma.aIUsageDailySummary.findMany({
          where: { date: { gte: startDate } },
          orderBy: { date: 'asc' },
        }).catch(() => []),

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
            cached: true,
            metadata: true,
            createdAt: true,
          },
        }).catch(() => []) : Promise.resolve([]),

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
        }).catch(() => []),

        // Cache stats
        prisma.aIResponseCache.aggregate({
          _count: { _all: true },
          _sum: { hitCount: true },
        }).catch(() => ({ _count: { _all: 0 }, _sum: { hitCount: 0 } })),

        // Smart routing: Cached request count
        prisma.aIUsageLog.count({
          where: { createdAt: { gte: startDate }, cached: true },
        }).catch(() => 0),

        // Smart routing: gpt-5-mini requests (routed to efficient model)
        prisma.aIUsageLog.count({
          where: {
            createdAt: { gte: startDate },
            model: { contains: 'mini' },
            cached: false,
          },
        }).catch(() => 0),

        // Smart routing: gpt-5 requests (routed to full model)
        prisma.aIUsageLog.count({
          where: {
            createdAt: { gte: startDate },
            model: { not: { contains: 'mini' } },
            cached: false,
          },
        }).catch(() => 0),
      ])

      // Assign results
      periodLogs = results[0] as number
      errorLogs = results[1] as number
      operationStats = results[2] as typeof operationStats
      modelStats = results[3] as typeof modelStats
      dailySummaries = results[4] as typeof dailySummaries
      recentLogs = results[5] as typeof recentLogs
      topUsers = results[6] as typeof topUsers
      cacheStats = results[7] as typeof cacheStats
      cachedRequests = results[8] as number
      miniModelRequests = results[9] as number
      fullModelRequests = results[10] as number
    } catch (dbError) {
      // Log but continue - tables might not exist yet, we'll show empty stats
      console.warn('[Admin AI Monitoring] Database query error (tables may not exist):', dbError)
    }

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

    // Calculate smart routing stats
    const totalNonCachedRequests = miniModelRequests + fullModelRequests
    const miniModelPercentage = totalNonCachedRequests > 0
      ? Math.round((miniModelRequests / totalNonCachedRequests) * 1000) / 10
      : 0
    const fullModelPercentage = totalNonCachedRequests > 0
      ? Math.round((fullModelRequests / totalNonCachedRequests) * 1000) / 10
      : 0

    // Calculate cost savings from smart routing
    // GPT-4o: ~$5 per 1M input tokens, ~$15 per 1M output tokens
    // GPT-4o-mini: ~$0.15 per 1M input tokens, ~$0.6 per 1M output tokens
    // Approximate savings: Using mini saves ~97% on input, ~96% on output
    const miniModelStats = modelStats.find(m => m.model?.includes('mini'))
    const miniTokens = miniModelStats?._sum?.totalTokens || 0
    // If these queries went to gpt-5 instead, they'd cost ~30x more
    const estimatedSavings = miniTokens * 0.000025 // ~$25 per 1M tokens saved

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
        cacheHits: cacheStats._sum?.hitCount || 0,
      },
      // Smart routing statistics
      smartRouting: {
        enabled: process.env.SMART_ROUTING_ENABLED !== 'false',
        cacheEnabled: process.env.SMART_CACHE_ENABLED !== 'false',
        totalRequests: periodLogs,
        cachedRequests,
        cacheHitRate: periodLogs > 0
          ? Math.round((cachedRequests / periodLogs) * 1000) / 10
          : 0,
        miniModelRequests,
        fullModelRequests,
        miniModelPercentage,
        fullModelPercentage,
        estimatedSavings: Math.round(estimatedSavings * 10000) / 10000,
        // Routing efficiency: higher = more queries routed to cheaper model
        routingEfficiency: totalNonCachedRequests > 0
          ? Math.round(((cachedRequests + miniModelRequests) / periodLogs) * 1000) / 10
          : 0,
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
