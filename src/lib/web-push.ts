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

// ==========================================
// CLERVA PUSH NOTIFICATION PHILOSOPHY
// ==========================================
// Push notifications are the voice of the guide, not a marketing tool.
// They should answer one of these questions:
//   - "What should I do now?"
//   - "You're close — finish this."
//   - "You're stuck — here's help."
//   - "You're about to forget this."
// Nothing else.
//
// Rules:
// - No emojis, no hype - calm confidence
// - Context + specific next action
// - Max 1 per day (except urgent)
// - Never: "We miss you", "Come back", "Don't lose your streak"
// ==========================================

// Notification types for consistent handling
export type PushNotificationType =
  // ==========================================
  // ACTIVE - Guidance-based notifications
  // ==========================================
  | 'MISSION_READY'          // Today's mission is ready
  | 'MISSION_INCOMPLETE'     // One step left in mission
  | 'STUCK_HELP'             // User struggled - offer help
  | 'REVIEW_DUE'             // About to forget something
  | 'TEST_PREP'              // Test deadline approaching
  | 'SESSION_SUMMARY'        // Session completed summary
  | 'PROGRESS_UPDATE'        // You're close to finishing
  | 'ACTIVATION_NUDGE'       // New user gentle nudge
  | 'ANNOUNCEMENT'           // Admin announcements (rare)
  
  // ==========================================
  // LEGACY - Kept for backward compatibility only
  // ==========================================
  | 'BADGE_EARNED'           // @deprecated - too gamification-focused
  | 'STREAK_REMINDER'        // @deprecated - creates anxiety
  | 'XP_MILESTONE'           // @deprecated - not guidance-focused
  | 'NEW_MESSAGE'            // @deprecated
  | 'INCOMING_CALL'          // @deprecated
  | 'CONNECTION_REQUEST'     // @deprecated
  | 'CONNECTION_ACCEPTED'    // @deprecated
  | 'POST_LIKE'              // @deprecated
  | 'POST_COMMENT'           // @deprecated
  | 'SESSION_INVITE'         // @deprecated
  | 'SESSION_STARTED'        // @deprecated
  | 'GROUP_INVITE'           // @deprecated
  | 'LEADERBOARD_RANK'       // @deprecated
  | 'PARTNER_STARTED_STUDYING' // @deprecated
  | 'LEADERBOARD_RANK_DROP'  // @deprecated
  | 'AI_SESSION_COMPLETE'    // @deprecated - renamed to SESSION_SUMMARY
  | 'MISSION_REMINDER'       // @deprecated - renamed to MISSION_READY
  | 'LEARNING_INSIGHT'       // @deprecated

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

// ==========================================
// CLERVA GUIDANCE NOTIFICATIONS
// Calm, specific, actionable - no emojis, no hype
// ==========================================

/**
 * Today's mission is ready
 * For: Returning users with missions
 * Tone: Specific, time-bounded, outcome-oriented
 */
export async function pushMissionReady(
  userId: string,
  topic: string,
  estimatedMinutes: number = 10
): Promise<void> {
  await sendPushToUser(userId, {
    title: "Today's mission is ready",
    body: `${estimatedMinutes} minutes on ${topic}. Ready when you are.`,
    type: 'MISSION_READY',
    url: '/dashboard',
    data: { topic, estimatedMinutes },
  })
}

/**
 * Mission almost complete - one step left
 * For: Users mid-mission who paused
 * Tone: Encouraging, specific progress
 */
export async function pushMissionIncomplete(
  userId: string,
  topic: string,
  percentComplete: number = 70
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'One step left',
    body: `You're ${percentComplete}% through ${topic}. Finish strong?`,
    type: 'MISSION_INCOMPLETE',
    url: '/dashboard',
    data: { topic, percentComplete },
  })
}

/**
 * User struggled - offer help
 * For: Users who failed quizzes or got stuck
 * Tone: Calm, non-judgmental, supportive
 */
export async function pushStuckHelp(
  userId: string,
  topic: string,
  variant: 'tricky' | 'common' | 'breakdown' = 'tricky'
): Promise<void> {
  const messages = {
    tricky: `That topic was tricky. Want a simpler explanation?`,
    common: `Most students struggle with ${topic}. Want to break it down?`,
    breakdown: `I noticed ${topic} slowed you down. Need help?`,
  }

  await sendPushToUser(userId, {
    title: 'Need a hand?',
    body: messages[variant],
    type: 'STUCK_HELP',
    url: '/dashboard',
    data: { topic, variant },
  })
}

/**
 * Spaced repetition review due
 * For: Users about to forget something
 * Tone: Helpful, specific
 */
export async function pushReviewDue(
  userId: string,
  topic: string,
  cardCount: number = 5
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Quick review will lock this in',
    body: `${cardCount} cards on ${topic} are ready for review.`,
    type: 'REVIEW_DUE',
    url: '/dashboard',
    data: { topic, cardCount },
  })
}

