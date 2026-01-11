/**
 * Chat Partner Search API
 *
 * Searches ONLY within the user's existing partners and their message conversations.
 * This is different from /api/partners/search which finds NEW partners.
 *
 * Used by: Partner Chat search bar
 * Scope: Only user's accepted partners and their DM conversations
 *
 * PERFORMANCE: Optimized queries, no N+1 issues
 * SECURITY: Only returns partners the user is connected with
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchQuery } = await request.json()

    if (!searchQuery || searchQuery.trim().length < 2) {
      return NextResponse.json({ partners: [] })
    }

    const query = searchQuery.trim().toLowerCase()

    // Get user's accepted partner IDs
    const acceptedMatches = await prisma.match.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: user.id },
          { receiverId: user.id }
        ]
      },
      select: {
        senderId: true,
        receiverId: true,
      }
    })

    // Extract partner IDs
    const partnerIds = acceptedMatches.map(m =>
      m.senderId === user.id ? m.receiverId : m.senderId
    )

    if (partnerIds.length === 0) {
      return NextResponse.json({ partners: [] })
    }

    // Get partners that match the search query by name
    const matchingPartners = await prisma.user.findMany({
      where: {
        id: { in: partnerIds },
        name: { contains: query, mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
      take: 10
    })

    // Also search messages within these conversations to find more partners
    const messagesMatching = await prisma.message.findMany({
      where: {
        content: { contains: query, mode: 'insensitive' },
        groupId: null, // DMs only
        OR: [
          { senderId: user.id, recipientId: { in: partnerIds } },
          { recipientId: user.id, senderId: { in: partnerIds } }
        ]
      },
      select: {
        senderId: true,
        recipientId: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' }
    })

    // Get unique partner IDs from messages
    const messagePartnerIds = new Set<string>()
    const existingPartnerIds = new Set(matchingPartners.map(p => p.id))

    messagesMatching.forEach(msg => {
      const partnerId = msg.senderId === user.id ? msg.recipientId : msg.senderId
      if (partnerId && !existingPartnerIds.has(partnerId)) {
        messagePartnerIds.add(partnerId)
      }
    })

    // Fetch additional partners found via message search
    let additionalPartners: typeof matchingPartners = []
    if (messagePartnerIds.size > 0) {
      additionalPartners = await prisma.user.findMany({
        where: {
          id: { in: Array.from(messagePartnerIds) }
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
        take: 10
      })
    }

    // Combine and deduplicate
    const allPartners = [...matchingPartners, ...additionalPartners]
    const uniquePartners = Array.from(
      new Map(allPartners.map(p => [p.id, p])).values()
    ).slice(0, 10)

    return NextResponse.json({
      partners: uniquePartners.map(p => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        onlineStatus: null // Online status would need presence system
      }))
    })
  } catch (error) {
    console.error('Chat partner search error:', error)
    return NextResponse.json(
      { error: 'Failed to search partners' },
      { status: 500 }
    )
  }
}
