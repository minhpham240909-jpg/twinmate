/**
 * Cache Warmup Cron Endpoint
 *
 * Warms up critical caches to prevent cold cache hits.
 * Should be called after deployment and periodically (every 5-10 minutes).
 *
 * Configure in vercel.json crons array with schedule "every 10 minutes"
 */

import { NextRequest, NextResponse } from 'next/server'
import { warmupCriticalCaches } from '@/lib/cache/warmup'
import logger from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 second timeout for warmup

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Allow Vercel cron (no auth header but from Vercel) or valid secret
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const hasValidSecret = authHeader === `Bearer ${cronSecret}`

  if (!isVercelCron && !hasValidSecret && cronSecret) {
    logger.warn('[Cron Warmup] Unauthorized access attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    logger.info('[Cron Warmup] Starting cache warmup')
    const startTime = Date.now()

    const report = await warmupCriticalCaches()

    const duration = Date.now() - startTime

    logger.info('[Cron Warmup] Completed', {
      successful: report.successfulCaches,
      failed: report.failedCaches,
      duration,
    })

    return NextResponse.json({
      success: true,
      report,
      executionTime: duration,
    })
  } catch (error) {
    logger.error('[Cron Warmup] Failed', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST also supported for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
