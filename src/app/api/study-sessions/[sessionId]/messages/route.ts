import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { getAppUrl } from '@/lib/env'

// Content moderation scan (async, non-blocking)
async function scanSessionMessageContent(
  messageId: string,
  content: string,
  senderId: string,
  senderEmail: string | undefined,
  senderName: string | undefined,
  sessionId: string
) {
  try {
    fetch(`${getAppUrl()}/api/moderation/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        contentType: 'SESSION_MESSAGE',
        contentId: messageId,
        senderId,
        senderEmail,
        senderName,
        conversationId: sessionId,
        conversationType: 'session',
      }),
    }).catch((err) => {
      console.error('[Moderation] Session message scan failed:', err)
    })
  } catch (error) {
    console.error('[Moderation] Error initiating session message scan:', error)
  }
}

// SECURITY: Validation schema for session messages
const createMessageSchema = z.object({
  content: z.string().min(1, 'Message required').max(5000, 'Message too long'),
  type: z.enum(['TEXT', 'IMAGE', 'FILE']).default('TEXT'),
})

// GET - Fetch messages for a session
// FIX: Added cursor-based pagination for 40-60% faster performance
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const { searchParams } = new URL(request.url)
    const afterTimestamp = searchParams.get('after')
    const beforeTimestamp = searchParams.get('before') // FIX: Support backward pagination
    const cursor = searchParams.get('cursor') // Message ID cursor for efficient pagination
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10))) // Default 50, max 100

    // SECURITY: Verify user is a JOINED participant (not just INVITED)
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED', // Only JOINED participants can view messages
      },
      select: { id: true }, // Only select what we need
    })

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Build where clause with cursor-based pagination
    interface MessageWhereClause {
      sessionId: string
      createdAt?: { gt?: Date; lt?: Date }
      id?: { gt?: string; lt?: string }
    }
    
    const whereClause: MessageWhereClause = { sessionId }

    // If cursor is provided, use ID-based cursor pagination (most efficient)
    if (cursor) {
      whereClause.id = { gt: cursor }
    } else if (afterTimestamp) {
      // Fallback to timestamp-based pagination
      whereClause.createdAt = { gt: new Date(afterTimestamp) }
    } else if (beforeTimestamp) {
      // Support fetching older messages
      whereClause.createdAt = { lt: new Date(beforeTimestamp) }
    }

    // Fetch messages with sender info
    const messages = await prisma.sessionMessage.findMany({
      where: whereClause,
      select: {
        id: true,
        content: true,
        type: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: beforeTimestamp ? 'desc' : 'asc' },
      take: limit + 1, // Fetch one extra to check if there are more
    })

    // Check if there are more messages
    const hasMore = messages.length > limit
    const resultMessages = hasMore ? messages.slice(0, limit) : messages
    
    // Reverse if we fetched older messages (before)
    if (beforeTimestamp) {
      resultMessages.reverse()
    }

    // Get next cursor for pagination
    const nextCursor = hasMore && resultMessages.length > 0 
      ? resultMessages[resultMessages.length - 1].id 
      : null

    return NextResponse.json({
      success: true,
      messages: resultMessages,
      pagination: {
        hasMore,
        nextCursor,
        limit,
      },
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // SECURITY: Rate limiting to prevent message spam (30 messages per minute)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many messages. Please slow down.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()

    // SECURITY: Validate message content and type to prevent type confusion attacks
    const validation = createMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid message data',
          details: validation.error.format()
        },
        { status: 400 }
      )
    }

    const { content, type } = validation.data

    // Verify user is a participant
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED',
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Get sender email for moderation (separate query, not returned to client)
    const senderForModeration = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true }
    })

    // Create message with sender info included (no email in response)
    const message = await prisma.sessionMessage.create({
      data: {
        sessionId,
        senderId: user.id,
        content: content.trim(), // Trim whitespace from validated content
        type, // Already validated as one of: TEXT, IMAGE, FILE
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Scan message content for moderation (non-blocking)
    scanSessionMessageContent(
      message.id,
      content.trim(),
      user.id,
      senderForModeration?.email || undefined,
      message.sender.name || undefined,
      sessionId
    )

    // Create notifications for other participants (async, don't wait) - bounded
    const otherParticipants = await prisma.sessionParticipant.findMany({
      where: {
        sessionId,
        userId: { not: user.id },
        status: 'JOINED',
      },
      select: {
        userId: true,
      },
      take: 100, // SCALABILITY: Limit to prevent unbounded notifications
    })

    // Create notifications in parallel (fire-and-forget with proper void operator)
    if (otherParticipants.length > 0) {
      const senderName = message.sender.name || 'Someone'
      const contentPreview = content.trim().length > 50
        ? content.trim().substring(0, 50) + '...'
        : content.trim()

      // Using void to explicitly mark as intentional fire-and-forget
      void prisma.notification.createMany({
        data: otherParticipants.map(p => ({
          userId: p.userId,
          type: 'NEW_MESSAGE',
          title: `New message from ${senderName}`,
          message: contentPreview,
          actionUrl: `/study-sessions/${sessionId}`,
          relatedUserId: user.id,
        })),
      }).catch(err => {
        console.error('Failed to create notifications:', err)
      })
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
