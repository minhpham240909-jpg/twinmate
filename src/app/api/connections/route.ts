import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

type MatchWithRelations = {
  id: string
  status: string
  message: string | null
  createdAt: Date
  senderId: string
  receiverId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  receiver: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit connections list fetches (prevents scraping)
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.lenient, // 100 requests per minute
    keyPrefix: 'connections-list',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

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

    // Get type from query params (received, sent, or all)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    // SCALABILITY: Pagination for large result sets
    const DEFAULT_LIMIT = 50
    const MAX_LIMIT = 100
    const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
    const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT)
    const cursor = searchParams.get('cursor') // ID of last item for cursor-based pagination

    let receivedMatches: MatchWithRelations[] = []
    let sentMatches: MatchWithRelations[] = []

    // Build cursor condition if provided
    const cursorCondition = cursor ? { id: { lt: cursor } } : {}

    // Fetch received connection requests (where user is the receiver)
    if (type === 'received' || type === 'all') {
      receivedMatches = await prisma.match.findMany({
        where: {
          receiverId: user.id,
          status: 'PENDING',
          ...cursorCondition,
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
          createdAt: 'desc'
        },
        take: limit + 1, // Fetch one extra to check if there are more
      })
    }

    // Fetch sent connection requests (where user is the sender)
    if (type === 'sent' || type === 'all') {
      sentMatches = await prisma.match.findMany({
        where: {
          senderId: user.id,
          status: 'PENDING',
          ...cursorCondition,
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
          createdAt: 'desc'
        },
        take: limit + 1, // Fetch one extra to check if there are more
      })
    }

    // Check if there are more results
    const hasMoreReceived = receivedMatches.length > limit
    const hasMoreSent = sentMatches.length > limit

    // Trim to actual limit
    if (hasMoreReceived) receivedMatches = receivedMatches.slice(0, limit)
    if (hasMoreSent) sentMatches = sentMatches.slice(0, limit)

    // Calculate next cursors for pagination
    const nextReceivedCursor = hasMoreReceived && receivedMatches.length > 0
      ? receivedMatches[receivedMatches.length - 1].id
      : null
    const nextSentCursor = hasMoreSent && sentMatches.length > 0
      ? sentMatches[sentMatches.length - 1].id
      : null

    return NextResponse.json({
      success: true,
      received: receivedMatches,
      sent: sentMatches,
      receivedCount: receivedMatches.length,
      sentCount: sentMatches.length,
      pagination: {
        limit,
        hasMoreReceived,
        hasMoreSent,
        nextReceivedCursor,
        nextSentCursor,
      }
    })
  } catch (error) {
    console.error('Fetch connections error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
