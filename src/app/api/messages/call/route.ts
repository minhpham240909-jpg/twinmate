import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { CallType, CallStatus, NotificationType } from '@prisma/client'
import { callMessageSchema, validateRequest } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export async function POST(req: NextRequest) {
  // Rate limit: 10 call operations per minute
  const rateLimitResult = await rateLimit(req, { max: 10, windowMs: 60 * 1000, keyPrefix: 'call' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many call requests. Please wait.' },
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

    const userId = user.id
    const body = await req.json()

    // Validate request body
    const validation = validateRequest(callMessageSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const {
      action, // 'start' or 'end'
      messageId, // For updating existing message (when ending call)
      conversationId,
      conversationType,
      callType, // 'AUDIO' or 'VIDEO'
      callDuration, // Duration in seconds (only when ending)
      callStatus // 'STARTED', 'COMPLETED', 'MISSED', etc.
    } = validation.data

    // If action is 'end', update existing message
    if (action === 'end' && messageId) {
      // First verify ownership - only the sender can end their own call
      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
        select: { senderId: true },
      })

      if (!existingMessage) {
        return NextResponse.json(
          { error: 'Call message not found' },
          { status: 404 }
        )
      }

      if (existingMessage.senderId !== userId) {
        return NextResponse.json(
          { error: 'You are not authorized to end this call' },
          { status: 403 }
        )
      }

      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          callDuration,
          callStatus: callStatus || 'COMPLETED',
          content: callStatus === 'COMPLETED'
            ? `${callType === 'VIDEO' ? 'Video' : 'Audio'} call - ${formatDuration(callDuration || 0)}`
            : callStatus === 'MISSED'
            ? `Missed ${callType === 'VIDEO' ? 'video' : 'audio'} call`
            : callStatus === 'CANCELLED'
            ? `Cancelled ${callType === 'VIDEO' ? 'video' : 'audio'} call`
            : `${callType === 'VIDEO' ? 'Video' : 'Audio'} call ended`
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

      return NextResponse.json({
        message: updatedMessage,
        success: true
      })
    }

    // Otherwise, create new call message (when starting)
    let message: any

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

      // Create group call message
      message = await prisma.message.create({
        data: {
          content: `${callType === 'VIDEO' ? 'Video' : 'Audio'} call started...`,
          type: 'CALL',
          senderId: userId,
          groupId: conversationId,
          callType: callType as CallType,
          callStatus: 'STARTED' as CallStatus,
          callStartedAt: new Date()
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

      // Get all group members except the caller to send notifications
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: conversationId,
          userId: { not: userId }
        },
        include: {
          user: { select: { name: true } }
        }
      })

      // Get group name for notification
      const group = await prisma.group.findUnique({
        where: { id: conversationId },
        select: { name: true }
      })

      // Create incoming call notifications for each group member
      // Include full caller details and call metadata for real-time display
      const notifications = groupMembers.map(member => ({
        userId: member.userId,
        type: 'INCOMING_CALL' as NotificationType,
        title: 'Incoming Call',
        message: `${message.sender.name} is calling the group`,
        actionUrl: `/chat?conversation=${conversationId}&type=group`,
        relatedUserId: userId,
        isRead: false,
        // Store call metadata for real-time notification display
        metadata: {
          callType: callType,
          messageId: message.id,
          groupName: group?.name,
          callerName: message.sender.name,
          callerAvatar: message.sender.avatarUrl,
          isGroupCall: true
        }
      }))

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications
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

      // Create DM call message
      message = await prisma.message.create({
        data: {
          content: `${callType === 'VIDEO' ? 'Video' : 'Audio'} call started...`,
          type: 'CALL',
          senderId: userId,
          recipientId: conversationId,
          callType: callType as CallType,
          callStatus: 'STARTED' as CallStatus,
          callStartedAt: new Date()
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

      // Create incoming call notification for the partner
      // Include full caller details and call metadata for real-time display
      await prisma.notification.create({
        data: {
          userId: conversationId,
          type: 'INCOMING_CALL' as NotificationType,
          title: 'Incoming Call',
          message: `${message.sender.name} is calling you`,
          actionUrl: `/chat?conversation=${userId}&type=partner`,
          relatedUserId: userId,
          isRead: false,
          // Store call metadata for real-time notification display
          metadata: {
            callType: callType,
            messageId: message.id,
            callerName: message.sender.name,
            callerAvatar: message.sender.avatarUrl,
            isGroupCall: false
          }
        }
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid conversation type' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message,
      success: true
    })

  } catch (error) {
    logger.error('Error handling call message', { error })
    return NextResponse.json(
      { error: 'Failed to handle call message' },
      { status: 500 }
    )
  }
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return '0s'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}
