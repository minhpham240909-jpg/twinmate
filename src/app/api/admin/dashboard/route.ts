// Admin Dashboard API - Get all dashboard statistics
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
  getAdminDashboardStats,
  getUserGrowthData,
  getRecentSignups,
} from '@/lib/admin/utils'

export async function GET() {
  try {
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

    // Get all dashboard data
    const [stats, growthData, recentSignups] = await Promise.all([
      getAdminDashboardStats(),
      getUserGrowthData(30),
      getRecentSignups(10),
    ])

    return NextResponse.json({
      success: true,
      data: {
        stats,
        growthData,
        recentSignups,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Admin Dashboard] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
