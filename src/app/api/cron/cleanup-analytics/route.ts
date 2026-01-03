/**
 * Analytics Cleanup Cron Job
 *
 * Cleans up old analytics data to prevent database bloat.
 * Runs daily at 2 AM.
 *
 * Cleans:
 * - Page visits older than 90 days
 * - Feature usage older than 90 days
 * - Search queries older than 30 days
 * - Session analytics older than 90 days
 * - Expired embedding cache entries
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minute timeout for cleanup

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}` && cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: Record<string, number> = {}

  try {
    logger.info('[Cron Cleanup Analytics] Starting cleanup')

    // Calculate cutoff dates
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Clean up page visits (90 days)
    const pageVisits = await prisma.userPageVisit.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    })
    results.pageVisits = pageVisits.count

    // Clean up feature usage (90 days)
    const featureUsage = await prisma.userFeatureUsage.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    })
    results.featureUsage = featureUsage.count

    // Clean up search queries (30 days - more recent data is useful)
    const searchQueries = await prisma.userSearchQuery.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    })
    results.searchQueries = searchQueries.count

    // Clean up session analytics (90 days)
    const sessionAnalytics = await prisma.userSessionAnalytics.deleteMany({
      where: { startedAt: { lt: ninetyDaysAgo } },
    })
    results.sessionAnalytics = sessionAnalytics.count

    // Clean up activity summaries older than 1 year
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    const activitySummaries = await prisma.userActivitySummary.deleteMany({
      where: { date: { lt: oneYearAgo } },
    })
    results.activitySummaries = activitySummaries.count

    // Clean up expired embedding cache
    try {
      const embeddingCache = await prisma.$executeRaw`
        DELETE FROM "SearchEmbeddingCache"
        WHERE expires_at < NOW()
      `
      results.embeddingCache = embeddingCache
    } catch {
      // Table might not exist yet
      results.embeddingCache = 0
    }

    // Clean up old AI usage logs (keep 90 days for billing)
    const aiUsageLogs = await prisma.aIUsageLog.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    })
    results.aiUsageLogs = aiUsageLogs.count

    const duration = Date.now() - startTime
    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0)

    logger.info('[Cron Cleanup Analytics] Completed', {
      totalDeleted,
      results,
      duration,
    })

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${totalDeleted} old records`,
      details: results,
      executionTime: duration,
    })
  } catch (error) {
    logger.error('[Cron Cleanup Analytics] Failed', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
