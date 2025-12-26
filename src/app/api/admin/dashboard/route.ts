// Admin Dashboard API - Get all dashboard statistics
// Includes rate limiting and performance monitoring
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
  getAdminDashboardStats,
  getUserGrowthData,
  getRecentSignups,
} from '@/lib/admin/utils'
import { adminRateLimit, getRateLimitHeaders } from '@/lib/admin/rate-limit'

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting (dashboard preset: 30 requests/minute)
    const rateLimitResult = await adminRateLimit(req, 'dashboard')
    if (rateLimitResult) return rateLimitResult

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify admin status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    // Check if only recent signups are requested (for real-time updates)
    const url = new URL(req.url)
    const recentSignupsOnly = url.searchParams.get('recentSignupsOnly') === 'true'

    if (recentSignupsOnly) {
      // Lightweight request for just recent signups
      const recentSignups = await getRecentSignups(10)
      const headers = await getRateLimitHeaders(req, 'dashboard')

      return NextResponse.json(
        {
          success: true,
          data: {
            recentSignups,
            generatedAt: new Date().toISOString(),
          },
        },
        { headers }
      )
    }

    // Get all dashboard data (uses cached queries with indexes)
    const [stats, growthData, recentSignups] = await Promise.all([
      getAdminDashboardStats(),
      getUserGrowthData(30),
      getRecentSignups(10),
    ])

    // Add rate limit headers to response
    const headers = await getRateLimitHeaders(req, 'dashboard')

    return NextResponse.json(
      {
        success: true,
        data: {
          stats,
          growthData,
          recentSignups,
          generatedAt: new Date().toISOString(),
        },
      },
      { headers }
    )
  } catch (error) {
    console.error('[Admin Dashboard] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
