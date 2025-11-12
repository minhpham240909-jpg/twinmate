import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/history/connections - Get user's match/connection history
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

    // Calculate statistics
    const totalSent = await prisma.match.count({
      where: { senderId: user.id },
    })

    const totalReceived = await prisma.match.count({
      where: { receiverId: user.id },
    })

    const acceptedMatches = await prisma.match.count({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
      } as any,
    })

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
        isSent: match.senderId === user.id,
      })),
      statistics: {
        totalSent,
        totalReceived,
        acceptedMatches,
        totalMatches: totalSent + totalReceived,
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

