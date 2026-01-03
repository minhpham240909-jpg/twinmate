/**
 * Stats Aggregation Cron Job
 *
 * Aggregates daily statistics for faster dashboard queries.
 * Runs daily at 3 AM.
 *
 * Creates/updates:
 * - Daily user activity summaries
 * - AI usage daily summaries
 * - Platform-wide daily stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minute timeout

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}` && cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: Record<string, unknown> = {}

  try {
    logger.info('[Cron Aggregate Stats] Starting aggregation')

    // Get yesterday's date (we aggregate previous day's data)
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    const yesterdayEnd = new Date(yesterdayStart.getTime() + 24 * 60 * 60 * 1000)

    // 1. Aggregate user activity summaries for yesterday
    // Get all users who had activity yesterday
    const activeUsers = await prisma.userSessionAnalytics.findMany({
      where: {
        startedAt: { gte: yesterdayStart, lt: yesterdayEnd },
      },
      select: {
        userId: true,
        totalDuration: true,
      },
    })

    // Group by userId
    const userActivityMap = new Map<string, { sessions: number; duration: number }>()
    for (const session of activeUsers) {
      const existing = userActivityMap.get(session.userId) || { sessions: 0, duration: 0 }
      userActivityMap.set(session.userId, {
        sessions: existing.sessions + 1,
        duration: existing.duration + (session.totalDuration || 0),
      })
    }

    // Get additional stats per user
    const userIds = [...userActivityMap.keys()]

    if (userIds.length > 0) {
      // Page views per user
      const pageViews = await prisma.userPageVisit.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
        _count: { _all: true },
      })
      const pageViewMap = new Map(pageViews.map(p => [p.userId, p._count._all]))

      // Messages per user
      const messages = await prisma.message.groupBy({
        by: ['senderId'],
        where: {
          senderId: { in: userIds },
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
        _count: { _all: true },
      })
      const messageMap = new Map(messages.map(m => [m.senderId, m._count._all]))

      // Posts per user
      const posts = await prisma.post.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
        _count: { _all: true },
      })
      const postMap = new Map(posts.map(p => [p.userId, p._count._all]))

      // Upsert activity summaries (batch in chunks to avoid timeout)
      const BATCH_SIZE = 100
      let aggregatedCount = 0

      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batch.map(async (userId) => {
            const activity = userActivityMap.get(userId)!

            try {
              await prisma.userActivitySummary.upsert({
                where: {
                  userId_date: {
                    userId,
                    date: yesterdayStart,
                  },
                },
                create: {
                  userId,
                  date: yesterdayStart,
                  totalSessions: activity.sessions,
                  totalDuration: activity.duration,
                  totalPageViews: pageViewMap.get(userId) || 0,
                  messagesSent: messageMap.get(userId) || 0,
                  postsCreated: postMap.get(userId) || 0,
                },
                update: {
                  totalSessions: activity.sessions,
                  totalDuration: activity.duration,
                  totalPageViews: pageViewMap.get(userId) || 0,
                  messagesSent: messageMap.get(userId) || 0,
                  postsCreated: postMap.get(userId) || 0,
                },
              })
              aggregatedCount++
            } catch (e) {
              // Skip individual failures
              logger.warn(`[Aggregate] Failed for user ${userId}`, { error: e })
            }
          })
        )
      }

      results.userSummaries = aggregatedCount
    } else {
      results.userSummaries = 0
    }

    // 2. Aggregate AI usage daily summary
    const aiUsageStats = await prisma.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
      },
      _count: { _all: true },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
      },
      _avg: {
        latencyMs: true,
      },
    })

    const aiRequestCount = aiUsageStats._count._all

    // Upsert AI usage summary (global summary with userId = null)
    if (aiRequestCount > 0) {
      await prisma.aIUsageDailySummary.upsert({
        where: {
          date_userId: {
            date: yesterdayStart,
            userId: '', // Use empty string for global summary
          },
        },
        create: {
          date: yesterdayStart,
          userId: null,
          totalRequests: aiRequestCount,
          promptTokens: aiUsageStats._sum?.promptTokens || 0,
          completionTokens: aiUsageStats._sum?.completionTokens || 0,
          totalTokens: aiUsageStats._sum?.totalTokens || 0,
          totalCost: aiUsageStats._sum?.estimatedCost || 0,
          avgLatencyMs: Math.round(aiUsageStats._avg?.latencyMs || 0),
        },
        update: {
          totalRequests: aiRequestCount,
          promptTokens: aiUsageStats._sum?.promptTokens || 0,
          completionTokens: aiUsageStats._sum?.completionTokens || 0,
          totalTokens: aiUsageStats._sum?.totalTokens || 0,
          totalCost: aiUsageStats._sum?.estimatedCost || 0,
          avgLatencyMs: Math.round(aiUsageStats._avg?.latencyMs || 0),
        },
      })
      results.aiUsageSummary = 'updated'
    } else {
      results.aiUsageSummary = 'no data'
    }

    // 3. Platform-wide stats for yesterday
    const [
      newUsers,
      newMatches,
      totalMessages,
      totalPosts,
      totalSessions,
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }),
      prisma.match.count({
        where: {
          status: 'ACCEPTED',
          updatedAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
      }),
      prisma.message.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }),
      prisma.post.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }),
      prisma.studySession.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }),
    ])

    results.platformStats = {
      date: yesterdayStart.toISOString().split('T')[0],
      newUsers,
      newMatches,
      totalMessages,
      totalPosts,
      totalSessions,
    }

    const duration = Date.now() - startTime

    logger.info('[Cron Aggregate Stats] Completed', {
      results,
      duration,
    })

    return NextResponse.json({
      success: true,
      message: 'Stats aggregation completed',
      details: results,
      executionTime: duration,
    })
  } catch (error) {
    logger.error('[Cron Aggregate Stats] Failed', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