/**
 * Test deadline approaching
 * For: Users with upcoming tests
 * Tone: Urgency without anxiety
 */
export async function pushTestPrep(
  userId: string,
  testName: string,
  daysUntil: number,
  weakSpotCount: number = 2
): Promise<void> {
  const body = daysUntil === 1
    ? `10-minute review now will help tomorrow.`
    : `${daysUntil} days left. Focus on ${weakSpotCount} weak spot${weakSpotCount > 1 ? 's' : ''} today.`

  await sendPushToUser(userId, {
    title: `${testName} is ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
    body,
    type: 'TEST_PREP',
    url: '/dashboard',
    data: { testName, daysUntil, weakSpotCount },
  })
}

/**
 * Session completed - brief summary
 * For: After AI Partner session ends
 * Tone: Calm acknowledgment, next step
 */
export async function pushSessionSummary(
  userId: string,
  topic: string,
  durationMinutes: number
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'Session complete',
    body: `${durationMinutes} minutes on ${topic}. Nice work.`,
    type: 'SESSION_SUMMARY',
    url: '/dashboard',
    data: { topic, durationMinutes },
  })
}

/**
 * Progress update - close to finishing
 * For: Users near a learning goal
 * Tone: Specific progress, encouraging
 */
export async function pushProgressUpdate(
  userId: string,
  topic: string,
  progressPercent: number
): Promise<void> {
  await sendPushToUser(userId, {
    title: 'You\'re almost there',
    body: `${progressPercent}% through ${topic}. One more session to finish.`,
    type: 'PROGRESS_UPDATE',
    url: '/dashboard',
    data: { topic, progressPercent },
  })
}

/**
 * Activation nudge for new users
 * For: New users / guests who haven't returned
 * Tone: Low pressure, inviting, no guilt
 */
export async function pushActivationNudge(
  userId: string,
  variant: 'stuck' | 'quick' | 'easy' = 'stuck'
): Promise<void> {
  const messages = {
    stuck: {
      title: 'Still stuck on something?',
      body: 'Send it here. I\'ll help.',
    },
    quick: {
      title: 'Got 5 minutes?',
      body: 'Show me what you\'re working on.',
    },
    easy: {
      title: 'You don\'t need to know what to ask',
      body: 'Just send the problem.',
    },
  }

  await sendPushToUser(userId, {
    title: messages[variant].title,
    body: messages[variant].body,
    type: 'ACTIVATION_NUDGE',
    url: '/dashboard',
    data: { variant },
  })
}

// ==========================================
// LEGACY FUNCTIONS - Deprecated but kept for compatibility
// These should not be used in new code
// ==========================================

/**
 * @deprecated Use pushSessionSummary instead
 */
export async function pushAISessionComplete(
  userId: string,
  sessionDuration: number,
  xpEarned: number,
  topic?: string
): Promise<void> {
  // Redirect to new function
  await pushSessionSummary(userId, topic || 'your session', sessionDuration)
}

/**
 * @deprecated Use pushMissionReady instead
 */
export async function pushMissionReminder(
  userId: string,
  missionCount: number,
  topicPreview?: string
): Promise<void> {
  await pushMissionReady(userId, topicPreview || 'your weak spots', 10)
}

/**
 * @deprecated XP notifications are too gamification-focused
 */
export async function pushXPMilestone(
  _userId: string,
  _totalXP: number,
  _milestone: number
): Promise<void> {
  // No-op - XP milestones don't align with guidance philosophy
  // Silently ignored in production
}

/**
 * @deprecated Streak reminders create anxiety
 */
export async function pushStreakReminder(
  _userId: string,
  _currentStreak: number
): Promise<void> {
  // No-op - streak pressure doesn't align with guidance philosophy
  // Silently ignored in production
}

/**
 * @deprecated Use pushProgressUpdate or pushStuckHelp instead
 */
export async function pushLearningInsight(
  userId: string,
  insightTitle: string,
  insightBody: string
): Promise<void> {
  // Redirect to progress update
  await pushProgressUpdate(userId, insightTitle, 50)
}

// ==========================================
// LEGACY NOTIFICATIONS - DEPRECATED
// These features no longer exist in the app
// Kept for backward compatibility only
// ==========================================

/**
 * @deprecated No leaderboard in new vision
 */
export async function pushGlobalLeaderboardRank(
  _userId: string,
  _newRank: number,
  _previousRank: number
): Promise<void> {
  // No-op - feature removed, silently ignored
}

/**
 * @deprecated No leaderboard in new vision
 */
export async function pushLeaderboardRankDrop(
  _userId: string,
  _newRank: number,
  _previousRank: number
): Promise<void> {
  // No-op - feature removed, silently ignored
}

/**
 * @deprecated No human partners in new vision
 */
export async function pushPartnerStartedStudying(
  _userId: string,
  _partnerName: string,
  _activityType: 'focus' | 'solo_study' | 'study_session' | 'flashcards',
  _subject?: string
): Promise<void> {
  // No-op - feature removed, silently ignored
}
