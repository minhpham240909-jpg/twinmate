import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/history/deleted-messages - Get user's deleted messages/chats
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // First, cleanup messages older than 30 days (automatic cleanup)
    const expiredMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        fileUrl: true,
      },
    })

    // Delete files from storage for expired messages
    for (const message of expiredMessages) {
      if (message.fileUrl) {
        try {
          const urlParts = message.fileUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName) {
            await supabase.storage.from('messages').remove([fileName])
          }
        } catch (error) {
          console.error('Error deleting message file:', error)
        }
      }
    }

    // Permanently delete expired messages
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
    })

    // Get remaining deleted messages (within 30 days)
    const deletedMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
        isDeleted: true,
        deletedAt: {
          gt: thirtyDaysAgo,
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    })

    // Fetch recipient users separately for DMs
    const recipientIds = deletedMessages
      .filter(msg => msg.recipientId)
      .map(msg => msg.recipientId!)
      .filter((id, index, self) => self.indexOf(id) === index) // Unique IDs

    const recipients = recipientIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: recipientIds } },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        })
      : []

    const recipientMap = new Map(recipients.map(r => [r.id, r]))

    // Group messages by conversation (DM or Group)
    const conversations = new Map<string, any>()

    deletedMessages.forEach(message => {
      let conversationKey: string
      let conversationName: string
      let conversationAvatar: string | null = null
      let otherUser: any = null

      if (message.groupId) {
        // Group message
        conversationKey = `group-${message.groupId}`
        conversationName = message.group?.name || 'Unknown Group'
        conversationAvatar = message.group?.avatarUrl || null
      } else {
        // DM
        const otherUserId = message.senderId === user.id ? message.recipientId : message.senderId
        conversationKey = `dm-${otherUserId}`
        if (message.senderId === user.id && message.recipientId) {
          otherUser = recipientMap.get(message.recipientId) || null
        } else {
          otherUser = message.sender
        }
        conversationName = otherUser?.name || 'Unknown User'
        conversationAvatar = otherUser?.avatarUrl || null
      }

      if (!conversations.has(conversationKey)) {
        conversations.set(conversationKey, {
          id: conversationKey,
          type: message.groupId ? 'group' : 'dm',
          name: conversationName,
          avatar: conversationAvatar,
          otherUser: otherUser,
          messages: [],
          deletedAt: message.deletedAt,
          daysRemaining: 0,
        })
      }

      const conversation = conversations.get(conversationKey)!
      conversation.messages.push({
        id: message.id,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        createdAt: message.createdAt,
        deletedAt: message.deletedAt,
      })

      // Update deletedAt to most recent
      if (message.deletedAt && (!conversation.deletedAt || message.deletedAt > conversation.deletedAt)) {
        conversation.deletedAt = message.deletedAt
      }
    })

    // Calculate days remaining for each conversation
    const conversationsArray = Array.from(conversations.values()).map(conv => {
      const daysRemaining = conv.deletedAt
        ? 30 - Math.floor((Date.now() - new Date(conv.deletedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 30

      return {
        ...conv,
        daysRemaining: Math.max(0, daysRemaining),
        messageCount: conv.messages.length,
      }
    })

    return NextResponse.json({
      conversations: conversationsArray,
      count: conversationsArray.length,
    })
  } catch (error) {
    console.error('Error fetching deleted messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deleted messages' },
      { status: 500 }
    )
  }
}

