'use client'

// Supabase Realtime Utilities for Live Updates
import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from './client'
import { RealtimeConnection, ConnectionStatus } from './realtime-client'

export type MessageHandler<T = Record<string, unknown>> = (payload: T) => void
export type ConnectionStatusCallback = (status: ConnectionStatus) => void
export type { ConnectionStatus } from './realtime-client'

/**
 * Subscribe to real-time messages in a channel
 * @param channelName - Unique channel identifier (e.g., "chat:123" or "dm:user1-user2")
 * @param onMessage - Callback when new message arrives
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToMessages(
  channelName: string,
  onMessage: MessageHandler
): () => void {
  const supabase = createClient()

  // Extract groupId from channel name (format: "group:groupId")
  const groupId = channelName.split(':')[1]

  if (!groupId) {
    console.error('Invalid channel name format. Expected "group:groupId"')
    return () => {} // Return empty cleanup function
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Message',
        filter: `groupId=eq.${groupId}`,
      },
      (payload) => {
        onMessage(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Group channel subscribed: ${groupId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Group channel error: ${groupId}`)
      }
    })

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to DM (Direct Messages) between two users
 * Enhanced with automatic reconnection and error handling
 */
export function subscribeToDM(
  userId1: string,
  userId2: string,
  onMessage: MessageHandler,
  onStatusChange?: ConnectionStatusCallback
): () => void {
  const supabase = createClient()
  const realtimeConnection = new RealtimeConnection({
    maxRetries: 5,
    retryDelay: 2000,
    enableLogging: process.env.NODE_ENV === 'development',
  })

  // Subscribe to connection status changes
  if (onStatusChange) {
    realtimeConnection.onStatusChange(onStatusChange)
  }

  // Use a single channel with multiple event listeners
  const channelName = `dm:${userId1}-${userId2}`
  let channel: RealtimeChannel | null = null

  const setupChannel = () => {
    // Clean up existing channel
    if (channel) {
      supabase.removeChannel(channel)
    }

    channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          // Listen for messages FROM user1 TO user2
          filter: `senderId=eq.${userId1}`,
        },
        (payload) => {
          // Only process if recipientId matches
          const message = payload.new as Record<string, unknown>
          if (message.recipientId === userId2 && message.groupId === null) {
            onMessage(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          // Listen for messages FROM user2 TO user1
          filter: `senderId=eq.${userId2}`,
        },
        (payload) => {
          // Only process if recipientId matches
          const message = payload.new as Record<string, unknown>
          if (message.recipientId === userId1 && message.groupId === null) {
            onMessage(payload.new)
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ DM channel subscribed: ${userId1}-${userId2}`)
          if (onStatusChange) onStatusChange('connected')
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ DM channel error: ${userId1}-${userId2}`, err)
          if (onStatusChange) onStatusChange('error')
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏱️ DM channel timeout: ${userId1}-${userId2}`)
          if (onStatusChange) onStatusChange('disconnected')
        } else if (status === 'CLOSED') {
          console.warn(`🔒 DM channel closed: ${userId1}-${userId2}`)
          if (onStatusChange) onStatusChange('disconnected')
        }
      })
  }

  // Initial setup
  setupChannel()

  // Return cleanup function
  return () => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    realtimeConnection.cleanup()
  }
}

/**
 * Subscribe to profile updates (for online status, etc.)
 */
export function subscribeToProfile(
  userId: string,
  onUpdate: MessageHandler
): () => void {
  const supabase = createClient()

  const channel = supabase
    .channel(`profile:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Profile',
        filter: `userId=eq.${userId}`,
      },
      (payload) => {
        onUpdate(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to match requests
 */
export function subscribeToMatches(
  userId: string,
  onMatch: MessageHandler
): () => void {
  const supabase = createClient()

  const channel = supabase
    .channel(`matches:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'Match',
        filter: `receiverId=eq.${userId}`,
      },
      (payload) => {
        onMatch(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to notifications
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: MessageHandler
): () => void {
  const supabase = createClient()

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Notification',
        filter: `userId=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Broadcast presence (online/offline status) to a channel
 */
export function broadcastPresence(
  channelName: string,
  userData: { userId: string; name: string; status: string }
) {
  const supabase = createClient()

  const channel = supabase.channel(channelName, {
    config: {
      presence: {
        key: userData.userId,
      },
    },
  })

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(userData)
    }
  })

  return channel
}

/**
 * Listen to presence changes (who's online)
 */
export function subscribeToPresence(
  channelName: string,
  onPresenceChange: (presenceState: Record<string, unknown>) => void
): () => void {
  const supabase = createClient()

  const channel = supabase
    .channel(channelName)
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      onPresenceChange(state)
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key, newPresences)
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key, leftPresences)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to new messages for unread count updates
 * Listens to DM messages where user is the recipient
 */
export function subscribeToUnreadMessages(
  userId: string,
  onNewMessage: () => void
): () => void {
  const supabase = createClient()

  const channel = supabase
    .channel(`unread:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Message',
        filter: `recipientId=eq.${userId}`,
      },
      () => {
        // New DM received
        onNewMessage()
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Message',
        filter: `recipientId=eq.${userId}`,
      },
      () => {
        // DM marked as read/unread
        onNewMessage()
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Unread messages channel subscribed for user: ${userId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Unread messages channel error for user: ${userId}`)
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}