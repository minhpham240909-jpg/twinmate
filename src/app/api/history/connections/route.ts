import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'
import { validatePaginationLimit, validatePositiveInt } from '@/lib/validation'

// GET /api/history/connections - Get user's match/connection history
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for connections history reads
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.HISTORY_LIMIT)
    const offset = validatePositiveInt(searchParams.get('offset'), 0)
    const status = searchParams.get('status') // PENDING, ACCEPTED, REJECTED, CANCELLED

    // Build where clause
    const where: any = {
      OR: [
        { senderId: user.id },
        { receiverId: user.id },
      ],
    }

    if (status) {
      where.status = status
    }

    // Get matches
    const matches = await prisma.match.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Calculate statistics using groupBy to avoid N+1 (6 queries → 2 queries)
    const [sentStats, receivedStats] = await Promise.all([
      prisma.match.groupBy({
        by: ['status'],
        where: { senderId: user.id },
        _count: { _all: true },
      }),
      prisma.match.groupBy({
        by: ['status'],
        where: { receiverId: user.id },
        _count: { _all: true },
      }),
    ])

    // Transform groupBy results into counts
    const sentCounts = sentStats.reduce((acc, item) => {
      acc[item.status] = item._count._all
      return acc
    }, {} as Record<string, number>)

    const receivedCounts = receivedStats.reduce((acc, item) => {
      acc[item.status] = item._count._all
      return acc
    }, {} as Record<string, number>)

    const totalSent = Object.values(sentCounts).reduce((a, b) => a + b, 0)
    const totalReceived = Object.values(receivedCounts).reduce((a, b) => a + b, 0)
    const acceptedSent = sentCounts['ACCEPTED'] || 0
    const acceptedReceived = receivedCounts['ACCEPTED'] || 0
    const pendingSent = sentCounts['PENDING'] || 0
    const pendingReceived = receivedCounts['PENDING'] || 0

    return NextResponse.json({
      matches: matches.map(match => ({
        id: match.id,
        status: match.status,
        message: match.message,
        compatibilityScore: match.compatibilityScore,
        matchReason: match.matchReason,
        createdAt: match.createdAt,
        respondedAt: match.respondedAt,
        sender: match.sender,
        receiver: match.receiver,
        isSender: match.senderId === user.id,
      })),
      statistics: {
        sent: {
          total: totalSent,
          accepted: acceptedSent,
          pending: pendingSent,
        },
        received: {
          total: totalReceived,
          accepted: acceptedReceived,
          pending: pendingReceived,
        },
      },
      pagination: {
        limit,
        offset,
        hasMore: matches.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching connections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

