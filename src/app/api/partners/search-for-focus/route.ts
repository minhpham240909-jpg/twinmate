import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'

// Schema for searching partners
const searchPartnersSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(50).optional().default(10),
})

/**
 * POST /api/partners/search-for-focus
 * Search accepted partners by name for quick focus session invitations
 *
 * Features:
 * - Fast autocomplete search by partner name
 * - Only returns accepted partners (not pending connections)
 * - Returns online status for better UX
 * - Optimized with proper indexing to prevent N+1 queries
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = searchPartnersSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { query, limit } = validation.data

    // PERFORMANCE OPTIMIZATION: Single query with join to get partners with user details
    // Using case-insensitive search with ILIKE (PostgreSQL)
    const matches = await prisma.match.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          {
            user1Id: user.id,
            user2: {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
          {
            user2Id: user.id,
            user1: {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            presence: {
              select: {
                onlineStatus: true,
                activityType: true,
                lastSeenAt: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            presence: {
              select: {
                onlineStatus: true,
                activityType: true,
                lastSeenAt: true,
              },
            },
          },
        },
      },
      take: limit,
    })

    // Map matches to partner objects
    const partners = matches.map(match => {
      const isUser1 = match.user1Id === user.id
      const partner = isUser1 ? match.user2 : match.user1

      return {
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl,
        onlineStatus: partner.presence?.onlineStatus || 'OFFLINE',
        activityType: partner.presence?.activityType || null,
        lastSeenAt: partner.presence?.lastSeenAt || null,
      }
    })

    // Sort by online status (ONLINE first) then by name
    partners.sort((a, b) => {
      if (a.onlineStatus === 'ONLINE' && b.onlineStatus !== 'ONLINE') return -1
      if (a.onlineStatus !== 'ONLINE' && b.onlineStatus === 'ONLINE') return 1
      return a.name.localeCompare(b.name)
    })

    logger.info('Partner search for focus session', {
      data: {
        userId: user.id,
        query,
        resultsCount: partners.length,
      },
    })

    return NextResponse.json({
      success: true,
      partners,
    })
  } catch (error) {
    logger.error('Error searching partners for focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
