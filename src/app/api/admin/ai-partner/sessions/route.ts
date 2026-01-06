/**
 * Admin AI Partner Sessions API
 * GET /api/admin/ai-partner/sessions - List all AI Partner sessions with full details
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (ACTIVE, PAUSED, COMPLETED, BLOCKED, EXPIRED)
 * - userId: Filter by specific user
 * - flagged: Only show sessions with flagged messages (true/false)
 * - search: Search in subject or user email
 * - sortBy: Sort field (createdAt, messageCount, duration)
 * - sortOrder: asc or desc
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AISessionStatus, Prisma } from '@prisma/client'
import { adminRateLimit } from '@/lib/admin/rate-limit'

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit admin AI sessions list requests
  const rateLimitResult = await adminRateLimit(request, 'analytics')
  if (rateLimitResult) return rateLimitResult

  try {
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
      select: { isAdmin: true, name: true, email: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status') as AISessionStatus | null
    const userId = searchParams.get('userId')
    const flaggedOnly = searchParams.get('flagged') === 'true'
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Build where clause
    const where: Prisma.AIPartnerSessionWhereInput = {}

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    if (flaggedOnly) {
      where.flaggedCount = { gt: 0 }
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Build orderBy
    const orderBy: Prisma.AIPartnerSessionOrderByWithRelationInput = {}
    if (sortBy === 'messageCount') {
      orderBy.messageCount = sortOrder
    } else if (sortBy === 'duration') {
      orderBy.totalDuration = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    // Execute queries in parallel
    const [total, sessions] = await Promise.all([
      prisma.aIPartnerSession.count({ where }),
      prisma.aIPartnerSession.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          subject: true,
          skillLevel: true,
          studyGoal: true,
          status: true,
          startedAt: true,
          endedAt: true,
          totalDuration: true,
          messageCount: true,
          quizCount: true,
          flashcardCount: true,
          rating: true,
          feedback: true,
          flaggedCount: true,
          wasSafetyBlocked: true,
          createdAt: true,
          updatedAt: true,
          persona: {
            select: {
              id: true,
              name: true,
            }
          },
        }
      }),
    ])

    // Get user details for each session (userId is a string, not a relation)
    // This is acceptable for paginated results (max 100 unique users per page)
    const userIds = [...new Set(sessions.map(s => s.userId))]
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          }
        })
      : []
    const userMap = new Map(users.map(u => [u.id, u]))

    // Format sessions with user info
    const formattedSessions = sessions.map(session => ({
      ...session,
      user: userMap.get(session.userId) || null,
      durationFormatted: session.totalDuration
        ? formatDuration(session.totalDuration)
        : null,
    }))

    // Log admin view (non-blocking to prevent errors from affecting the response)
    prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        adminName: adminUser.name,
        adminEmail: adminUser.email,
        action: 'VIEW_AI_PARTNER_SESSIONS',
        targetType: 'SYSTEM',
        targetId: 'ai-partner-sessions',
        details: { page, limit, filters: { status, userId, flaggedOnly, search } },
      }
    }).catch(err => console.error('Failed to log admin action:', err))

    return NextResponse.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        }
      }
    })

  } catch (error) {
    console.error('Error fetching AI Partner sessions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI Partner sessions' },
      { status: 500 }
    )
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}
