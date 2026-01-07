import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { MessageType } from '@prisma/client'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { sendMessageSchema, validateRequest } from '@/lib/validation'
import { isBlocked } from '@/lib/blocked-users'
import { enforceUserAccess } from '@/lib/security/checkUserBan'
import { notifyNewMessage } from '@/lib/notifications/send'
import { getAppUrl } from '@/lib/env'
import logger from '@/lib/logger'

// FIX: Idempotency key cache to prevent duplicate message creation
// Maps idempotency key -> { messageId, timestamp }
const idempotencyCache = new Map<string, { messageId: string; timestamp: number }>()
const IDEMPOTENCY_TTL = 5 * 60 * 1000 // 5 minutes

// Cleanup old idempotency keys periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of idempotencyCache.entries()) {
      if (now - value.timestamp > IDEMPOTENCY_TTL) {
        idempotencyCache.delete(key)
      }
    }
  }, 60 * 1000) // Every minute
}

// Content moderation scan (async, non-blocking)
async function scanMessageContent(
  messageId: string,
  content: string,
  contentType: 'DIRECT_MESSAGE' | 'GROUP_MESSAGE',
  senderId: string,
  senderEmail: string | undefined,
  senderName: string | undefined,
  conversationId: string,
  conversationType: string
) {
  try {
    // Call moderation API in background (don't await to not block message sending)
    fetch(`${getAppUrl()}/api/moderation/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        contentType,
        contentId: messageId,
        senderId,
        senderEmail,
        senderName,
        conversationId,
        conversationType,
      }),
    }).catch((err) => {
      console.error('[Moderation] Scan failed:', err)
    })
  } catch (error) {
    console.error('[Moderation] Error initiating scan:', error)
  }
}

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

    // Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(userId)
    if (!accessCheck.allowed) {
      return NextResponse.json(
        accessCheck.errorResponse,
        { status: 403 }
      )
    }

    const body = await req.json()
    
    // FIX: Idempotency key handling - prevent duplicate messages from rapid clicks or retries
    const idempotencyKey = req.headers.get('x-idempotency-key') || body.idempotencyKey
    if (idempotencyKey) {
      const cached = idempotencyCache.get(`${userId}:${idempotencyKey}`)
      if (cached) {
        // Return the existing message instead of creating a duplicate
        const existingMessage = await prisma.message.findUnique({
          where: { id: cached.messageId },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        })
        
        if (existingMessage) {
          logger.debug('Returning cached message for idempotency key', { 
            idempotencyKey, 
            messageId: cached.messageId 
          })
          return NextResponse.json({
            message: {
              id: existingMessage.id,
              content: existingMessage.content,
              type: existingMessage.type,
              senderId: existingMessage.senderId,
              sender: existingMessage.sender,
              fileUrl: existingMessage.fileUrl,
              fileName: existingMessage.fileName,
              fileSize: existingMessage.fileSize,
              isRead: existingMessage.isRead,
              isEdited: existingMessage.isEdited,
              createdAt: existingMessage.createdAt,
              updatedAt: existingMessage.updatedAt
            },
            success: true,
            idempotent: true // Indicate this was a cached response
          })
        }
      }
    }

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
      senderId: string | null // Nullable in schema but always set for new messages
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
        email: string
        avatarUrl: string | null
      } | null // Nullable in schema but always set for new messages
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

      // Get sender info for caching
      const senderInfo = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, avatarUrl: true }
      })

      // CRITICAL: Use transaction to ensure message and notifications are created atomically
      // This prevents race conditions where message exists but notifications fail
      const createdMessage = await prisma.$transaction(async (tx) => {
        // Create group message with delivery timestamp
        const createdMessage = await tx.message.create({
          data: {
            content,
            type: type || 'TEXT',
            senderId: userId,
            senderName: senderInfo?.name || null,
            senderEmail: senderInfo?.email || null,
            senderAvatarUrl: senderInfo?.avatarUrl || null,
            groupId: conversationId,
            fileUrl,
            fileName,
            fileSize,
            deliveredAt: new Date(),
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        })

        // Fetch group data within transaction
        const group = await tx.group.findUnique({
          where: { id: conversationId },
          select: { name: true }
        })

        // SCALABILITY: Fetch group members in batches to prevent OOM for large groups
        // Limit notification recipients to prevent memory issues
        const MAX_NOTIFICATION_RECIPIENTS = 500 // Reasonable limit for notification creation
        const groupMembers = await tx.groupMember.findMany({
          where: {
            groupId: conversationId,
            userId: { not: userId }
          },
          select: { userId: true },
          take: MAX_NOTIFICATION_RECIPIENTS // Limit to prevent OOM
        })

        // Create notifications within transaction using batches
        if (groupMembers.length > 0) {
          const contentPreview = content.length > 50
            ? content.substring(0, 50) + '...'
            : content

          // SCALABILITY: Batch notification creation for large groups
          const NOTIFICATION_BATCH_SIZE = 100
          for (let i = 0; i < groupMembers.length; i += NOTIFICATION_BATCH_SIZE) {
            const batch = groupMembers.slice(i, i + NOTIFICATION_BATCH_SIZE)
            await tx.notification.createMany({
              data: batch.map(member => ({
                userId: member.userId,
                type: 'NEW_MESSAGE',
                title: `New message in ${group?.name || 'group'}`,
                message: `${senderInfo?.name || 'Someone'}: ${contentPreview}`,
                actionUrl: `/chat?conversation=${conversationId}&type=group`,
                relatedUserId: userId
              }))
            })
          }
        }

        return createdMessage
      })

      message = createdMessage
      
      // FIX: Cache the message ID for idempotency
      if (idempotencyKey) {
        idempotencyCache.set(`${userId}:${idempotencyKey}`, {
          messageId: message.id,
          timestamp: Date.now()
        })
      }

      // Scan message content for moderation (non-blocking, outside transaction)
      scanMessageContent(
        message.id,
        content,
        'GROUP_MESSAGE',
        userId,
        senderInfo?.email,
        senderInfo?.name || undefined,
        conversationId,
        'group'
      )

    } else if (conversationType === 'partner') {
      // SECURITY: Check if either user has blocked the other
      const blocked = await isBlocked(userId, conversationId)
      if (blocked) {
        return NextResponse.json(
          { error: 'Unable to send message' },
          { status: 403 }
        )
      }

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

      // Get sender and recipient info for caching
      const [dmSenderInfo, recipientInfo] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, avatarUrl: true }
        }),
        prisma.user.findUnique({
          where: { id: conversationId },
          select: { name: true, email: true }
        })
      ])

      // CRITICAL: Use transaction to ensure message and notification are created atomically
      const createdDMMessage = await prisma.$transaction(async (tx) => {
        // Create DM message with delivery timestamp
        const createdMessage = await tx.message.create({
          data: {
            content,
            type: type || 'TEXT',
            senderId: userId,
            senderName: dmSenderInfo?.name || null,
            senderEmail: dmSenderInfo?.email || null,
            senderAvatarUrl: dmSenderInfo?.avatarUrl || null,
            recipientId: conversationId,
            recipientName: recipientInfo?.name || null,
            recipientEmail: recipientInfo?.email || null,
            fileUrl,
            fileName,
            fileSize,
            deliveredAt: new Date(),
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        })

        // Create notification within transaction
        await tx.notification.create({
          data: {
            userId: conversationId,
            type: 'NEW_MESSAGE',
            title: 'New message',
            message: `${dmSenderInfo?.name || 'Someone'} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            actionUrl: `/chat?conversation=${userId}&type=partner`
          }
        })

        return createdMessage
      })

      message = createdDMMessage
      
      // FIX: Cache the message ID for idempotency
      if (idempotencyKey) {
        idempotencyCache.set(`${userId}:${idempotencyKey}`, {
          messageId: message.id,
          timestamp: Date.now()
        })
      }

      // Scan message content for moderation (non-blocking, outside transaction)
      scanMessageContent(
        message.id,
        content,
        'DIRECT_MESSAGE',
        userId,
        dmSenderInfo?.email,
        dmSenderInfo?.name || undefined,
        conversationId,
        'partner'
      )

      // Send push notification (async, don't wait - outside transaction)
      notifyNewMessage(userId, conversationId, content, 'partner').catch(err => {
        logger.error('Failed to send push notification', err instanceof Error ? err : { error: err })
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
