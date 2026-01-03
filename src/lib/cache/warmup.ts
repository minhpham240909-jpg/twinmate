/**
 * Cache Warmup System
 *
 * Proactively warms commonly accessed caches after deployment
 * to prevent cold cache hits and ensure fast first-load experiences.
 *
 * Run this on server start or via a cron job after deployment.
 */

import { prisma } from '@/lib/prisma'
import { getOrSetCached, CACHE_TTL, CACHE_PREFIX } from '@/lib/cache'
import logger from '@/lib/logger'

interface WarmupResult {
  cache: string
  success: boolean
  durationMs: number
  error?: string
}

interface WarmupReport {
  totalCaches: number
  successfulCaches: number
  failedCaches: number
  totalDurationMs: number
  results: WarmupResult[]
  timestamp: string
}

/**
 * Warm up critical caches that are frequently accessed
 */
export async function warmupCriticalCaches(): Promise<WarmupReport> {
  const startTime = Date.now()
  const results: WarmupResult[] = []

  logger.info('[Cache Warmup] Starting cache warmup...')

  // Define caches to warm up
  const warmupTasks = [
    {
      name: 'admin:analytics:overview:7d',
      fn: warmupAnalyticsOverview,
    },
    {
      name: 'admin:analytics:charts:7d',
      fn: warmupAnalyticsCharts,
    },
    {
      name: 'popular:subjects',
      fn: warmupPopularSubjects,
    },
    {
      name: 'active:groups:count',
      fn: warmupActiveGroupsCount,
    },
    {
      name: 'system:stats',
      fn: warmupSystemStats,
    },
  ]

  // Execute warmup tasks in parallel (but with error isolation)
  await Promise.all(
    warmupTasks.map(async (task) => {
      const taskStart = Date.now()
      try {
        await task.fn()
        results.push({
          cache: task.name,
          success: true,
          durationMs: Date.now() - taskStart,
        })
        logger.debug(`[Cache Warmup] Warmed ${task.name}`)
      } catch (error) {
        results.push({
          cache: task.name,
          success: false,
          durationMs: Date.now() - taskStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        logger.warn(`[Cache Warmup] Failed to warm ${task.name}`, { error })
      }
    })
  )

  const report: WarmupReport = {
    totalCaches: warmupTasks.length,
    successfulCaches: results.filter((r) => r.success).length,
    failedCaches: results.filter((r) => !r.success).length,
    totalDurationMs: Date.now() - startTime,
    results,
    timestamp: new Date().toISOString(),
  }

  logger.info('[Cache Warmup] Completed', {
    successful: report.successfulCaches,
    failed: report.failedCaches,
    durationMs: report.totalDurationMs,
  })

  return report
}

/**
 * Warm up analytics overview cache
 */
async function warmupAnalyticsOverview(): Promise<void> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 7)

  const cacheKey = 'admin:analytics:overview:7d'
  const ANALYTICS_CACHE_TTL = 120

  await getOrSetCached(cacheKey, ANALYTICS_CACHE_TTL, async () => {
    const now = new Date()
    const onlineThreshold = new Date(now.getTime() - 2 * 60 * 1000)

    const [
      totalUsers,
      newUsersThisPeriod,
      onlineUsersNow,
      totalMessages,
      totalPosts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.userPresence.count({
        where: { status: 'online', lastSeenAt: { gte: onlineThreshold } },
      }),
      prisma.message.count({ where: { createdAt: { gte: startDate } } }),
      prisma.post.count({ where: { createdAt: { gte: startDate } } }),
    ])

    return {
      summary: {
        totalUsers,
        newUsersThisPeriod,
        onlineUsersNow,
        totalMessages,
        totalPosts,
      },
    }
  })
}

/**
 * Warm up analytics charts cache
 */
async function warmupAnalyticsCharts(): Promise<void> {
  const cacheKey = 'admin:analytics:charts:7d'
  const ANALYTICS_CACHE_TTL = 120

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  await getOrSetCached(cacheKey, ANALYTICS_CACHE_TTL, async () => {
    const [totalUsers, totalMessages, totalSessions, totalGroups] =
      await Promise.all([
        prisma.user.count(),
        prisma.message.count(),
        prisma.studySession.count(),
        prisma.group.count({ where: { isDeleted: false } }),
      ])

    return {
      overview: {
        totalUsers,
        totalMessages,
        totalSessions,
        totalGroups,
      },
    }
  })
}

/**
 * Warm up popular subjects cache
 */
async function warmupPopularSubjects(): Promise<void> {
  const cacheKey = `${CACHE_PREFIX.STATS}:popular:subjects`

  await getOrSetCached(cacheKey, CACHE_TTL.STATISTICS, async () => {
    // Get most common subjects from groups
    const popularSubjects = await prisma.group.groupBy({
      by: ['subject'],
      where: { isDeleted: false },
      _count: { _all: true },
      orderBy: { _count: { subject: 'desc' } },
      take: 20,
    })

    return popularSubjects.map((s) => ({
      subject: s.subject,
      count: s._count._all,
    }))
  })
}

/**
 * Warm up active groups count cache
 */
async function warmupActiveGroupsCount(): Promise<void> {
  const cacheKey = `${CACHE_PREFIX.STATS}:active:groups:count`

  await getOrSetCached(cacheKey, CACHE_TTL.STATISTICS, async () => {
    const count = await prisma.group.count({
      where: { isDeleted: false, privacy: 'PUBLIC' },
    })
    return { count }
  })
}

/**
 * Warm up system stats cache
 */
async function warmupSystemStats(): Promise<void> {
  const cacheKey = `${CACHE_PREFIX.STATS}:system:stats`

  await getOrSetCached(cacheKey, CACHE_TTL.STATISTICS, async () => {
    const [userCount, groupCount, sessionCount, matchCount] = await Promise.all([
      prisma.user.count(),
      prisma.group.count({ where: { isDeleted: false } }),
      prisma.studySession.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
    ])

    return {
      users: userCount,
      groups: groupCount,
      sessions: sessionCount,
      matches: matchCount,
      updatedAt: new Date().toISOString(),
    }
  })
}

/**
 * Run warmup with error handling (safe for production)
 */
export async function safeWarmupCaches(): Promise<WarmupReport | null> {
  try {
    return await warmupCriticalCaches()
  } catch (error) {
    logger.error('[Cache Warmup] Critical failure', { error })
    return null
  }
}
