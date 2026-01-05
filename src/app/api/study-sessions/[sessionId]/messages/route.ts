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

    // SECURITY: Verify user is a JOINED participant (not just INVITED)
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED', // Only JOINED participants can view messages
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Build where clause
    const whereClause: { sessionId: string; createdAt?: { gt: Date } } = { sessionId }

    // If 'after' timestamp is provided, only fetch messages after that time
    if (afterTimestamp) {
      whereClause.createdAt = {
        gt: new Date(afterTimestamp),
      }
    }

    // Fetch messages with sender info
    const messages = await prisma.sessionMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // Last 100 messages
    })

    return NextResponse.json({
      success: true,
      messages,
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

    // Create message with sender info included
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
            email: true,
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
      message.sender.email || undefined,
      message.sender.name || undefined,
      sessionId
    )

    // Create notifications for other participants (async, don't wait)
    const otherParticipants = await prisma.sessionParticipant.findMany({
      where: {
        sessionId,
        userId: { not: user.id },
        status: 'JOINED',
      },
      select: {
        userId: true,
      },
    })

    // Create notifications in parallel (fire-and-forget with proper void operator)
    if (otherParticipants.length > 0) {
      const senderName = message.sender.name || message.sender.email || 'Someone'
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
