/**
 * Real-Time Online Users API
 *
 * Optimized endpoint for tracking users currently online.
 * Uses UserPresence heartbeat system with 2-minute threshold.
 * Now integrated with WebSocket for real-time updates, with fallback polling.
 * Rate limited to prevent abuse (analytics preset: 15 requests/minute).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrSetCached } from '@/lib/cache'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// Short cache TTL for real-time data (10 seconds)
const ONLINE_USERS_CACHE_TTL = 10

// Users are considered online if heartbeat within last 2 minutes
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting (analytics preset: 15 requests/minute)
    const rateLimitResult = await adminRateLimit(req, 'analytics')
    if (rateLimitResult) return rateLimitResult

    // Check if user is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Use short-lived cache to reduce database load during frequent polling
    const cacheKey = 'admin:realtime:online-users'

    const onlineData = await getOrSetCached(cacheKey, ONLINE_USERS_CACHE_TTL, async () => {
      const now = new Date()
      const threshold = new Date(now.getTime() - ONLINE_THRESHOLD_MS)

      // Get all online users with their basic info
      // Uses lastSeenAt field with index for efficient queries
      const onlinePresences = await prisma.userPresence.findMany({
        where: {
          status: 'online', // lowercase as per schema
          lastSeenAt: { gte: threshold },
        },
        select: {
          userId: true,
          lastSeenAt: true,
          lastActivityAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            }
          }
        },
        orderBy: { lastSeenAt: 'desc' },
      })

      // Count active device sessions for page breakdown
      // DeviceSession tracks actual page views via userAgent
      const activeDeviceSessions = await prisma.deviceSession.findMany({
        where: {
          isActive: true,
          lastHeartbeatAt: { gte: threshold },
        },
        select: {
          userId: true,
          userAgent: true,
        }
      })

      // Get page visits in last 5 minutes for real-time page breakdown
      const pageVisitThreshold = new Date(now.getTime() - 5 * 60 * 1000)
      const recentPageVisits = await prisma.userPageVisit.groupBy({
        by: ['path'],
        where: {
          createdAt: { gte: pageVisitThreshold },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      })

      const pageBreakdown = recentPageVisits.map(p => {
        // Normalize page paths (remove dynamic segments)
        const normalizedPage = p.path
          .replace(/\/[a-f0-9-]{36}/g, '/[id]') // UUID patterns
          .replace(/\/\d+/g, '/[id]') // Numeric IDs
        return { page: normalizedPage, count: p._count.id }
      })

      return {
        count: onlinePresences.length,
        activeDevices: activeDeviceSessions.length,
        users: onlinePresences.slice(0, 20).map(p => ({
          id: p.user.id,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
          currentPage: null, // Not tracked in UserPresence
          lastSeen: p.lastSeenAt,
        })),
        pageBreakdown,
        timestamp: now.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data: onlineData,
    })
  } catch (error) {
    console.error('Error fetching online users:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch online users' },
      { status: 500 }
    )
  }
}
