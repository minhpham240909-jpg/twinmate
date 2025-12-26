// API Endpoint: Refresh Admin Dashboard Materialized Views
// Called by cron job every 30 seconds to keep stats fresh
// Can also be manually triggered by admins

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { trackPerformance } from '@/lib/admin/performance'

// Cron secret for authentication (set in Vercel/Supabase)
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-here'

export async function POST(req: NextRequest) {
  const tracker = trackPerformance('/api/admin/refresh-views', 'POST')

  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization')
    const cronSecret = req.headers.get('x-cron-secret')

    // Allow cron jobs with secret OR authenticated admins
    const isCronJob = cronSecret === CRON_SECRET
    const isAdmin = authHeader && await verifyAdminAuth(authHeader)

    if (!isCronJob && !isAdmin) {
      await tracker.end(401)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Refresh all materialized views
    const startTime = Date.now()

    await prisma.$executeRaw`SELECT refresh_admin_dashboard_views()`

    const duration = Date.now() - startTime

    await tracker.end(200)

    return NextResponse.json({
      success: true,
      message: 'Materialized views refreshed successfully',
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Admin] Error refreshing materialized views:', error)

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

// Allow manual refresh via GET for admins
export async function GET(req: NextRequest) {
  const tracker = trackPerformance('/api/admin/refresh-views', 'GET')

  try {
    // Verify admin authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !(await verifyAdminAuth(authHeader))) {
      await tracker.end(401)
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get current view status
    const viewStats = await prisma.$queryRaw<Array<{
      generated_at: Date
      total_users: bigint
      online_users: bigint
      pending_reports: bigint
    }>>`
      SELECT generated_at, total_users, online_users, pending_reports
      FROM admin_dashboard_stats
      ORDER BY generated_at DESC
      LIMIT 1
    `

    if (viewStats.length === 0) {
      // Views not initialized
      return NextResponse.json({
        success: false,
        error: 'Materialized views not initialized. Run the setup SQL first.',
        initialized: false,
      })
    }

    const stats = viewStats[0]
    const age = Math.round((Date.now() - stats.generated_at.getTime()) / 1000)

    await tracker.end(200)

    return NextResponse.json({
      success: true,
      initialized: true,
      lastRefresh: stats.generated_at.toISOString(),
      ageSeconds: age,
      stats: {
        totalUsers: Number(stats.total_users),
        onlineUsers: Number(stats.online_users),
        pendingReports: Number(stats.pending_reports),
      },
    })
  } catch (error: any) {
    console.error('[Admin] Error getting view status:', error)

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

// Helper: Verify admin authentication
async function verifyAdminAuth(authHeader: string): Promise<boolean> {
  try {
    // Extract bearer token
    const token = authHeader.replace('Bearer ', '')

    // Use Supabase client to verify
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return false

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    return dbUser?.isAdmin === true && dbUser.deactivatedAt === null
  } catch (error) {
    console.error('[Admin] Auth verification error:', error)
    return false
  }
}
