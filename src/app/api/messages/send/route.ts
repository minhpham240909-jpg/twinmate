import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { MessageType } from '@prisma/client'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { CONTENT_LIMITS } from '@/lib/constants'
import { sendMessageSchema, validateRequest, validateContent } from '@/lib/validation'

export async function POST(req: NextRequest) {
  // Rate limiting: 20 messages per minute
  const rateLimitResult = await rateLimit(req, RateLimitPresets.moderate)
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

    const body = await req.json()

    // Validate request body
    const validation = validateRequest(sendMessageSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const { content, type, conversationId, conversationType, fileUrl, fileName, fileSize } = validation.data

    let message: {
      id: string
      content: string
      type: MessageType
      senderId: string
      createdAt: Date
      updatedAt?: Date
      fileUrl?: string | null
      fileName?: string | null
      fileSize?: number | null
      isRead?: boolean
      isEdited?: boolean
      sender: {
        id: string
        name: string
        avatarUrl: string | null
      }
    }

    if (conversationType === 'group') {
      // Verify user is a member of this group
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: conversationId,
          userId: userId
        }
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this group' },
          { status: 403 }
        )
      }

      // Create group message
      message = await prisma.message.create({
        data: {
          content,
          type: type || 'TEXT',
          senderId: userId,
          groupId: conversationId,
          fileUrl,
          fileName,
          fileSize
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      })

      // PERFORMANCE: Batch fetch group members and group data in parallel
      const [groupMembers, group] = await Promise.all([
        prisma.groupMember.findMany({
          where: {
            groupId: conversationId,
            userId: { not: userId }
          },
          select: { userId: true }
        }),
        prisma.group.findUnique({
          where: { id: conversationId },
          select: { name: true }
        })
      ])

      // Use sender name from already-fetched message.sender (no additional query needed)
      if (groupMembers.length > 0) {
        const contentPreview = content.length > 50
          ? content.substring(0, 50) + '...'
          : content

        await prisma.notification.createMany({
          data: groupMembers.map(member => ({
            userId: member.userId,
            type: 'NEW_MESSAGE',
            title: `New message in ${group?.name || 'group'}`,
            message: `${message.sender.name || 'Someone'}: ${contentPreview}`,
            actionUrl: `/chat?conversation=${conversationId}&type=group`,
            relatedUserId: userId
          }))
        }).catch(err => {
          // Log error in development only
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to create group notifications:', err)
          }
        })
      }

    } else if (conversationType === 'partner') {
      // Verify there's an accepted match
      const match = await prisma.match.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: conversationId, status: 'ACCEPTED' },
            { senderId: conversationId, receiverId: userId, status: 'ACCEPTED' }
          ]
        }
      })

      if (!match) {
        return NextResponse.json(
          { error: 'No active partnership found' },
          { status: 403 }
        )
      }

      // Create DM message
      message = await prisma.message.create({
        data: {
          content,
          type: type || 'TEXT',
          senderId: userId,
          recipientId: conversationId,
          fileUrl,
          fileName,
          fileSize
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      })

      // PERFORMANCE: Use sender name from already-fetched message.sender (no additional query needed)
      await prisma.notification.create({
        data: {
          userId: conversationId,
          type: 'NEW_MESSAGE',
          title: 'New message',
          message: `${message.sender.name || 'Someone'} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          actionUrl: `/chat?conversation=${userId}&type=partner`
        }
      }).catch(err => {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to create notification:', err)
        }
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid conversation type' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        type: message.type,
        senderId: message.senderId,
        sender: message.sender,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        isRead: message.isRead,
        isEdited: message.isEdited,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      },
      success: true
    })

  } catch (error) {
    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('Error sending message:', error)
    }
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
