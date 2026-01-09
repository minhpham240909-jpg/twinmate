import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Pagination defaults
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

export async function GET(request: Request) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query params for filtering and pagination
    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get('type') // 'partner' or 'group'
    
    // Cursor-based pagination
    // cursor: ISO timestamp of the last conversation's lastMessageTime
    const cursor = searchParams.get('cursor') // ISO date string
    const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10)
    const limit = Math.min(Math.max(1, limitParam), MAX_PAGE_SIZE) // Clamp between 1 and MAX

    const userId = user.id

    // Execute all queries in parallel for maximum performance
    // Note: We fetch matches once and extract partner IDs from it (avoiding duplicate query)
    const [matches, groupMemberships] = await Promise.all([
      // Get all accepted partners with their profiles in one query
      prisma.match.findMany({
        where: {
          OR: [
            { senderId: userId, status: 'ACCEPTED' },
            { receiverId: userId, status: 'ACCEPTED' }
          ]
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      }),
      // Get all groups with member count in one query
      // FIX: Filter out deleted groups so they don't appear in chat
      prisma.groupMember.findMany({
        where: {
          userId: userId,
          group: {
            isDeleted: false, // Only show non-deleted groups
          },
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isDeleted: true, // Include for safety check
              _count: {
                select: { members: true }
              }
            }
          }
        },
        orderBy: {
          joinedAt: 'desc'
        }
      })
    ])

    // Extract partner IDs from matches (no duplicate query needed)
    const partnerIdsFromMatches = matches.map(match =>
      match.senderId === userId ? match.receiverId : match.senderId
    )

    // Fetch presence for all partners (only if there are partners)
    const userPresences = partnerIdsFromMatches.length > 0
      ? await prisma.userPresence.findMany({
          where: {
            userId: { in: partnerIdsFromMatches }
          },
          select: {
            userId: true,
            status: true,
            lastSeenAt: true,
            isPrivate: true
          }
        })
      : []

    // Create presence lookup map
    const presenceMap = new Map(
      userPresences.map(p => [p.userId, p])
    )

    // Process partners
    const partners = matches.map(match => {
      const partner = match.senderId === userId ? match.receiver : match.sender
      const presence = presenceMap.get(partner.id)

      // Determine online status from presence data
      let onlineStatus = 'OFFLINE'
      if (presence && !presence.isPrivate) {
        // Map presence status to old onlineStatus format
        onlineStatus = presence.status === 'online' ? 'ONLINE' : 'OFFLINE'
      }

      return {
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl,
        type: 'partner' as const,
        onlineStatus,
        lastMessage: null as string | null,
        lastMessageTime: null as Date | null,
        unreadCount: 0
      }
    })

    // Process groups
    const groups = groupMemberships.map(membership => ({
      id: membership.group.id,
      name: membership.group.name,
      avatarUrl: membership.group.avatarUrl,
      type: 'group' as const,
      memberCount: membership.group._count.members,
      lastMessage: null as string | null,
      lastMessageTime: null as Date | null,
      unreadCount: 0
    }))

    const partnerIds = partners.map(p => p.id)
    const groupIds = groups.map(g => g.id)

    // Skip message queries if no conversations
    if (partnerIds.length === 0 && groupIds.length === 0) {
      return NextResponse.json({
        conversations: [],
        success: true
      }, {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        }
      })
    }

    // Fetch all message data in parallel using standard Prisma queries
    const messageQueries = []

    if (partnerIds.length > 0) {
      messageQueries.push(
        // Last messages for partners - fetch all and filter in JS
        prisma.message.findMany({
          where: {
            OR: [
              { senderId: userId, recipientId: { in: partnerIds } },
              { senderId: { in: partnerIds }, recipientId: userId }
            ],
            groupId: null
          },
          select: {
            id: true,
            content: true,
            type: true,
            callType: true,
            callDuration: true,
            callStatus: true,
            createdAt: true,
            senderId: true,
            recipientId: true,
            deletedAt: true, // Include deletedAt to check for deleted messages
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 100 // Limit to prevent too many messages
        }).then(results => ({ type: 'partner', results })),
        // Unread counts for partners
        prisma.message.groupBy({
          by: ['senderId'],
          where: {
            senderId: { in: partnerIds },
            recipientId: userId,
            isRead: false,
            groupId: null
          },
          _count: { _all: true }
        }).then(results => ({ type: 'partner-unread', results }))
      )
    }

    if (groupIds.length > 0) {
      messageQueries.push(
        // Last messages for groups - PERF: Use distinct to get only one per group
        // This limits the scan to at most one message per group instead of all messages
        prisma.message.findMany({
          where: { groupId: { in: groupIds } },
          select: {
            id: true,
            content: true,
            type: true,
            callType: true,
            callDuration: true,
            callStatus: true,
            createdAt: true,
            groupId: true,
            deletedAt: true, // Include deletedAt to check for deleted messages
          },
          orderBy: { createdAt: 'desc' },
          distinct: ['groupId'],
          take: groupIds.length // PERF: Limit to number of groups (one per group max)
        }).then(results => ({ type: 'group', results })),
        // Unread counts for groups
        prisma.message.groupBy({
          by: ['groupId'],
          where: {
            groupId: { in: groupIds },
            senderId: { not: userId },
            isRead: false
          },
          _count: { _all: true }
        }).then(results => ({ type: 'group-unread', results }))
      )
    }

    const messageData = await Promise.all(messageQueries)

    // Create lookup Maps for O(1) access (avoid .find() in loops)
    const partnerMap = new Map(partners.map(p => [p.id, p]))
    const groupMap = new Map(groups.map(g => [g.id, g]))

    // Process message data
    messageData.forEach(data => {
      if (data.type === 'partner') {
        // Group messages by partner and get the most recent for each
        const lastMessageMap = new Map<string, { content: string; createdAt: Date; senderId: string | null; recipientId: string | null; deletedAt: Date | null }>()

        data.results.forEach((msg: unknown) => {
          const message = msg as { senderId: string | null; recipientId: string | null; content: string; createdAt: Date; deletedAt: Date | null }
          const partnerId = message.senderId === userId ? message.recipientId : message.senderId

          if (partnerId && !lastMessageMap.has(partnerId)) {
            lastMessageMap.set(partnerId, message)
          }
        })

        // Map to partners using partnerMap for O(1) lookup
        partners.forEach(partner => {
          const lastMsg = lastMessageMap.get(partner.id)
          if (lastMsg) {
            // Check if message is deleted - show "Message deleted" instead of actual content
            partner.lastMessage = lastMsg.deletedAt ? 'Message deleted' : lastMsg.content
            partner.lastMessageTime = lastMsg.createdAt
          }
        })
      } else if (data.type === 'partner-unread') {
        // Use partnerMap for O(1) lookup instead of .find()
        data.results.forEach((item: unknown) => {
          const unread = item as { senderId: string | null; _count: { _all: number } }
          if (unread.senderId) {
            const partner = partnerMap.get(unread.senderId)
            if (partner) partner.unreadCount = unread._count._all
          }
        })
      } else if (data.type === 'group') {
        // Use groupMap for O(1) lookup instead of .find()
        data.results.forEach((msg: unknown) => {
          const message = msg as { groupId: string | null; content: string; createdAt: Date; deletedAt: Date | null }
          if (message.groupId) {
            const group = groupMap.get(message.groupId)
            if (group) {
              // Check if message is deleted - show "Message deleted" instead of actual content
              group.lastMessage = message.deletedAt ? 'Message deleted' : message.content
              group.lastMessageTime = message.createdAt
            }
          }
        })
      } else if (data.type === 'group-unread') {
        // Use groupMap for O(1) lookup instead of .find()
        data.results.forEach((item: unknown) => {
          const unread = item as { groupId: string | null; _count: { _all: number } }
          if (unread.groupId) {
            const group = groupMap.get(unread.groupId)
            if (group) group.unreadCount = unread._count._all
          }
        })
      }
    })

    // Combine and filter by type if specified
    let allConversations = [...partners, ...groups]
    
    if (typeFilter === 'partner') {
      allConversations = partners
    } else if (typeFilter === 'group') {
      allConversations = groups
    }

    // Sort by last message time (descending - newest first)
    allConversations.sort((a, b) => {
      const timeA = a.lastMessageTime?.getTime() || 0
      const timeB = b.lastMessageTime?.getTime() || 0
      return timeB - timeA
    })

    // Apply cursor-based pagination
    let paginatedConversations = allConversations
    if (cursor) {
      const cursorTime = new Date(cursor).getTime()
      // Find conversations with lastMessageTime before the cursor
      paginatedConversations = allConversations.filter(conv => {
        const convTime = conv.lastMessageTime?.getTime() || 0
        return convTime < cursorTime
      })
    }

    // Apply limit (fetch one extra to determine if there are more)
    const hasMore = paginatedConversations.length > limit
    const resultConversations = paginatedConversations.slice(0, limit)

    // Calculate next cursor (timestamp of last item)
    const nextCursor = hasMore && resultConversations.length > 0
      ? resultConversations[resultConversations.length - 1].lastMessageTime?.toISOString() || null
      : null

    return NextResponse.json({
      conversations: resultConversations,
      success: true,
      pagination: {
        limit,
        hasMore,
        nextCursor,
        total: allConversations.length,
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
      }
    })

  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
