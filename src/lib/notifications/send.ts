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
  pushPartnerStartedStudying,
  pushLeaderboardRankDrop,
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
 * H13 FIX: Send in-app notification with retry logic
 * Implements exponential backoff for reliability
 */
export async function createInAppNotification(
  params: SendNotificationParams,
  options?: { maxRetries?: number; baseDelayMs?: number }
) {
  const { maxRetries = 3, baseDelayMs = 500 } = options || {}
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        attempt: attempt + 1,
      })

      return notification
    } catch (error) {
      lastError = error as Error
      logger.warn(`Notification creation attempt ${attempt + 1} failed`, {
        userId: params.userId,
        type: params.type,
        error: (error as Error).message,
      })
      
      // Check if error is retryable (database/network issues)
      const isRetryable = (error as Error).message?.includes('connection') ||
                          (error as Error).message?.includes('timeout') ||
                          (error as Error).message?.includes('deadlock') ||
                          (error as Error).message?.includes('temporarily')
      
      if (!isRetryable) {
        // Non-retryable error, stop immediately
        break
      }
      
      // Exponential backoff with jitter before retry
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // All retries failed
  logger.error(`Failed to create in-app notification after ${maxRetries} retries for user ${params.userId} (type: ${params.type})`, lastError as Error)
  
  return null
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
 * OPTIMIZED: Accepts pre-fetched user data to avoid N+1 queries
 */
export async function sendNotification(params: SendNotificationParams & {
  emailType?: 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED' | 'SESSION_INVITE' | 'NEW_MESSAGE'
  emailContext?: Partial<NotificationContext>
  // Pre-fetched data to avoid additional queries
  recipientData?: { email: string; name: string }
}) {
  try {
    // Always create in-app notification
    await createInAppNotification(params)

    // Send email if enabled and context provided
    if (params.emailType && params.emailContext) {
      // Use pre-fetched data or fetch if not provided
      let userData = params.recipientData
      if (!userData) {
        const user = await prisma.user.findUnique({
          where: { id: params.userId },
          select: { email: true, name: true },
        })
        if (!user) {
          logger.warn('User not found for email notification', { userId: params.userId })
          return
        }
        userData = user
      }

      // senderName should already be in emailContext (passed from caller to avoid N+1)
      const emailContext: NotificationContext = {
        userName: userData.name,
        userEmail: userData.email,
        actionUrl: params.actionUrl,
        senderName: params.emailContext.senderName || 'Someone',
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
 * OPTIMIZED: Batch fetch sender and receiver data in single query to avoid N+1
 */

export async function notifyConnectionRequest(senderId: string, receiverId: string, matchId: string) {
  try {
    // Batch fetch both users in single query
    const users = await prisma.user.findMany({
      where: { id: { in: [senderId, receiverId] } },
      select: { id: true, name: true, email: true },
    })
    const sender = users.find(u => u.id === senderId)
    const receiver = users.find(u => u.id === receiverId)
    const senderName = sender?.name || 'Someone'

    // Send in-app + email notification with pre-fetched data
    await sendNotification({
      userId: receiverId,
      type: 'CONNECTION_REQUEST',
      title: 'New Connection Request',
      message: `${senderName} wants to connect with you`,
      actionUrl: `/connections`,
      relatedUserId: senderId,
      relatedMatchId: matchId,
      emailType: 'CONNECTION_REQUEST',
      emailContext: { senderName },
      recipientData: receiver ? { email: receiver.email, name: receiver.name } : undefined,
    })

    // Send web push notification
    await pushConnectionRequest(receiverId, senderName, matchId)
  } catch (error) {
    logger.error('Failed to send connection request notification', error as Error)
  }
}

export async function notifyConnectionAccepted(senderId: string, receiverId: string) {
  try {
    // Batch fetch both users in single query
    const users = await prisma.user.findMany({
      where: { id: { in: [senderId, receiverId] } },
      select: { id: true, name: true, email: true },
    })
    const sender = users.find(u => u.id === senderId)
    const receiver = users.find(u => u.id === receiverId)
    const senderName = sender?.name || 'Someone'

    // Send in-app + email notification with pre-fetched data
    await sendNotification({
      userId: receiverId,
      type: 'CONNECTION_ACCEPTED',
      title: 'Connection Accepted!',
      message: `${senderName} accepted your connection request`,
      actionUrl: `/chat?partner=${senderId}`,
      relatedUserId: senderId,
      emailType: 'CONNECTION_ACCEPTED',
      emailContext: { senderName },
      recipientData: receiver ? { email: receiver.email, name: receiver.name } : undefined,
    })

    // Send web push notification
    await pushConnectionAccepted(receiverId, senderName)
  } catch (error) {
    logger.error('Failed to send connection accepted notification', error as Error)
  }
}

export async function notifySessionInvite(
  senderId: string,
  receiverId: string,
  sessionId: string,
  sessionTitle: string
) {
  try {
    // Batch fetch both users in single query
    const users = await prisma.user.findMany({
      where: { id: { in: [senderId, receiverId] } },
      select: { id: true, name: true, email: true },
    })
    const sender = users.find(u => u.id === senderId)
    const receiver = users.find(u => u.id === receiverId)
    const senderName = sender?.name || 'Someone'

    // Send in-app + email notification with pre-fetched data
    await sendNotification({
      userId: receiverId,
      type: 'SESSION_INVITE',
      title: 'Study Session Invite',
      message: `${senderName} invited you to "${sessionTitle}"`,
      actionUrl: `/study-sessions/${sessionId}`,
      relatedUserId: senderId,
      emailType: 'SESSION_INVITE',
      emailContext: { senderName, additionalData: { sessionTitle } },
      recipientData: receiver ? { email: receiver.email, name: receiver.name } : undefined,
    })

    // Send web push notification
    await pushSessionInvite(receiverId, senderName, sessionTitle, sessionId)
  } catch (error) {
    logger.error('Failed to send session invite notification', error as Error)
  }
}

export async function notifyNewMessage(
  senderId: string,
  receiverId: string,
  messagePreview?: string,
  conversationType: 'partner' | 'group' = 'partner'
) {
  try {
    // Batch fetch both users in single query
    const users = await prisma.user.findMany({
      where: { id: { in: [senderId, receiverId] } },
      select: { id: true, name: true, email: true },
    })
    const sender = users.find(u => u.id === senderId)
    const receiver = users.find(u => u.id === receiverId)
    const senderName = sender?.name || 'Someone'

    // Send in-app + email notification with pre-fetched data
    await sendNotification({
      userId: receiverId,
      type: 'NEW_MESSAGE',
      title: 'New Message',
      message: `${senderName} sent you a message`,
      actionUrl: `/chat?partner=${senderId}`,
      relatedUserId: senderId,
      emailType: 'NEW_MESSAGE',
      emailContext: { senderName },
      recipientData: receiver ? { email: receiver.email, name: receiver.name } : undefined,
    })

    // Send web push notification
    await pushNewMessage(receiverId, senderName, messagePreview || 'New message', conversationType)
  } catch (error) {
    logger.error('Failed to send new message notification', error as Error)
  }
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
  try {
    // Single query for caller name
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
  } catch (error) {
    logger.error('Failed to send incoming call notification', error as Error)
  }
}

/**
 * Notify user about post like
 */
export async function notifyPostLike(likerId: string, postOwnerId: string, postId: string) {
  try {
    // Don't notify yourself
    if (likerId === postOwnerId) return

    // Single query for liker name
    const liker = await prisma.user.findUnique({
      where: { id: likerId },
      select: { name: true },
    })
    const likerName = liker?.name || 'Someone'

    // Create in-app notification - celebratory tone
    // ✅ Inspire action: Make them feel good about engaging
    await createInAppNotification({
      userId: postOwnerId,
      type: 'POST_LIKE',
      title: '❤️ Your post is getting love!',
      message: `${likerName} appreciated your post`,
      actionUrl: `/community`,
      relatedUserId: likerId,
    })

    // Send web push notification
    await pushPostLike(postOwnerId, likerName, postId)
  } catch (error) {
    logger.error('Failed to send post like notification', error as Error)
  }
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
  try {
    // Don't notify yourself
    if (commenterId === postOwnerId) return

    // Single query for commenter name
    const commenter = await prisma.user.findUnique({
      where: { id: commenterId },
      select: { name: true },
    })
    const commenterName = commenter?.name || 'Someone'

    // Create in-app notification - engaging tone
    // ✅ Inspire action: Encourage continued conversation
    await createInAppNotification({
      userId: postOwnerId,
      type: 'POST_COMMENT',
      title: `💬 New comment from ${commenterName}`,
      message: commentPreview.length > 100 ? commentPreview.substring(0, 100) + '...' : commentPreview,
      actionUrl: `/community`,
      relatedUserId: commenterId,
    })

    // Send web push notification
    await pushPostComment(postOwnerId, commenterName, commentPreview, postId)
  } catch (error) {
    logger.error('Failed to send post comment notification', error as Error)
  }
}

// ==========================================
// SOCIAL ENGAGEMENT NOTIFICATIONS
// Pull users back to the app
// ==========================================

/**
 * Notify partners when a user starts studying
 * Creates FOMO to pull users back to the app
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Only notifies connected partners (not all users)
 * - Batches notifications to prevent N+1
 * - Limits to closest partners (max 10) to avoid spam
 * - Uses rate limiting to prevent notification fatigue
 */
export async function notifyPartnersStartedStudying(
  userId: string,
  activityType: 'focus' | 'solo_study' | 'study_session' | 'flashcards',
  subject?: string
) {
  try {
    // Get user info and their accepted matches (connections) in parallel
    const [user, matches] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      // Get accepted matches (bidirectional - user can be sender or receiver)
      prisma.match.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
        select: {
          senderId: true,
          receiverId: true,
        },
        take: 10, // Limit to prevent spam
      }),
    ])

    if (!user || matches.length === 0) return

    // Get partner IDs (the other person in each match)
    const partnerIds = matches.map((m) =>
      m.senderId === userId ? m.receiverId : m.senderId
    )

    // Send push notifications to all partners in parallel
    // No in-app notification to avoid clutter - push only for pull-back
    await Promise.all(
      partnerIds.map((partnerId) =>
        pushPartnerStartedStudying(partnerId, user.name, activityType, subject)
      )
    )

    logger.info('Partner studying notifications sent', {
      userId,
      partnerCount: partnerIds.length,
      activityType,
    })
  } catch (error) {
    // Don't throw - notifications are not critical
    logger.error('Failed to send partner studying notifications', error as Error)
  }
}

/**
 * Notify user when they drop in leaderboard ranking
 * Creates competitive urgency to bring them back
 *
 * CALL THIS: When leaderboard is recalculated (every 24h)
 */
export async function notifyLeaderboardRankDrop(
  userId: string,
  newRank: number,
  previousRank: number
) {
  try {
    // Only notify if they actually dropped and were in top 10
    if (newRank <= previousRank || previousRank > 10) return

    const positionsDown = newRank - previousRank

    // Create in-app notification
    // Note: LEADERBOARD_RANK_DROP type added to schema, run prisma generate if type error
    await createInAppNotification({
      userId,
      type: 'LEADERBOARD_RANK_DROP' as NotificationType,
      title: '📉 Someone passed you!',
      message: `You dropped from #${previousRank} to #${newRank}. Study now to reclaim your spot!`,
      actionUrl: '/dashboard',
    })

    // Send push notification
    await pushLeaderboardRankDrop(userId, newRank, previousRank)

    logger.info('Leaderboard rank drop notification sent', {
      userId,
      previousRank,
      newRank,
      positionsDown,
    })
  } catch (error) {
    logger.error('Failed to send leaderboard rank drop notification', error as Error)
  }
}
