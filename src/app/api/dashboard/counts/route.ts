import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-auth'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheTTL, CacheKeys } from '@/lib/redis'

const MAX_GROUPS_TO_CHECK = 100

// Type for cached dashboard counts
interface DashboardCounts {
  pendingInvites: number
  connectionRequests: number
  groupInvites: number
  newCommunityPosts: number
  unreadMessages: {
    total: number
    partner: number
    group: number
  }
}

/**
 * GET /api/dashboard/counts
 *
 * Aggregated endpoint that returns all notification counts in a single request.
 * This replaces 5 separate API calls with 1, reducing round-trips and latency.
 *
 * Returns:
 * - pendingInvites: Session invites pending
 * - connectionRequests: Pending connection requests received
 * - groupInvites: Pending group invites
 * - newCommunityPosts: New posts from partners/groups in last 24h
 * - unreadMessages: Unread DM and group message counts
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for dashboard counts (results are cached)
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth check - uses cached auth context
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // SCALE: Cache dashboard counts for 30 seconds
    // At 3000 users polling every 30s = 100 requests/second
    // Caching reduces DB load from 100/s to ~3-4/s per unique user
    const counts = await cacheGet<DashboardCounts>(
      CacheKeys.DASHBOARD_COUNTS(user.id),
      async () => {
        return fetchDashboardCounts(user.id)
      },
      CacheTTL.DASHBOARD_COUNTS
    )

    return NextResponse.json({
      success: true,
      counts,
    })
  } catch (error) {
    console.error('Error fetching dashboard counts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch counts' },
      { status: 500 }
    )
  }
}

/**
 * Fetch all dashboard counts from database
 * This is called on cache miss
 */
async function fetchDashboardCounts(userId: string): Promise<DashboardCounts> {
  // Run all count queries in parallel for maximum performance
  const [
    pendingSessionInvites,
    pendingConnectionRequests,
    pendingGroupInvites,
    partnerMatches,
    userGroups,
    unreadPartnerConversations,
  ] = await Promise.all([
    // 1. Pending session invites count
    prisma.sessionParticipant.count({
      where: {
        userId: userId,
        status: 'INVITED',
      },
    }),

    // 2. Pending connection requests received count
    prisma.match.count({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
    }),

    // 3. Pending group invites count
    prisma.groupInvite.count({
      where: {
        inviteeId: userId,
        status: 'PENDING',
      },
    }),

    // 4a. Get partner IDs for community posts (accepted matches)
    prisma.match.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    }),

    // 4b. Get user's groups for community posts and unread messages
    prisma.groupMember.findMany({
      where: {
        userId: userId,
      },
      select: {
        groupId: true,
      },
      take: MAX_GROUPS_TO_CHECK,
      orderBy: {
        joinedAt: 'desc',
      },
    }),

    // 5a. Get unread partner (DM) conversations count
    prisma.message.groupBy({
      by: ['senderId'],
      where: {
        recipientId: userId,
        groupId: null,
        isRead: false,
        isDeleted: false,
      },
      _count: {
        senderId: true,
      },
    }),
  ])

  // Process partner IDs for community posts
  const partnerIds = partnerMatches.map(match =>
    match.senderId === userId ? match.receiverId : match.senderId
  )

  const groupIds = userGroups.map(g => g.groupId)

  // Run second batch of queries that depend on first batch
  const [groupMemberIds, unreadGroupConversations] = await Promise.all([
    // Get group member IDs for community posts
    groupIds.length > 0
      ? prisma.groupMember.findMany({
          where: {
            groupId: { in: groupIds },
            userId: { not: userId },
          },
          select: {
            userId: true,
          },
        })
      : Promise.resolve([]),

    // Get unread group conversations
    groupIds.length > 0
      ? prisma.$queryRaw<Array<{ groupId: string }>>`
          SELECT DISTINCT m."groupId"
          FROM "Message" m
          LEFT JOIN "message_read_status" mrs
            ON mrs."messageId" = m.id AND mrs."userId" = ${userId}
          WHERE m."groupId" = ANY(${groupIds}::text[])
            AND m."senderId" != ${userId}
            AND m."isDeleted" = false
            AND mrs."messageId" IS NULL
          LIMIT 100
        `
      : Promise.resolve([]),
  ])

  // Calculate community posts count
  const groupMemberUserIds = [...new Set(groupMemberIds.map(m => m.userId))]
  const relevantUserIds = [...new Set([...partnerIds, ...groupMemberUserIds])]

  let communityPostsCount = 0
  if (relevantUserIds.length > 0) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    communityPostsCount = await prisma.post.count({
      where: {
        userId: { in: relevantUserIds },
        createdAt: { gte: oneDayAgo },
        isDeleted: false,
      },
    })
  }

  // Calculate unread message totals
  const partnerUnreadCount = unreadPartnerConversations.length
  const groupUnreadCount = unreadGroupConversations.length
  const totalUnreadMessages = partnerUnreadCount + groupUnreadCount

  return {
    pendingInvites: pendingSessionInvites,
    connectionRequests: pendingConnectionRequests,
    groupInvites: pendingGroupInvites,
    newCommunityPosts: communityPostsCount,
    unreadMessages: {
      total: totalUnreadMessages,
      partner: partnerUnreadCount,
      group: groupUnreadCount,
    },
  }
}
