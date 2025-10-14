import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    // Verify user is a participant
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
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
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const { content, type = 'TEXT' } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }

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

    // Get sender user for name
    const senderUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true }
    })

    // Create message
    const message = await prisma.sessionMessage.create({
      data: {
        sessionId,
        senderId: user.id,
        content: content.trim(),
        type,
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

    // Create notifications in parallel (don't block response)
    if (otherParticipants.length > 0) {
      const senderName = senderUser?.name || user.email || 'Someone'
      const contentPreview = content.trim().length > 50
        ? content.trim().substring(0, 50) + '...'
        : content.trim()

      prisma.notification.createMany({
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
