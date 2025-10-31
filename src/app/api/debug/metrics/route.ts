// Debug API Route: Performance Metrics
// Shows collected API timing metrics
// Only available in development

import { NextRequest, NextResponse } from 'next/server'
import { getMetrics, resetMetrics } from '@/lib/middleware/timing'

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Metrics endpoint not available in production' },
      { status: 403 }
    )
  }

  const metrics = getMetrics()

  // Calculate summary statistics
  const summary = {
    totalRoutes: Object.keys(metrics).length,
    totalRequests: Object.values(metrics).reduce((sum: number, m: any) => sum + m.count, 0),
    totalErrors: Object.values(metrics).reduce((sum: number, m: any) => sum + m.errors, 0),
    slowestRoutes: Object.entries(metrics)
      .map(([route, stats]: [string, any]) => ({
        route,
        avgDuration: stats.avgDuration,
        maxDuration: stats.maxDuration,
        count: stats.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10),
  }

  return NextResponse.json({
    summary,
    metrics,
    timestamp: new Date().toISOString(),
  })
}

export async function DELETE(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Metrics endpoint not available in production' },
      { status: 403 }
    )
  }

  resetMetrics()

  return NextResponse.json({
    message: 'Metrics reset successfully',
    timestamp: new Date().toISOString(),
  })
}

