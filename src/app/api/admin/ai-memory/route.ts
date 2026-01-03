/**
 * Admin AI Memory API
 * GET /api/admin/ai-memory - Get all users' memory stats for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// GET: Get memory stats for admin dashboard
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (default preset: 100 requests/minute)
    const rateLimitResult = await adminRateLimit(request, 'default')
    if (rateLimitResult) return rateLimitResult

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!dbUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // If specific user requested
    if (userId) {
      const [userMemory, memoryEntries, entryCounts] = await Promise.all([
        prisma.aIUserMemory.findUnique({
          where: { userId },
        }),
        prisma.aIMemoryEntry.findMany({
          where: { userId, isActive: true },
          orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
          take: 100,
        }),
        prisma.aIMemoryEntry.groupBy({
          by: ['category'],
          where: { userId, isActive: true },
          _count: { category: true },
        }),
      ])

      // Get user info
      const userInfo = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      })

      return NextResponse.json({
        success: true,
        user: userInfo,
        memory: userMemory,
        entries: memoryEntries,
        categoryCounts: entryCounts.reduce((acc, cat) => {
          acc[cat.category] = cat._count.category
          return acc
        }, {} as Record<string, number>),
      })
    }

    // Get aggregate stats for all users
    const [
      totalMemoryUsers,
      totalMemoryEntries,
      activeMemoryEntries,
      topUsers,
      categoryStats,
      recentMemories,
    ] = await Promise.all([
      prisma.aIUserMemory.count(),
      prisma.aIMemoryEntry.count(),
      prisma.aIMemoryEntry.count({ where: { isActive: true } }),
      // Top users by total sessions
      prisma.aIUserMemory.findMany({
        orderBy: { totalSessions: 'desc' },
        take: 10,
        select: {
          userId: true,
          totalSessions: true,
          totalStudyMinutes: true,
          streakDays: true,
          longestStreak: true,
          currentSubjects: true,
        },
      }),
      // Category breakdown
      prisma.aIMemoryEntry.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { category: true },
      }),
      // Recent memory entries
      prisma.aIMemoryEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          userId: true,
          category: true,
          content: true,
          importance: true,
          createdAt: true,
        },
      }),
    ])

    // Enrich top users with user info (userId is a string, not a relation)
    // This is acceptable since the list is small (10 users max)
    const userIds = topUsers.map(u => u.userId)
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, avatarUrl: true },
        })
      : []

    const usersMap = users.reduce((acc, u) => {
      acc[u.id] = u
      return acc
    }, {} as Record<string, typeof users[0]>)

    const enrichedTopUsers = topUsers.map(u => ({
      ...u,
      user: usersMap[u.userId] || null,
    }))

    // Calculate aggregate stats
    const totalStudyMinutes = await prisma.aIUserMemory.aggregate({
      _sum: { totalStudyMinutes: true },
    })

    const avgSessionsPerUser = totalMemoryUsers > 0
      ? (await prisma.aIUserMemory.aggregate({ _avg: { totalSessions: true } }))._avg?.totalSessions || 0
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        totalMemoryUsers,
        totalMemoryEntries,
        activeMemoryEntries,
        totalStudyMinutes: totalStudyMinutes._sum.totalStudyMinutes || 0,
        avgSessionsPerUser: Math.round(avgSessionsPerUser * 10) / 10,
        categoryCounts: categoryStats.reduce((acc, cat) => {
          acc[cat.category] = cat._count.category
          return acc
        }, {} as Record<string, number>),
      },
      topUsers: enrichedTopUsers,
      recentMemories,
    })
  } catch (error) {
    console.error('[Admin AI Memory] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get memory stats' },
      { status: 500 }
    )
  }
}
