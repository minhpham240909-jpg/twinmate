/**
 * Unified Notification Sender
 * Sends in-app, email, AND web push notifications based on user preferences
 */

import { prisma } from '@/lib/prisma'
import { sendNotificationEmail, NotificationContext } from '@/lib/email-notifications'
import logger from '@/lib/logger'
import { NotificationType } from '@prisma/client'
import {
  sendPushToUser,
  pushNewMessage,
  pushConnectionRequest,
  pushConnectionAccepted,
  pushSessionInvite,
  pushIncomingCall,
  pushPostLike,
  pushPostComment,
  PushNotificationType,
} from '@/lib/web-push'

interface SendNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  relatedUserId?: string
  relatedMatchId?: string
}

/**
 * Send in-app notification
 */
export async function createInAppNotification(params: SendNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        relatedUserId: params.relatedUserId,
        relatedMatchId: params.relatedMatchId,
      },
    })

    logger.info('In-app notification created', {
      userId: params.userId,
      type: params.type,
    })

    return notification
  } catch (error) {
    logger.error('Failed to create in-app notification', error as Error)
    return null
  }
}

/**
 * Send email notification based on user preferences
 */
export async function sendEmailIfEnabled(
  userId: string,
  emailType: 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED' | 'SESSION_INVITE' | 'NEW_MESSAGE',
  context: NotificationContext
) {
  try {
    // Get user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: {
        emailConnectionRequests: true,
        emailSessionInvites: true,
        emailMessages: true,
      },
    })

    // Check if email notifications are enabled for this type
    let shouldSendEmail = false
    switch (emailType) {
      case 'CONNECTION_REQUEST':
      case 'CONNECTION_ACCEPTED':
        shouldSendEmail = settings?.emailConnectionRequests ?? true
        break
      case 'SESSION_INVITE':
        shouldSendEmail = settings?.emailSessionInvites ?? true
        break
      case 'NEW_MESSAGE':
        shouldSendEmail = settings?.emailMessages ?? false
        break
    }

    if (shouldSendEmail) {
      await sendNotificationEmail(emailType, context)
      logger.info('Email notification sent', { userId, type: emailType })
    } else {
      logger.info('Email notification skipped (disabled by user)', {
        userId,
        type: emailType,
      })
    }
  } catch (error) {
    logger.error('Failed to send email notification', error as Error)
  }
}

/**
 * Unified notification sender - sends both in-app and email
 */
export async function sendNotification(params: SendNotificationParams & {
  emailType?: 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED' | 'SESSION_INVITE' | 'NEW_MESSAGE'
  emailContext?: Partial<NotificationContext>
}) {
  try {
    // Always create in-app notification
    await createInAppNotification(params)

    // Send email if enabled and context provided
    if (params.emailType && params.emailContext) {
      // Get user data for email
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true, name: true },
      })

      if (!user) {
        logger.warn('User not found for email notification', { userId: params.userId })
        return
      }

      // Get sender data if relatedUserId provided
      let senderName = params.emailContext.senderName
      if (params.relatedUserId && !senderName) {
        const sender = await prisma.user.findUnique({
          where: { id: params.relatedUserId },
          select: { name: true },
        })
        senderName = sender?.name || 'Someone'
      }

      const emailContext: NotificationContext = {
        userName: user.name,
        userEmail: user.email,
        actionUrl: params.actionUrl,
        senderName,
        ...params.emailContext,
      }

      await sendEmailIfEnabled(params.userId, params.emailType, emailContext)
    }
  } catch (error) {
    logger.error('Failed to send notification', error as Error)
  }
}

/**
 * Helper functions for specific notification types
 */

export async function notifyConnectionRequest(senderId: string, receiverId: string, matchId: string) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { name: true },
  })

  const senderName = sender?.name || 'Someone'

  // Send in-app + email notification
  await sendNotification({
    userId: receiverId,
    type: 'CONNECTION_REQUEST',
    title: 'New Connection Request',
    message: `${senderName} wants to connect with you`,
    actionUrl: `/connections`,
    relatedUserId: senderId,
    relatedMatchId: matchId,
    emailType: 'CONNECTION_REQUEST',
    emailContext: {
      senderName,
    },
  })

  // Send web push notification
  await pushConnectionRequest(receiverId, senderName, matchId)
}

