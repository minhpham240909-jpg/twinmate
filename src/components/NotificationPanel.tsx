'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeToNotifications } from '@/lib/supabase/realtime'
import { useAuth } from '@/lib/auth/context'
import { useTranslations } from 'next-intl'
import {
  notifyConnectionRequest,
  notifyConnectionAccepted,
  notifyIncomingCall,
  notifySessionInvite,
  notifyNewMessage,
  notifyPostComment,
  notifyPostLike,
  canShowNotifications
} from '@/lib/notifications'
import toast from 'react-hot-toast'
import { useConfirmModal } from '@/hooks/useConfirmModal'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  actionUrl?: string | null
  relatedUserId?: string | null
  relatedMatchId?: string | null
  createdAt: string
}

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange: (count: number) => void
}

export default function NotificationPanel({ isOpen, onClose, onUnreadCountChange }: NotificationPanelProps) {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('common')
  const { showDanger } = useConfirmModal()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  // Fix hydration: only render time-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Define which notification types should appear in the bell icon (CRITICAL ONLY)
  // Feature-specific notifications appear in their respective pages:
  // - Connection notifications → /connections page (badge count)
  // - Session notifications → /study-sessions page (badge count)
  // - Group notifications → /groups page (badge count)
  // - Message notifications → /chat page (badge count)
  // - Community notifications → /community page (badge count)
  const BELL_NOTIFICATION_TYPES = [
    'ANNOUNCEMENT',        // Critical app announcements from team
    'FOUNDER_MESSAGE',     // Important messages from founder
    'INCOMING_CALL'        // Critical - needs immediate attention
  ]

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return

    const unsubscribe = subscribeToNotifications(user.id, (newNotification) => {
      const typedNotification = newNotification as unknown as Notification

      // Only add to bell panel if it's a system/critical notification
      if (BELL_NOTIFICATION_TYPES.includes(typedNotification.type)) {
        setNotifications(prev => [typedNotification, ...prev])
      }

      // Update unread count - fetch fresh count from API to get accurate system notification count
      if (!typedNotification.isRead && BELL_NOTIFICATION_TYPES.includes(typedNotification.type)) {
        fetchNotifications()
      }

      // IMPORTANT: Show browser/push notification for ALL types (not just bell types)
      // This ensures users get notified even when not on the specific feature page
      if (canShowNotifications() && !typedNotification.isRead) {
        const type = typedNotification.type
        const relatedUserId = typedNotification.relatedUserId || ''

        // Get user info from notification message (basic parsing)
        const userName = typedNotification.message.split(' ')[0] || 'Someone'
        const fromUser = { name: userName, id: relatedUserId }

        // Trigger appropriate browser notification type for ALL notification types
        if (type === 'MATCH_REQUEST' || type === 'CONNECTION_REQUEST') {
          notifyConnectionRequest(fromUser)
        } else if (type === 'MATCH_ACCEPTED' || type === 'CONNECTION_ACCEPTED') {
          notifyConnectionAccepted(fromUser)
        } else if (type === 'INCOMING_CALL') {
          const sessionId = typedNotification.actionUrl?.split('/').pop() || ''
          notifyIncomingCall(fromUser, sessionId)
        } else if (type === 'SESSION_INVITE') {
          const sessionId = typedNotification.actionUrl?.split('/').pop() || ''
          notifySessionInvite(fromUser, sessionId)
        } else if (type === 'NEW_MESSAGE') {
          notifyNewMessage(fromUser, typedNotification.message)
        } else if (type === 'POST_COMMENT') {
          const postId = typedNotification.actionUrl?.match(/postId=([^&]+)/)?.[1] || ''
          notifyPostComment(fromUser, postId)
        } else if (type === 'POST_LIKE') {
          const postId = typedNotification.actionUrl?.match(/postId=([^&]+)/)?.[1] || ''
          notifyPostLike(fromUser, postId)
        } else if (type === 'GROUP_INVITE') {
          // Generic browser notification for group invites
          new Notification(typedNotification.title, {
            body: typedNotification.message,
            icon: '/logo.png',
            tag: `group-invite-${typedNotification.id}`
          })
        } else if (type === 'SESSION_STARTED' || type === 'SESSION_ENDED' || type === 'SESSION_JOINED') {
          // Generic browser notification for session updates
          new Notification(typedNotification.title, {
            body: typedNotification.message,
            icon: '/logo.png',
            tag: `session-update-${typedNotification.id}`
          })
        } else if (type === 'STUDY_REMINDER' || type === 'BADGE_EARNED' || type === 'STREAK_REMINDER') {
          // Generic browser notification for system notifications
          new Notification(typedNotification.title, {
            body: typedNotification.message,
            icon: '/logo.png',
            tag: `system-${typedNotification.id}`
          })
        }
      }
    })

    return unsubscribe
  }, [user?.id, onUnreadCountChange])

  // Fetch notifications on mount to set initial bell count
  useEffect(() => {
    if (user?.id) {
      fetchNotifications()
    }
  }, [user?.id])

  // Refresh notifications when panel is opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        // Filter to show only system/critical notifications in bell icon
        // Feature-specific notifications are shown in their respective pages
        const allNotifications = data.notifications || []
        const filteredNotifications = allNotifications.filter((n: Notification) =>
          BELL_NOTIFICATION_TYPES.includes(n.type)
        )
        setNotifications(filteredNotifications)

        // Update unread count for bell icon (only system/critical notifications)
        const unreadCount = filteredNotifications.filter((n: Notification) => !n.isRead).length
        onUnreadCountChange(unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      )

      const unreadCount = notifications.filter(n => !n.isRead && n.id !== notificationId).length
      onUnreadCountChange(unreadCount)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      })

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      onUnreadCountChange(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    // Handle connection request notifications
    if (notification.type === 'CONNECTION_REQUEST' && notification.relatedMatchId) {
      // Navigate to a connection requests page or show a modal
      router.push(`/connections`)
    } else if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  const handleAcceptConnection = async (matchId: string, notificationId: string) => {
    try {
      const response = await fetch('/api/connections/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      })

      if (response.ok) {
        await markAsRead(notificationId)
        await fetchNotifications()
        toast.success('Connection accepted!')
      }
    } catch (error) {
      console.error('Error accepting connection:', error)
      toast.error('Failed to accept connection')
    }
  }

  const handleDeclineConnection = async (matchId: string, notificationId: string) => {
    try {
      const response = await fetch('/api/connections/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      })

      if (response.ok) {
        await markAsRead(notificationId)
        await fetchNotifications()
        toast.success('Connection declined')
      }
    } catch (error) {
      console.error('Error declining connection:', error)
      toast.error('Failed to decline connection')
    }
  }

  const getTimeAgo = (dateString: string) => {
    // Fix hydration: don't calculate time on server
    if (!mounted) return ''
    
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return t('justNow')
    if (seconds < 3600) return t('minutesAgo', { count: Math.floor(seconds / 60) })
    if (seconds < 86400) return t('hoursAgo', { count: Math.floor(seconds / 3600) })
    if (seconds < 604800) return t('daysAgo', { count: Math.floor(seconds / 86400) })
    return date.toLocaleDateString()
  }

  // PERF: Memoize handlers to prevent unnecessary re-renders of notification items
  const handleSelectAll = useCallback(() => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set())
    } else {
      setSelectedNotifications(new Set(notifications.map(n => n.id)))
    }
  }, [selectedNotifications.size, notifications])

  const handleSelectNotification = useCallback((notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(notificationId)) {
        newSelected.delete(notificationId)
      } else {
        newSelected.add(notificationId)
      }
      return newSelected
    })
  }, [])

  const handleDeleteSelected = async () => {
    if (selectedNotifications.size === 0) return

    const confirmed = await showDanger(
      'Delete Notifications',
      `Are you sure you want to delete ${selectedNotifications.size} notification(s)?`,
      'Delete',
      'Cancel'
    )

    if (!confirmed) return

    try {
      const response = await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: Array.from(selectedNotifications) })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)))
        setSelectedNotifications(new Set())

        // Update unread count
        const remainingUnread = notifications.filter(
          n => !selectedNotifications.has(n.id) && !n.isRead
        ).length
        onUnreadCountChange(remainingUnread)
      } else {
        console.error('Delete failed:', data)
        toast.error(data.error || 'Failed to delete notifications')
      }
    } catch (error) {
      console.error('Error deleting notifications:', error)
      toast.error('Failed to delete notifications. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-16 right-4 w-96 max-h-[80vh] bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-100">Notifications</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700/50 rounded transition"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.length > 0 && selectedNotifications.size === notifications.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500/50"
                />
                <span className="text-sm text-slate-300">Select All</span>
              </label>
              {notifications.some(n => !n.isRead) && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-slate-400">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-slate-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm font-medium text-slate-300 mb-1">No system notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-700/30 transition ${
                    !notification.isRead ? 'bg-slate-700/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleSelectNotification(notification.id)
                      }}
                      className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500/50 mt-1 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-semibold text-slate-200">{notification.title}</h4>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{notification.message}</p>
                      <p className="text-xs text-slate-500">{getTimeAgo(notification.createdAt)}</p>

                      {/* Connection Request Actions */}
                      {notification.type === 'CONNECTION_REQUEST' && !notification.isRead && notification.relatedMatchId && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAcceptConnection(notification.relatedMatchId!, notification.id)
                            }}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeclineConnection(notification.relatedMatchId!, notification.id)
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-lg hover:bg-slate-600 transition"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {/* Other notification types - just mark as read on click */}
                      {notification.type !== 'CONNECTION_REQUEST' && !notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNotificationClick(notification)
                          }}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Delete Button */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-slate-700/50">
            <button
              onClick={handleDeleteSelected}
              disabled={selectedNotifications.size === 0}
              className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition ${
                selectedNotifications.size === 0
                  ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Delete Selected {selectedNotifications.size > 0 && `(${selectedNotifications.size})`}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
