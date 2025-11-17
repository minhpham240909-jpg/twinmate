import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get unread partner (DM) conversations count
    const unreadPartnerConversations = await prisma.message.groupBy({
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
    })

    const partnerCount = unreadPartnerConversations.length

    // Get unread group conversations count
    // First, get all groups the user is a member of
    const userGroups = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
      },
      select: {
        groupId: true,
      },
    })

    const groupIds = userGroups.map((gm) => gm.groupId)

    // Get unread group messages (messages not in MessageReadStatus for this user)
    const unreadGroupConversations = await prisma.$queryRaw<
      Array<{ groupId: string }>
    >`
      SELECT DISTINCT m."groupId"
      FROM "Message" m
      WHERE m."groupId" = ANY(${groupIds}::text[])
        AND m."senderId" != ${user.id}
        AND m."isDeleted" = false
        AND NOT EXISTS (
          SELECT 1
          FROM "message_read_status" mrs
          WHERE mrs."messageId" = m.id
            AND mrs."userId" = ${user.id}
        )
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