export async function notifyConnectionAccepted(senderId: string, receiverId: string) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { name: true },
  })

  const senderName = sender?.name || 'Someone'

  // Send in-app + email notification
  await sendNotification({
    userId: receiverId,
    type: 'CONNECTION_ACCEPTED',
    title: 'Connection Accepted!',
    message: `${senderName} accepted your connection request`,
    actionUrl: `/chat?partner=${senderId}`,
    relatedUserId: senderId,
    emailType: 'CONNECTION_ACCEPTED',
    emailContext: {
      senderName,
    },
  })

  // Send web push notification
  await pushConnectionAccepted(receiverId, senderName)
}

export async function notifySessionInvite(
  senderId: string,
  receiverId: string,
  sessionId: string,
  sessionTitle: string
) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { name: true },
  })

  const senderName = sender?.name || 'Someone'

  // Send in-app + email notification
  await sendNotification({
    userId: receiverId,
    type: 'SESSION_INVITE',
    title: 'Study Session Invite',
    message: `${senderName} invited you to "${sessionTitle}"`,
    actionUrl: `/study-sessions/${sessionId}`,
    relatedUserId: senderId,
    emailType: 'SESSION_INVITE',
    emailContext: {
      senderName,
      additionalData: { sessionTitle },
    },
  })

  // Send web push notification
  await pushSessionInvite(receiverId, senderName, sessionTitle, sessionId)
}

export async function notifyNewMessage(
  senderId: string,
  receiverId: string,
  messagePreview?: string,
  conversationType: 'partner' | 'group' = 'partner'
) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { name: true },
  })

  const senderName = sender?.name || 'Someone'

  // Send in-app + email notification
  await sendNotification({
    userId: receiverId,
    type: 'NEW_MESSAGE',
    title: 'New Message',
    message: `${senderName} sent you a message`,
    actionUrl: `/chat?partner=${senderId}`,
    relatedUserId: senderId,
    emailType: 'NEW_MESSAGE',
    emailContext: {
      senderName,
    },
  })

  // Send web push notification
  await pushNewMessage(receiverId, senderName, messagePreview || 'New message', conversationType)
}

/**
 * Notify user about incoming call (high priority)
 */
export async function notifyIncomingCall(
  callerId: string,
  receiverId: string,
  sessionId: string,
  callType: 'AUDIO' | 'VIDEO'
) {
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { name: true },
  })

  const callerName = caller?.name || 'Someone'

  // Create in-app notification
  await createInAppNotification({
    userId: receiverId,
    type: 'INCOMING_CALL',
    title: `Incoming ${callType.toLowerCase()} call`,
    message: `${callerName} is calling you`,
    actionUrl: `/study-sessions/${sessionId}/lobby`,
    relatedUserId: callerId,
  })

  // Send web push notification (high priority)
  await pushIncomingCall(receiverId, callerName, sessionId, callType)
}

/**
 * Notify user about post like
 */
export async function notifyPostLike(likerId: string, postOwnerId: string, postId: string) {
  // Don't notify yourself
  if (likerId === postOwnerId) return

  const liker = await prisma.user.findUnique({
    where: { id: likerId },
    select: { name: true },
  })

  const likerName = liker?.name || 'Someone'

  // Create in-app notification
  await createInAppNotification({
    userId: postOwnerId,
    type: 'POST_LIKE',
    title: 'Someone liked your post',
    message: `${likerName} liked your post`,
    actionUrl: `/community`,
    relatedUserId: likerId,
  })

  // Send web push notification
  await pushPostLike(postOwnerId, likerName, postId)
}

/**
 * Notify user about post comment
 */
export async function notifyPostComment(
  commenterId: string,
  postOwnerId: string,
  postId: string,
  commentPreview: string
) {
  // Don't notify yourself
  if (commenterId === postOwnerId) return

  const commenter = await prisma.user.findUnique({
    where: { id: commenterId },
    select: { name: true },
  })

  const commenterName = commenter?.name || 'Someone'

  // Create in-app notification
  await createInAppNotification({
    userId: postOwnerId,
    type: 'POST_COMMENT',
    title: `${commenterName} commented on your post`,
    message: commentPreview.length > 100 ? commentPreview.substring(0, 100) + '...' : commentPreview,
    actionUrl: `/community`,
    relatedUserId: commenterId,
  })

  // Send web push notification
  await pushPostComment(postOwnerId, commenterName, commentPreview, postId)
}
