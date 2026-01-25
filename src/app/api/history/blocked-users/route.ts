import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

// GET /api/history/blocked-users - Get user's blocked users list
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for blocked users list reads
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

    // Get blocked users
    const blockedUsers = await prisma.blockedUser.findMany({
      where: {
        userId: user.id,
      },
      include: {
        blockedUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      blockedUsers: blockedUsers.map(bu => ({
        id: bu.id,
        user: bu.blockedUser,
        reason: bu.reason,
        blockedAt: bu.createdAt,
      })),
      count: blockedUsers.length,
    })
  } catch (error) {
    console.error('Error fetching blocked users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocked users' },
      { status: 500 }
    )
  }
}

