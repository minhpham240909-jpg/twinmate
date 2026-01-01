/**
 * GET /api/admin/sessions/deleted
 * View all user-deleted sessions (soft-deleted by users)
 * Admin can see these sessions even though users cannot
 *
 * SCALABILITY: Uses pagination and rate limiting
 * Safe for 1000-3000 concurrent users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { adminRateLimit } from '@/lib/admin/rate-limit'

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit admin deleted sessions view
  const rateLimitResult = await adminRateLimit(request, 'analytics')
  if (rateLimitResult) return rateLimitResult

  try {
    // Check if user is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const type = searchParams.get('type') // 'study', 'ai', or null for both
    const search = searchParams.get('search')

    // SCALABILITY: Parallel fetch for both session types with Promise.all
    const [studySessions, aiSessions] = await Promise.all([
      // Fetch deleted study sessions
      (type === 'ai' ? Promise.resolve([]) : prisma.studySession.findMany({
        where: {
          deletedByUserAt: { not: null },
          deletedByAdminAt: null, // Not permanently deleted
          ...(search && {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { deletedByUserAt: 'desc' },
        take: type === 'study' ? limit : Math.ceil(limit / 2),
        skip: type === 'study' ? (page - 1) * limit : 0,
      })),

      // Fetch deleted AI Partner sessions
      (type === 'study' ? Promise.resolve([]) : prisma.aIPartnerSession.findMany({
        where: {
          deletedByUserAt: { not: null },
          deletedByAdminAt: null, // Not permanently deleted
          ...(search && {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { studyGoal: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        include: {
          persona: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { deletedByUserAt: 'desc' },
        take: type === 'ai' ? limit : Math.ceil(limit / 2),
        skip: type === 'ai' ? (page - 1) * limit : 0,
      })),
    ])

    // Get user info for AI sessions (userId is string, not relation)
    const aiUserIds = [...new Set(aiSessions.map(s => s.userId))]
    const aiUsers = aiUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: aiUserIds } },
          select: { id: true, name: true, email: true, avatarUrl: true },
        })
      : []
    const aiUserMap = new Map(aiUsers.map(u => [u.id, u]))

    // Format study sessions
    const formattedStudySessions = studySessions.map(session => ({
      id: session.id,
      type: 'study' as const,
      title: session.title,
      subject: session.subject,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMinutes: session.durationMinutes,
      deletedByUserId: session.deletedByUserId,
      deletedByUserAt: session.deletedByUserAt,
      user: session.creator,
    }))

    // Format AI sessions
    const formattedAISessions = aiSessions.map(session => ({
      id: session.id,
      type: 'ai' as const,
      title: `AI Study: ${session.subject || 'General'}`,
      subject: session.subject,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMinutes: session.totalDuration ? Math.round(session.totalDuration / 60) : null,
      deletedByUserId: session.deletedByUserId,
      deletedByUserAt: session.deletedByUserAt,
      user: aiUserMap.get(session.userId) || null,
      persona: session.persona,
      messageCount: session.messageCount,
    }))

    // Combine and sort by deletedByUserAt
    const allSessions = [...formattedStudySessions, ...formattedAISessions]
      .sort((a, b) => {
        const dateA = a.deletedByUserAt ? new Date(a.deletedByUserAt).getTime() : 0
        const dateB = b.deletedByUserAt ? new Date(b.deletedByUserAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, limit)

    // Get total counts
    const [studyCount, aiCount] = await Promise.all([
      type === 'ai' ? Promise.resolve(0) : prisma.studySession.count({
        where: { deletedByUserAt: { not: null }, deletedByAdminAt: null },
      }),
      type === 'study' ? Promise.resolve(0) : prisma.aIPartnerSession.count({
        where: { deletedByUserAt: { not: null }, deletedByAdminAt: null },
      }),
    ])

    // Log admin view
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'VIEW_DELETED_SESSIONS',
        targetType: 'SYSTEM',
        targetId: 'deleted-sessions',
        details: { page, limit, type, search },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        sessions: allSessions,
        pagination: {
          page,
          limit,
          total: studyCount + aiCount,
          totalPages: Math.ceil((studyCount + aiCount) / limit),
          hasMore: allSessions.length === limit,
        },
        counts: {
          study: studyCount,
          ai: aiCount,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching deleted sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deleted sessions' },
      { status: 500 }
    )
  }
}
