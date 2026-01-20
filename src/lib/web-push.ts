/**
 * Web Push Notification Service
 * Handles sending push notifications to users' devices even when the app is closed
 */

import webPush from 'web-push'
import { prisma } from '@/lib/prisma'

// Configure VAPID keys for Web Push
// VAPID (Voluntary Application Server Identification) authenticates your server
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:privacy@clerva.app'

// Initialize web-push with VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Notification types for consistent handling
export type PushNotificationType =
  | 'NEW_MESSAGE'
  | 'INCOMING_CALL'
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'SESSION_INVITE'
  | 'SESSION_STARTED'
  | 'GROUP_INVITE'
  | 'ANNOUNCEMENT'
  | 'BADGE_EARNED'
  | 'STREAK_REMINDER'
  | 'LEADERBOARD_RANK'  // You moved up in the global leaderboard
  | 'PARTNER_STARTED_STUDYING'  // Pull-back notification
  | 'LEADERBOARD_RANK_DROP'  // Competitive engagement

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  type: PushNotificationType
  url?: string
  requireInteraction?: boolean
  silent?: boolean
  renotify?: boolean
  data?: Record<string, any>
  actions?: Array<{ action: string; title: string; icon?: string }>
}

/**
 * Check if Web Push is properly configured
 */
export function isWebPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

/**
 * Get the public VAPID key for client-side subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY
}

/**
 * Send a push notification to a specific subscription
 */
async function sendToSubscription(
  subscription: {
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!isWebPushConfigured()) {
    return { success: false, error: 'Web Push not configured' }
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    await webPush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: payload.type === 'INCOMING_CALL' ? 'high' : 'normal',
      }
    )

    return { success: true }
  } catch (error: any) {
    // Handle specific error codes
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription has expired or is invalid - should be removed
      return { success: false, error: 'subscription_expired' }
    }
    if (error.statusCode === 413) {
      return { success: false, error: 'payload_too_large' }
    }
    if (error.statusCode === 429) {
      return { success: false, error: 'rate_limited' }
    }

    console.error('Push notification error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Send a push notification to all of a user's subscriptions
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!isWebPushConfigured()) {
    console.log('Web Push not configured, skipping push notification')
    return { sent: 0, failed: 0 }
  }

  try {
    // Get all active subscriptions for the user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
    })

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    // Send to all subscriptions in parallel
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendToSubscription(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload
        )

        if (result.success) {
          // Update last used timestamp
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsed: new Date(), failCount: 0 },
          }).catch(() => {}) // Ignore update errors

          return { success: true, id: sub.id }
        } else {
          // Handle failed subscriptions
          if (result.error === 'subscription_expired') {
            // Delete expired subscription
            await prisma.pushSubscription.delete({
              where: { id: sub.id },
            }).catch(() => {})
          } else {
            // Increment fail count
            const newFailCount = sub.failCount + 1
            if (newFailCount >= 5) {
              // Deactivate after 5 failures
              await prisma.pushSubscription.update({
                where: { id: sub.id },
                data: { isActive: false, failCount: newFailCount },
              }).catch(() => {})
            } else {
              await prisma.pushSubscription.update({
                where: { id: sub.id },
                data: { failCount: newFailCount },
              }).catch(() => {})
            }
          }

          return { success: false, id: sub.id, error: result.error }
        }
      })
    )

    results.forEach((r) => {
      if (r.success) sent++
      else failed++
    })

    return { sent, failed }
  } catch (error) {
    console.error('Error sending push to user:', error)
    return { sent: 0, failed: 0 }
  }
}

/**
 * Send push notifications to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0
  let totalFailed = 0

  // Process in batches to avoid overwhelming the server
  const batchSize = 10
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map((userId) => sendPushToUser(userId, payload))
    )

    results.forEach((r) => {
      totalSent += r.sent
      totalFailed += r.failed
    })
  }

  return { totalSent, totalFailed }
}

// ==========================================
// NOTIFICATION HELPER FUNCTIONS
// ==========================================

/**
 * Send push notification for new message
 */
export async function pushNewMessage(
  userId: string,
  senderName: string,
  messagePreview: string,
  conversationType: 'partner' | 'group',
  conversationId?: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: `New message from ${senderName}`,
    body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
    type: 'NEW_MESSAGE',
    url: `/chat/${conversationType}s`,
    renotify: true,
    data: {
      conversationType,
      conversationId,
    },
  })
}

/**
 * Send push notification for incoming call
 */
export async function pushIncomingCall(
  userId: string,
  callerName: string,
  sessionId: string,
  callType: 'AUDIO' | 'VIDEO'
): Promise<void> {
  await sendPushToUser(userId, {
    title: `Incoming ${callType.toLowerCase()} call`,
    body: `${callerName} is calling you`,
    type: 'INCOMING_CALL',
    url: `/study-sessions/${sessionId}/lobby`,
    requireInteraction: true,
    data: {
      sessionId,
      callType,
      callerName,
    },
  })
}

/**
 * Send push notification for connection request
 */
export async function pushConnectionRequest(
  userId: string,
  requesterName: string,
  requestId: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'New Connection Request',
    body: `${requesterName} wants to connect with you`,
    type: 'CONNECTION_REQUEST',
    url: '/connections',
    data: {
      id: requestId,
    },
  })
}

/**
 * Send push notification for connection accepted
 */
export async function pushConnectionAccepted(
  userId: string,
  accepterName: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Connection Accepted',
    body: `${accepterName} accepted your connection request`,
    type: 'CONNECTION_ACCEPTED',
    url: '/dashboard/partners',
  })
}

