import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'
import { validatePaginationLimit, validatePositiveInt } from '@/lib/validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// GET /api/history/study-activity - Get user's study activity history
export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit history fetch (lenient - read operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.HISTORY_LIMIT)
    const offset = validatePositiveInt(searchParams.get('offset'), 0)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    // SCALABILITY: Single query with proper filtering - no N+1 issues
    const where: any = {
      OR: [
        { userId: user.id },
        { createdBy: user.id },
      ],
      endedAt: { not: null }, // Only completed sessions
      deletedByUserAt: null,  // Exclude user-deleted sessions
      deletedByAdminAt: null, // Exclude admin-deleted sessions
    }

    if (startDate || endDate) {
      where.startedAt = {}
      if (startDate) where.startedAt.gte = new Date(startDate)
      if (endDate) where.startedAt.lte = new Date(endDate)
    }

    // Get completed study sessions
    const sessions = await prisma.studySession.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        endedAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Calculate statistics (excluding deleted sessions)
    // SCALABILITY: Using Promise.all for parallel queries - efficient for 1000-3000 users
    const baseStatsWhere = {
      OR: [
        { userId: user.id },
        { createdBy: user.id },
      ],
      endedAt: { not: null },
      deletedByUserAt: null,
      deletedByAdminAt: null,
    }

    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)

    const [totalSessions, totalMinutes, sessionsThisMonth] = await Promise.all([
      prisma.studySession.count({ where: baseStatsWhere }),
      prisma.studySession.aggregate({
        where: baseStatsWhere,
        _sum: { durationMinutes: true },
      }),
      prisma.studySession.count({
        where: {
          ...baseStatsWhere,
          startedAt: { gte: thisMonthStart },
        },
      }),
    ])

    // Also fetch AI Partner sessions (separate model)
    // SCALABILITY: Parallel fetch for AI sessions
    const aiSessions = await prisma.aIPartnerSession.findMany({
      where: {
        userId: user.id,
        status: { in: ['COMPLETED', 'EXPIRED'] }, // Only completed sessions
        deletedByUserAt: null,
        deletedByAdminAt: null,
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { endedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Format study sessions
    const formattedStudySessions = sessions.map(session => ({
      id: session.id,
      title: session.title,
      description: session.description,
      type: session.type,
      sessionType: 'study' as const,
      isAISession: session.isAISession,
      subject: session.subject,
      durationMinutes: session.durationMinutes,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      creator: session.creator,
      participants: session.participants?.map(p => p.user) || [],
    }))

    // Format AI Partner sessions
    const formattedAISessions = aiSessions.map(session => ({
      id: session.id,
      title: `AI Study: ${session.subject || 'General'}`,
      description: session.studyGoal,
      type: 'AI_PARTNER',
      sessionType: 'ai' as const,
      isAISession: true,
      subject: session.subject,
      durationMinutes: session.totalDuration ? Math.round(session.totalDuration / 60) : null,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      persona: session.persona,
      messageCount: session.messageCount,
      rating: session.rating,
    }))

    // Combine and sort by endedAt
    const allSessions = [...formattedStudySessions, ...formattedAISessions]
      .sort((a, b) => {
        const dateA = a.endedAt ? new Date(a.endedAt).getTime() : 0
        const dateB = b.endedAt ? new Date(b.endedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, limit)

    return NextResponse.json({
      sessions: allSessions,
      statistics: {
        totalSessions: totalSessions + aiSessions.length,
        totalHours: Math.round((totalMinutes._sum.durationMinutes || 0) / 60 * 10) / 10,
        sessionsThisMonth,
      },
      pagination: {
        limit,
        offset,
        hasMore: sessions.length === limit || aiSessions.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching study activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch study activity' },
      { status: 500 }
    )
  }
}

