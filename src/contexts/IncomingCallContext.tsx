'use client'

/**
 * IncomingCallContext - Real-time incoming call notification system
 *
 * This context provides Facebook/WhatsApp-like incoming call notifications:
 * - Uses Supabase Realtime for instant notifications (no polling)
 * - Works globally across the entire app
 * - Supports both Partner and Group calls
 * - Handles call lifecycle (accept, decline, timeout, cancel)
 * - Optimized for scale with efficient subscriptions
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Types for incoming call data
export interface IncomingCall {
  notificationId: string
  callerId: string
  callerName: string
  callerAvatar?: string
  conversationId: string
  conversationType: 'partner' | 'group'
  callType: 'AUDIO' | 'VIDEO'
  isGroupCall: boolean
  groupName?: string
  messageId?: string // Call message ID for status updates
  startedAt: number // Timestamp when call started
}

interface IncomingCallContextType {
  incomingCall: IncomingCall | null
  isRinging: boolean
  acceptCall: () => Promise<void>
  declineCall: () => Promise<void>
  dismissCall: () => void
}

const IncomingCallContext = createContext<IncomingCallContextType | undefined>(undefined)

// Call timeout in milliseconds (30 seconds)
const CALL_TIMEOUT_MS = 30000

export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [isRinging, setIsRinging] = useState(false)

  // Refs for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabaseRef = useRef(createClient())

  // Clear timeout
  const clearCallTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Dismiss call (used for timeout or cancel)
  const dismissCall = useCallback(() => {
    clearCallTimeout()
    setIsRinging(false)
    setIncomingCall(null)
  }, [clearCallTimeout])

  // Accept call handler
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return

    clearCallTimeout()
    setIsRinging(false)

    try {
      // Mark notification as read
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: incomingCall.notificationId })
      })

      // Update call status to indicate it was answered
      if (incomingCall.messageId) {
        await fetch('/api/messages/call/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: incomingCall.messageId,
            action: 'accept'
          })
        }).catch(err => console.error('Failed to update call status:', err))
      }

      // Navigate to the call - let the component handle this via the returned call data
    } catch (error) {
      console.error('Error accepting call:', error)
    }

    // Clear call state after accepting
    setIncomingCall(null)
  }, [incomingCall, clearCallTimeout])

  // Decline call handler
  const declineCall = useCallback(async () => {
    if (!incomingCall) return

    clearCallTimeout()
    setIsRinging(false)

    try {
      // Mark notification as read
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: incomingCall.notificationId })
      })

      // Update call status to indicate it was declined
      if (incomingCall.messageId) {
        await fetch('/api/messages/call/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: incomingCall.messageId,
            action: 'decline'
          })
        }).catch(err => console.error('Failed to update call status:', err))
      }
    } catch (error) {
      console.error('Error declining call:', error)
    }

    setIncomingCall(null)
  }, [incomingCall, clearCallTimeout])

  // Set up Supabase Realtime subscription
  useEffect(() => {
    if (!user?.id) return

    const supabase = supabaseRef.current

    // Subscribe to Notification table changes for this user
    // Using a unique channel name per user to avoid conflicts
    const channel = supabase
      .channel(`incoming-calls:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Notification',
          filter: `userId=eq.${user.id}`
        },
        async (payload) => {
          const notification = payload.new as any

          // Only handle INCOMING_CALL notifications
          if (notification.type !== 'INCOMING_CALL') return

          // Parse metadata from the notification
          // The call API stores caller info in metadata JSON field
          try {
            const metadata = notification.metadata || {}

            // If metadata has caller info, use it directly (optimized - no extra API call)
            // Otherwise fall back to fetching from API
            let callerName = metadata.callerName
            let callerAvatar = metadata.callerAvatar
            let callType = metadata.callType || 'VIDEO'
            let messageId = metadata.messageId
            let groupName = metadata.groupName
            let isGroupCall = metadata.isGroupCall || false

            // If no metadata (old notification format), fetch details
            if (!callerName && notification.relatedUserId) {
              try {
                const response = await fetch(`/api/notifications/${notification.id}`)
                if (response.ok) {
                  const data = await response.json()
                  const notificationDetails = data.notification
                  callerName = notificationDetails.relatedUser?.name || 'Unknown'
                  callerAvatar = notificationDetails.relatedUser?.avatarUrl
                  callType = notificationDetails.metadata?.callType || 'VIDEO'
                  messageId = notificationDetails.metadata?.messageId
                  groupName = notificationDetails.metadata?.groupName
                  isGroupCall = notificationDetails.metadata?.isGroupCall || false
                }
              } catch (err) {
                console.error('Failed to fetch notification details:', err)
                callerName = 'Unknown Caller'
              }
            }

            // Extract call information
            const callData: IncomingCall = {
              notificationId: notification.id,
              callerId: notification.relatedUserId || '',
              callerName: callerName || 'Unknown',
              callerAvatar: callerAvatar,
              conversationId: extractConversationId(notification.actionUrl),
              conversationType: extractConversationType(notification.actionUrl),
              callType: callType,
              isGroupCall: isGroupCall || extractConversationType(notification.actionUrl) === 'group',
              groupName: groupName,
              messageId: messageId,
              startedAt: Date.now()
            }

            // Set incoming call
            setIncomingCall(callData)
            setIsRinging(true)

            // Set timeout to auto-dismiss after 30 seconds
            clearCallTimeout()
            timeoutRef.current = setTimeout(() => {
              dismissCall()
              // Mark as missed
              fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: notification.id })
              }).catch(console.error)
            }, CALL_TIMEOUT_MS)

          } catch (error) {
            console.error('Error processing incoming call notification:', error)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Notification',
          filter: `userId=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as any

          // If the current incoming call notification was read/cancelled, dismiss it
          if (
            incomingCall?.notificationId === notification.id &&
            notification.isRead
          ) {
            dismissCall()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[IncomingCall] Realtime subscription active')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[IncomingCall] Realtime subscription error')
        }
      })

    channelRef.current = channel

    // Cleanup subscription on unmount
    return () => {
      clearCallTimeout()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id, dismissCall, clearCallTimeout, incomingCall?.notificationId])

  // Also listen for call cancellation via a separate channel
  useEffect(() => {
    if (!user?.id || !incomingCall?.messageId) return

    const supabase = supabaseRef.current

    // Subscribe to Message table changes to detect call cancellation
    const cancelChannel = supabase
      .channel(`call-cancel:${incomingCall.messageId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Message',
          filter: `id=eq.${incomingCall.messageId}`
        },
        (payload) => {
          const message = payload.new as any

          // If call was cancelled or ended by caller, dismiss
          if (
            message.callStatus === 'CANCELLED' ||
            message.callStatus === 'COMPLETED' ||
            message.callStatus === 'MISSED'
          ) {
            dismissCall()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(cancelChannel)
    }
  }, [user?.id, incomingCall?.messageId, dismissCall])

  const value: IncomingCallContextType = {
    incomingCall,
    isRinging,
    acceptCall,
    declineCall,
    dismissCall
  }

  return (
    <IncomingCallContext.Provider value={value}>
      {children}
    </IncomingCallContext.Provider>
  )
}

// Hook to use incoming call context
export function useIncomingCall() {
  const context = useContext(IncomingCallContext)
  if (context === undefined) {
    throw new Error('useIncomingCall must be used within an IncomingCallProvider')
  }
  return context
}

// Helper functions to parse actionUrl
function extractConversationId(actionUrl: string | null): string {
  if (!actionUrl) return ''
  const match = actionUrl.match(/conversation=([^&]+)/)
  return match ? match[1] : ''
}

function extractConversationType(actionUrl: string | null): 'partner' | 'group' {
  if (!actionUrl) return 'partner'
  const match = actionUrl.match(/type=([^&]+)/)
  return match && match[1] === 'group' ? 'group' : 'partner'
}
