import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationType, conversationId } = body

    if (!conversationType || !conversationId) {
      return NextResponse.json(
        { error: 'conversationType and conversationId are required' },
        { status: 400 }
      )
    }

    if (conversationType === 'partner') {
      // Mark all DM messages from this partner as read
      await prisma.message.updateMany({
        where: {
          senderId: conversationId, // partnerId
          recipientId: user.id,
          groupId: null,
          isRead: false,
          isDeleted: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })
    } else if (conversationType === 'group') {
      // Get all unread messages in this group that the user hasn't read
      const unreadMessages = await prisma.message.findMany({
        where: {
          groupId: conversationId,
          senderId: { not: user.id }, // Don't mark own messages
          isDeleted: false,
          // Check if user hasn't read this message yet
          NOT: {
            readBy: {
              some: {
                userId: user.id,
              },
            },
          },
        },
        select: {
          id: true,
        },
      })

      // Create MessageReadStatus entries for all unread messages
      if (unreadMessages.length > 0) {
        await prisma.messageReadStatus.createMany({
          data: unreadMessages.map((msg) => ({
            messageId: msg.id,
            userId: user.id,
            readAt: new Date(),
          })),
          skipDuplicates: true,
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid conversationType. Must be "partner" or "group"' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking messages as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    )
  }
}
