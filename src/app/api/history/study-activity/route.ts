import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/history/study-activity - Get user's study activity history
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {
      OR: [
        { userId: user.id },
        { createdBy: user.id },
      ],
      endedAt: { not: null }, // Only completed sessions
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

    // Calculate statistics
    const totalSessions = await prisma.studySession.count({
      where: {
        OR: [
          { userId: user.id },
          { createdBy: user.id },
        ],
        endedAt: { not: null },
      },
    })

    const totalMinutes = await prisma.studySession.aggregate({
      where: {
        OR: [
          { userId: user.id },
          { createdBy: user.id },
        ],
        endedAt: { not: null },
      },
      _sum: {
        durationMinutes: true,
      },
    })

    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)

    const sessionsThisMonth = await prisma.studySession.count({
      where: {
        OR: [
          { userId: user.id },
          { createdBy: user.id },
        ],
        endedAt: { not: null },
        startedAt: { gte: thisMonthStart },
      },
    })

    return NextResponse.json({
      sessions: sessions.map(session => ({
        id: session.id,
        title: session.title,
        description: session.description,
        type: session.type,
        subject: session.subject,
        durationMinutes: session.durationMinutes,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        aiSummary: session.aiSummary,
        aiKeyPoints: session.aiKeyPoints,
        creator: session.creator,
        participants: session.participants?.map(p => p.user) || [],
      })),
      statistics: {
        totalSessions,
        totalHours: Math.round((totalMinutes._sum.durationMinutes || 0) / 60 * 10) / 10,
        sessionsThisMonth,
      },
      pagination: {
        limit,
        offset,
        hasMore: sessions.length === limit,
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

