import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// SCALABILITY: Limit groups to check to prevent unbounded queries
const MAX_GROUPS_TO_CHECK = 100

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SCALABILITY: Run both queries in parallel for faster response
    const [unreadPartnerConversations, userGroups] = await Promise.all([
      // Get unread partner (DM) conversations count
      prisma.message.groupBy({
        by: ['senderId'],
        where: {
          recipientId: user.id,
          groupId: null, // DMs only
          isRead: false,
          isDeleted: false,
        },
        _count: {
          senderId: true,
        },
      }),
      // Get all groups the user is a member of (bounded)
      prisma.groupMember.findMany({
        where: {
          userId: user.id,
        },
        select: {
          groupId: true,
        },
        take: MAX_GROUPS_TO_CHECK,
        orderBy: {
          joinedAt: 'desc',
        },
      }),
    ])

    const partnerCount = unreadPartnerConversations.length
    const groupIds = userGroups.map((gm) => gm.groupId)

    // Early return if user has no groups
    if (groupIds.length === 0) {
      return NextResponse.json({
        total: partnerCount,
        partner: partnerCount,
        group: 0,
      })
    }

    // SCALABILITY: Optimized query using LEFT JOIN instead of NOT EXISTS
    // This performs better with proper indexes and avoids correlated subquery
    const unreadGroupConversations = await prisma.$queryRaw<
      Array<{ groupId: string }>
    >`
      SELECT DISTINCT m."groupId"
      FROM "Message" m
      LEFT JOIN "message_read_status" mrs
        ON mrs."messageId" = m.id AND mrs."userId" = ${user.id}
      WHERE m."groupId" = ANY(${groupIds}::text[])
        AND m."senderId" != ${user.id}
        AND m."isDeleted" = false
        AND mrs."messageId" IS NULL
      LIMIT 100
    `

    const groupCount = unreadGroupConversations.length
    const totalCount = partnerCount + groupCount

    return NextResponse.json({
      total: totalCount,
      partner: partnerCount,
      group: groupCount,
    })
  } catch (error) {
    console.error('Error fetching unread counts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unread counts' },
      { status: 500 }
    )
  }
}
