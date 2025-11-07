/**
 * Notification system for browser push notifications
 * Handles showing notifications and navigation on click
 */

export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'incoming_call'
  | 'session_invite'
  | 'new_message'
  | 'post_comment'
  | 'post_like'
  | 'post_repost'

export interface NotificationData {
  type: NotificationType
  title: string
  body: string
  icon?: string
  data?: {
    url?: string
    userId?: string
    postId?: string
    sessionId?: string
    chatId?: string
  }
}

/**
 * Check if notifications are supported and permission granted
 * Also checks if user has enabled notifications in app settings
 */
export function canShowNotifications(): boolean {
  if (typeof window === 'undefined') return false

  // Check browser permission
  const browserPermission = 'Notification' in window && Notification.permission === 'granted'
  if (!browserPermission) return false

  // Check app-level preference (user can disable in app even if browser permission granted)
  const appPreference = localStorage.getItem('notifications_enabled')
  if (appPreference === 'false') return false

  return true
}

/**
 * Enable notifications at app level
 */
export function enableNotifications(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('notifications_enabled', 'true')
}

/**
 * Disable notifications at app level
 */
export function disableNotifications(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('notifications_enabled', 'false')
}

/**
 * Check if notifications are enabled at app level
 */
export function areNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const preference = localStorage.getItem('notifications_enabled')
  // Default to true if not set
  return preference !== 'false'
}

/**
 * Show a browser notification
 */
export function showNotification(notification: NotificationData): void {
  if (!canShowNotifications()) {
    console.log('Notifications not available or not granted')
    return
  }

  try {
    const { title, body, icon, data } = notification

    const notificationOptions: NotificationOptions = {
      body,
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: notification.type,
      requireInteraction: notification.type === 'incoming_call', // Keep call notifications visible
      data: data || {},
    }

    const browserNotification = new Notification(title, notificationOptions)

    // Handle notification click
    browserNotification.onclick = (event) => {
      event.preventDefault()

      // Focus or open the app window
      if (typeof window !== 'undefined') {
        window.focus()

        // Navigate to relevant page
        if (data?.url) {
          window.location.href = data.url
        }
      }

      browserNotification.close()
    }
  } catch (error) {
    console.error('Error showing notification:', error)
  }
}

/**
 * Helper functions for specific notification types
 */

export function notifyConnectionRequest(fromUser: { name: string; id: string }): void {
  showNotification({
    type: 'connection_request',
    title: 'New Connection Request',
    body: `${fromUser.name} wants to be your study partner`,
    data: {
      url: '/connections',
      userId: fromUser.id,
    },
  })
}

export function notifyConnectionAccepted(fromUser: { name: string; id: string }): void {
  showNotification({
    type: 'connection_accepted',
    title: 'Connection Accepted!',
    body: `${fromUser.name} accepted your study partner request`,
    data: {
      url: '/dashboard/partners',
      userId: fromUser.id,
    },
  })
}

export function notifyIncomingCall(fromUser: { name: string; id: string }, sessionId: string): void {
  showNotification({
    type: 'incoming_call',
    title: '📞 Incoming Call',
    body: `${fromUser.name} is calling you`,
    data: {
      url: `/study-sessions/${sessionId}`,
      userId: fromUser.id,
      sessionId,
    },
  })
}

export function notifySessionInvite(fromUser: { name: string; id: string }, sessionId: string): void {
  showNotification({
    type: 'session_invite',
    title: 'Study Session Invite',
    body: `${fromUser.name} invited you to a study session`,
    data: {
      url: `/study-sessions/${sessionId}`,
      userId: fromUser.id,
      sessionId,
    },
  })
}

export function notifyNewMessage(fromUser: { name: string; id: string }, preview: string): void {
  showNotification({
    type: 'new_message',
    title: `Message from ${fromUser.name}`,
    body: preview,
    data: {
      url: '/chat',
      userId: fromUser.id,
    },
  })
}

export function notifyPostComment(fromUser: { name: string; id: string }, postId: string): void {
  showNotification({
    type: 'post_comment',
    title: 'New Comment',
    body: `${fromUser.name} commented on your post`,
    data: {
      url: '/community',
      userId: fromUser.id,
      postId,
    },
  })
}

export function notifyPostLike(fromUser: { name: string; id: string }, postId: string): void {
  showNotification({
    type: 'post_like',
    title: 'New Like',
    body: `${fromUser.name} liked your post`,
    data: {
      url: '/community',
      userId: fromUser.id,
      postId,
    },
  })
}