/**
 * Send push notification for post like
 * ✅ Celebratory tone - inspire engagement
 */
export async function pushPostLike(
  userId: string,
  likerName: string,
  postId: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: '❤️ Your post is getting love!',
    body: `${likerName} appreciated your post`,
    type: 'POST_LIKE',
    url: `/community`,
    tag: `post-like-${postId}`,
    data: {
      postId,
    },
  })
}

/**
 * Send push notification for post comment
 * ✅ Engaging tone - encourage conversation
 */
export async function pushPostComment(
  userId: string,
  commenterName: string,
  commentPreview: string,
  postId: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: `💬 New comment from ${commenterName}`,
    body: commentPreview.length > 100 ? commentPreview.substring(0, 100) + '...' : commentPreview,
    type: 'POST_COMMENT',
    url: `/community`,
    tag: `post-comment-${postId}`,
    data: {
      postId,
    },
  })
}

/**
 * Send push notification for session invite
 */
export async function pushSessionInvite(
  userId: string,
  inviterName: string,
  sessionTitle: string,
  sessionId: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Study Session Invite',
    body: `${inviterName} invited you to "${sessionTitle}"`,
    type: 'SESSION_INVITE',
    url: `/study-sessions/${sessionId}/lobby`,
    data: {
      sessionId,
    },
  })
}

/**
 * Send push notification for group invite
 */
export async function pushGroupInvite(
  userId: string,
  inviterName: string,
  groupName: string,
  groupId: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Group Invite',
    body: `${inviterName} invited you to join "${groupName}"`,
    type: 'GROUP_INVITE',
    url: `/groups/${groupId}`,
    data: {
      groupId,
    },
  })
}

/**
 * Send push notification for announcement
 */
export async function pushAnnouncement(
  userIds: string[],
  title: string,
  message: string
): Promise<void> {
  await sendPushToUsers(userIds, {
    title,
    body: message.length > 200 ? message.substring(0, 200) + '...' : message,
    type: 'ANNOUNCEMENT',
    url: '/dashboard',
    requireInteraction: true,
  })
}

/**
 * Send push notification for badge earned
 */
export async function pushBadgeEarned(
  userId: string,
  badgeName: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Achievement Unlocked!',
    body: `You earned the "${badgeName}" badge`,
    type: 'BADGE_EARNED',
    url: '/profile',
  })
}

/**
 * Send push notification for streak reminder
 */
export async function pushStreakReminder(
  userId: string,
  currentStreak: number
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Keep Your Streak Going!',
    body: `You have a ${currentStreak} day streak. Study today to keep it going!`,
    type: 'STREAK_REMINDER',
    url: '/dashboard',
  })
}

// ==========================================
// GLOBAL LEADERBOARD NOTIFICATIONS
// ==========================================

/**
 * Send push notification when user moves up in the global leaderboard
 */
export async function pushGlobalLeaderboardRank(
  userId: string,
  newRank: number,
  previousRank: number
): Promise<void> {
  const positionsUp = previousRank - newRank
  const rankEmoji = newRank === 1 ? '🥇' : newRank === 2 ? '🥈' : newRank === 3 ? '🥉' : '📈'

  await sendPushToUser(userId, {
    title: `${rankEmoji} You're climbing the leaderboard!`,
    body: `You moved up ${positionsUp} spot${positionsUp > 1 ? 's' : ''} to #${newRank} globally!`,
    type: 'LEADERBOARD_RANK',
    url: '/dashboard',
    data: {
      newRank,
      previousRank,
    },
  })
}

/**
 * Send push notification when user drops in leaderboard
 * Creates competitive urgency to bring them back
 */
export async function pushLeaderboardRankDrop(
  userId: string,
  newRank: number,
  previousRank: number
): Promise<void> {
  const positionsDown = newRank - previousRank

  await sendPushToUser(userId, {
    title: `📉 Someone passed you!`,
    body: `You dropped from #${previousRank} to #${newRank}. Study now to reclaim your spot!`,
    type: 'LEADERBOARD_RANK_DROP',
    url: '/dashboard',
    data: {
      newRank,
      previousRank,
      positionsDown,
    },
  })
}

// ==========================================
// SOCIAL ENGAGEMENT NOTIFICATIONS
// ==========================================

/**
 * Send push notification when study partner starts studying
 * Creates FOMO to pull users back to the app
 *
 * PERFORMANCE: Use sparingly - only notify close partners, not all connections
 */
export async function pushPartnerStartedStudying(
  userId: string,
  partnerName: string,
  activityType: 'focus' | 'solo_study' | 'study_session' | 'flashcards',
  subject?: string
): Promise<void> {
  // Activity-specific messaging
  const activityMessages: Record<string, { emoji: string; action: string }> = {
    focus: { emoji: '🎯', action: 'started a focus session' },
    solo_study: { emoji: '📚', action: 'is studying solo' },
    study_session: { emoji: '👥', action: 'joined a study session' },
    flashcards: { emoji: '🃏', action: 'is reviewing flashcards' },
  }

  const activity = activityMessages[activityType] || { emoji: '📖', action: 'started studying' }
  const subjectText = subject ? ` (${subject})` : ''

  await sendPushToUser(userId, {
    title: `${activity.emoji} ${partnerName} is studying!`,
    body: `${partnerName} ${activity.action}${subjectText}. Join them?`,
    type: 'PARTNER_STARTED_STUDYING',
    url: '/dashboard',
    tag: 'partner-studying', // Group multiple partner notifications
    data: {
      activityType,
      subject,
    },
  })
}
