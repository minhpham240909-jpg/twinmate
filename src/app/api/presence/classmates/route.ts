/**
 * Partners Studying Now API
 *
 * Returns:
 * 1. Study partners who are online
 * 2. Total studying count
 *
 * This powers the "social gravity" on the dashboard
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Parallel queries for partnerships
 * - Cached total studying count
 * - Limited result sets (top 5 partners)
 * - Uses database indexes on userId, status, presence
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheTTL, CacheKeys } from '@/lib/redis'

export async function GET() {
  try {
    // Verify auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SCALE: Cache partnerships to handle 2000-3000 concurrent users
    // At 3000 users polling every 15s = 200 requests/second
    // Caching reduces DB queries from 200/s to ~3-4/s per unique user
    const partnerships = await cacheGet<Array<{ senderId: string; receiverId: string }>>(
      CacheKeys.USER_PARTNERSHIPS(user.id),
      async () => {
        return prisma.match.findMany({
          where: {
            OR: [
              { senderId: user.id, status: 'ACCEPTED' },
              { receiverId: user.id, status: 'ACCEPTED' },
            ],
          },
          select: {
            senderId: true,
            receiverId: true,
          },
        })
      },
      CacheTTL.USER_PARTNERSHIPS
    )

    const partnerIds = partnerships.map((p: { senderId: string; receiverId: string }) =>
      p.senderId === user.id ? p.receiverId : p.senderId
    )

    // Get online partners who are studying
    const onlinePartners = partnerIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: partnerIds },
            presence: {
              status: 'online',
              activityType: { in: ['studying', 'focus', 'solo_study', 'quick_focus', 'in_call'] },
            },
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            presence: {
              select: {
                activityType: true,
                activityDetails: true,
              },
            },
          },
          take: 5,
        })
      : []

    // Format partner data
    const studyingPartners = onlinePartners.map((p) => {
      // Parse activityDetails if it's a JSON string
      let details: Record<string, unknown> = {}
      if (p.presence?.activityDetails) {
        try {
          const activityStr = p.presence.activityDetails
          if (typeof activityStr === 'string') {
            details = JSON.parse(activityStr) as Record<string, unknown>
          }
        } catch {
          details = {}
        }
      }

      return {
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        activityType: p.presence?.activityType,
        subject: typeof details.subject === 'string' ? details.subject : undefined,
      }
    })

    // Get total studying count (cached)
    const totalStudying = await cacheGet<number>(
      'presence:studying_count',
      async () => {
        return prisma.userPresence.count({
          where: {
            status: 'online',
            activityType: { in: ['studying', 'focus', 'solo_study', 'quick_focus', 'in_call'] },
          },
        })
      },
      CacheTTL.STUDYING_COUNT
    )

    return NextResponse.json({
      success: true,
      studyingPartners,
      totalStudying: totalStudying || 0,
    })
  } catch (error) {
    console.error('[Partners Studying API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch presence data' },
      { status: 500 }
    )
  }
}
