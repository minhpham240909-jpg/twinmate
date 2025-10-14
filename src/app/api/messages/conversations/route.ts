import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

    const userId = user.id

    // Execute all queries in parallel for maximum performance
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
              email: true,
              avatarUrl: true,
              profile: {
                select: {
                  onlineStatus: true
                }
              }
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              profile: {
                select: {
                  onlineStatus: true
                }
              }
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      }),
      // Get all groups with member count in one query
      prisma.groupMember.findMany({
        where: {
          userId: userId
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
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

    // Process partners
    const partners = matches.map(match => {
      const partner = match.senderId === userId ? match.receiver : match.sender
      return {
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl,
        type: 'partner' as const,
        onlineStatus: partner.profile?.onlineStatus || 'OFFLINE',
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
            recipientId: true
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
        // Last messages for groups
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
            groupId: true
          },
          orderBy: { createdAt: 'desc' },
          distinct: ['groupId']
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

    // Process message data
    messageData.forEach(data => {
      if (data.type === 'partner') {
        // Group messages by partner and get the most recent for each
        const lastMessageMap = new Map<string, { content: string; createdAt: Date; senderId: string | null; recipientId: string | null }>()

        data.results.forEach((msg: unknown) => {
          const message = msg as { senderId: string | null; recipientId: string | null; content: string; createdAt: Date }
          const partnerId = message.senderId === userId ? message.recipientId : message.senderId

          if (partnerId && !lastMessageMap.has(partnerId)) {
            lastMessageMap.set(partnerId, message)
          }
        })

        // Map to partners
        partners.forEach(partner => {
          const lastMsg = lastMessageMap.get(partner.id)
          if (lastMsg) {
            partner.lastMessage = lastMsg.content
            partner.lastMessageTime = lastMsg.createdAt
          }
        })
      } else if (data.type === 'partner-unread') {
        data.results.forEach((item: unknown) => {
          const unread = item as { senderId: string | null; _count: { _all: number } }
          const partner = partners.find(p => p.id === unread.senderId)
          if (partner) partner.unreadCount = unread._count._all
        })
      } else if (data.type === 'group') {
        data.results.forEach((msg: unknown) => {
          const message = msg as { groupId: string | null; content: string; createdAt: Date }
          const group = groups.find(g => g.id === message.groupId)
          if (group) {
            group.lastMessage = message.content
            group.lastMessageTime = message.createdAt
          }
        })
      } else if (data.type === 'group-unread') {
        data.results.forEach((item: unknown) => {
          const unread = item as { groupId: string | null; _count: { _all: number } }
          const group = groups.find(g => g.id === unread.groupId)
          if (group) group.unreadCount = unread._count._all
        })
      }
    })

    // Combine and sort by last message time
    const allConversations = [...partners, ...groups].sort((a, b) => {
      const timeA = a.lastMessageTime?.getTime() || 0
      const timeB = b.lastMessageTime?.getTime() || 0
      return timeB - timeA
    })

    return NextResponse.json({
      conversations: allConversations,
      success: true
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
