import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheKeys, CacheTTL } from '@/lib/redis'

/**
 * GET /api/presence/online-partners
 * Fetches presence status for all connected partners (accepted matches)
 *
 * PERFORMANCE OPTIMIZATION:
 * - Uses a single optimized query with JOIN instead of N+1 pattern
 * - Fetches partners and their presence in one database call
 * - Scales efficiently with 1000+ connections
 */
export async function GET() {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. PERF: Use Redis cache to reduce database load at scale
    // This endpoint is called frequently by all users to check partner presence
    // Cache for 10 seconds to balance freshness vs performance
    const presenceMap = await cacheGet(
      CacheKeys.ONLINE_PARTNERS(user.id),
      async () => {
        // OPTIMIZED: Single query to get partners with their presence status
        // Uses Prisma's relation queries to JOIN Match -> User -> UserPresence
        // This eliminates the N+1 pattern and scales to thousands of connections
        const partnersWithPresence = await prisma.match.findMany({
          where: {
            status: 'ACCEPTED',
            OR: [
              { senderId: user.id },
              { receiverId: user.id },
            ],
          },
          select: {
            senderId: true,
            receiverId: true,
            // Include partner's presence via the User relation
            sender: {
              select: {
                id: true,
                presence: {
                  select: {
                    status: true,
                    lastSeenAt: true,
                    lastActivityAt: true,
                    isPrivate: true,
                  },
                },
              },
            },
            receiver: {
              select: {
                id: true,
                presence: {
                  select: {
                    status: true,
                    lastSeenAt: true,
                    lastActivityAt: true,
                    isPrivate: true,
                  },
                },
              },
            },
          },
        })

        // Format response - extract partner presence based on who the partner is
        const result: Record<string, {
          status: string
          lastSeenAt: string
          lastActivityAt: string
          isPrivate: boolean
        }> = {}

        for (const match of partnersWithPresence) {
          // Determine which user is the partner (not the current user)
          const isCurrentUserSender = match.senderId === user.id
          const partner = isCurrentUserSender ? match.receiver : match.sender
          const partnerId = partner.id
          const presence = partner.presence

          // Only add if we haven't seen this partner yet (handles duplicate matches edge case)
          if (!result[partnerId]) {
            if (presence) {
              result[partnerId] = {
                status: presence.isPrivate ? 'offline' : presence.status,
                lastSeenAt: presence.lastSeenAt.toISOString(),
                lastActivityAt: presence.lastActivityAt.toISOString(),
                isPrivate: presence.isPrivate,
              }
            } else {
              // No presence record - user is offline
              result[partnerId] = {
                status: 'offline',
                lastSeenAt: new Date(0).toISOString(),
                lastActivityAt: new Date(0).toISOString(),
                isPrivate: false,
              }
            }
          }
        }

        return result
      },
      CacheTTL.ONLINE_PARTNERS
    )

    return NextResponse.json({
      success: true,
      presences: presenceMap,
      total: Object.keys(presenceMap).length,
    })
  } catch (error) {
    console.error('[GET ONLINE PARTNERS ERROR]', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
