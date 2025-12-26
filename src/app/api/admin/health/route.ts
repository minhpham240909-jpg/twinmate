// Admin Dashboard Health Check API
// Returns comprehensive health status and performance metrics
// Use this to monitor dashboard health in production

import { NextRequest, NextResponse } from 'next/server'
import { runHealthCheck, getDashboardMetrics, generateDiagnosticReport } from '@/lib/admin/monitoring'
import { trackPerformance } from '@/lib/admin/performance'

export async function GET(req: NextRequest) {
  const tracker = trackPerformance('/api/admin/health', 'GET')

  try {
    const url = new URL(req.url)
    const detailed = url.searchParams.get('detailed') === 'true'

    if (detailed) {
      // Full diagnostic report (for troubleshooting)
      const report = await generateDiagnosticReport()

      await tracker.end(200)

      return NextResponse.json({
        success: true,
        ...report,
      })
    }

    // Basic health check (fast, for monitoring)
    const [health, metrics] = await Promise.all([
      runHealthCheck(),
      getDashboardMetrics(),
    ])

    await tracker.end(200)

    return NextResponse.json({
      success: true,
      healthy: health.healthy,
      score: health.score,
      checks: health.checks,
      alerts: health.alerts,
      metrics,
      timestamp: health.timestamp,
    })
  } catch (error: any) {
    console.error('[Health] Error running health check:', error)

    await tracker.end(500, error.message)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
