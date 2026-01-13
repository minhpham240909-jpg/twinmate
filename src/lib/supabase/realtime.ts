'use client'

// Supabase Realtime Utilities for Live Updates
import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from './client'
import { RealtimeConnection, ConnectionStatus } from './realtime-client'
import { 
  checkRealtimeRateLimit, 
  RealtimeRateLimitPresets,
  createTypingIndicatorSender 
} from './realtime-rate-limit'

export type MessageHandler<T = Record<string, unknown>> = (payload: T) => void
export type ConnectionStatusCallback = (status: ConnectionStatus) => void
export type { ConnectionStatus } from './realtime-client'

/**
 * Subscribe to real-time messages in a group channel
 * Uses dual strategy: Supabase Broadcast (instant) + postgres_changes (backup)
 * 
 * IMPORTANT: For postgres_changes to work, run the migration:
 * supabase/migrations/20250107_enable_realtime_messages.sql
 *
 * @param channelName - Unique channel identifier (format: "group:groupId")
 * @param onMessage - Callback when new message arrives (receives complete message with sender)
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

  let isCleanedUp = false
  const processedMessageIds = new Set<string>() // Prevent duplicates

  // Fetch complete message with sender info
  const fetchCompleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/by-id/${messageId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.message) {
          return data.message
        }
      }
      return null
    } catch (error) {
      console.error('[Group Realtime] Error fetching message:', error)
      return null
    }
  }

  // Handle incoming message (from either broadcast or postgres_changes)
  const handleNewMessage = async (messageId: string, source: string) => {
    if (isCleanedUp) return
    
    // Prevent duplicate processing
    if (processedMessageIds.has(messageId)) {
      console.log(`⏭️ [Group Realtime] Skipping duplicate: ${messageId}`)
      return
    }
    processedMessageIds.add(messageId)
    
    // Limit set size to prevent memory leak
    if (processedMessageIds.size > 100) {
      const oldestId = processedMessageIds.values().next().value
      if (oldestId) processedMessageIds.delete(oldestId)
    }

    console.log(`📨 [Group Realtime] Processing message from ${source}: ${messageId}`)
    const completeMessage = await fetchCompleteMessage(messageId)
    if (completeMessage && !isCleanedUp) {
      console.log(`✅ [Group Realtime] Delivering to UI: ${completeMessage.content?.substring(0, 50)}`)
      onMessage(completeMessage)
    }
  }

  const channel = supabase
    .channel(channelName, {
      config: { broadcast: { self: false } }
    })
    // PRIMARY: Listen for broadcast events (instant, no table publication needed)
    .on('broadcast', { event: 'new_message' }, async (payload) => {
      if (isCleanedUp) return
      const { messageId } = payload.payload as { messageId: string }
      if (messageId) {
        await handleNewMessage(messageId, 'broadcast')
      }
    })
    // BACKUP: Listen for postgres_changes (requires table in publication)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Message',
        filter: `groupId=eq.${groupId}`,
      },
      async (payload) => {
        if (isCleanedUp) return
        const rawMessage = payload.new as Record<string, unknown>
        await handleNewMessage(rawMessage.id as string, 'postgres_changes')
      }
    )
    .subscribe((status) => {
      if (isCleanedUp) return

      if (status === 'SUBSCRIBED') {
        console.log(`✅ Group channel subscribed: ${groupId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Group channel error: ${groupId}`)
      }
    })

  // Return cleanup function
  return () => {
    isCleanedUp = true
    processedMessageIds.clear()
    supabase.removeChannel(channel)
  }
}

/**
 * Broadcast a new message to a group channel
 * Called by the sender to notify other group members instantly
 */
export function broadcastGroupMessage(groupId: string, messageId: string): void {
  const supabase = createClient()
  const channelName = `group:${groupId}`
  
  // Send broadcast event (fire and forget)
  supabase.channel(channelName).send({
    type: 'broadcast',
    event: 'new_message',
    payload: { messageId, groupId }
  }).catch(err => console.error('[Group Broadcast] Failed:', err))
}

/**
 * Subscribe to DM (Direct Messages) between two users
 * Uses dual strategy: Supabase Broadcast (instant) + postgres_changes (backup)
 *
 * IMPORTANT: For postgres_changes to work, run the migration:
 * supabase/migrations/20250107_enable_realtime_messages.sql
 */
export function subscribeToDM(
  myUserId: string,
  partnerId: string,
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

  // Use a consistent channel name (sorted IDs to ensure uniqueness)
  const sortedIds = [myUserId, partnerId].sort()
  const channelName = `dm:${sortedIds[0]}-${sortedIds[1]}`
  let channel: RealtimeChannel | null = null
  let isCleanedUp = false
  const processedMessageIds = new Set<string>() // Prevent duplicates

  // Fetch complete message with sender info
  const fetchCompleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/by-id/${messageId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.message) {
          return data.message
        }
      }
      return null
    } catch (error) {
      console.error('[DM Realtime] Error fetching message:', error)
      return null
    }
  }

  // Handle incoming message (from either broadcast or postgres_changes)
  const handleNewMessage = async (messageId: string, senderId: string, source: string) => {
    if (isCleanedUp) return
    
    // Only process messages from our partner
    if (senderId !== partnerId && senderId !== myUserId) {
      console.log(`⏭️ [DM Realtime] Skipping - not from current conversation`)
      return
    }
    
    // Prevent duplicate processing
    if (processedMessageIds.has(messageId)) {
      console.log(`⏭️ [DM Realtime] Skipping duplicate: ${messageId}`)
      return
    }
    processedMessageIds.add(messageId)
    
    // Limit set size to prevent memory leak
    if (processedMessageIds.size > 100) {
      const oldestId = processedMessageIds.values().next().value
      if (oldestId) processedMessageIds.delete(oldestId)
    }

    console.log(`📨 [DM Realtime] Processing message from ${source}: ${messageId}`)
    const completeMessage = await fetchCompleteMessage(messageId)
    if (completeMessage && !isCleanedUp) {
      console.log(`✅ [DM Realtime] Delivering to UI: ${completeMessage.content?.substring(0, 50)}`)
      onMessage(completeMessage)
    }
  }

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
      // PRIMARY: Listen for broadcast events (instant, no table publication needed)
      .on('broadcast', { event: 'new_message' }, async (payload) => {
        if (isCleanedUp) return
        const { messageId, senderId } = payload.payload as { messageId: string; senderId: string }
        if (messageId && senderId) {
          await handleNewMessage(messageId, senderId, 'broadcast')
        }
      })
      // BACKUP: Listen for messages where I am the RECIPIENT
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `recipientId=eq.${myUserId}`,
        },
        async (payload) => {
          if (isCleanedUp) return
          const rawMessage = payload.new as Record<string, unknown>
          
          // Only process if it's a DM (no groupId)
          if (rawMessage.groupId !== null) return
          
          await handleNewMessage(
            rawMessage.id as string,
            rawMessage.senderId as string,
            'postgres_changes'
          )
        }
      )
      // BACKUP: Also listen for messages I SEND (for multi-device sync)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `senderId=eq.${myUserId}`,
        },
        async (payload) => {
          if (isCleanedUp) return
          const rawMessage = payload.new as Record<string, unknown>

          // Only process DMs to our partner
          if (rawMessage.recipientId !== partnerId || rawMessage.groupId !== null) return

          await handleNewMessage(
            rawMessage.id as string,
            rawMessage.senderId as string,
            'postgres_changes_self'
          )
        }
      )
      .subscribe((status, err) => {
        if (isCleanedUp) return

        if (status === 'SUBSCRIBED') {
          console.log(`✅ DM channel subscribed: ${myUserId} <-> ${partnerId}`)
          if (onStatusChange) onStatusChange('connected')
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ DM channel error: ${myUserId} <-> ${partnerId}`, err)
          if (onStatusChange) onStatusChange('error')
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏱️ DM channel timeout: ${myUserId} <-> ${partnerId}`)
          if (onStatusChange) onStatusChange('disconnected')
        } else if (status === 'CLOSED') {
          console.warn(`🔒 DM channel closed: ${myUserId} <-> ${partnerId}`)
          if (onStatusChange) onStatusChange('disconnected')
        }
      })
  }

  // Initial setup
  setupChannel()

  // Return cleanup function
  return () => {
    isCleanedUp = true
    processedMessageIds.clear()
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    realtimeConnection.cleanup()
  }
}

/**
 * Broadcast a new DM message to the conversation channel
 * Called by the sender to notify the recipient instantly
 */
export function broadcastDMMessage(senderId: string, recipientId: string, messageId: string): void {
  const supabase = createClient()
  const sortedIds = [senderId, recipientId].sort()
  const channelName = `dm:${sortedIds[0]}-${sortedIds[1]}`
  
  // Send broadcast event (fire and forget)
  supabase.channel(channelName).send({
    type: 'broadcast',
    event: 'new_message',
    payload: { messageId, senderId, recipientId }
  }).catch(err => console.error('[DM Broadcast] Failed:', err))
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
 * Subscribe to notifications with error handling and retry logic
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: MessageHandler,
  onError?: (error: string) => void
): () => void {
  const supabase = createClient()
  let retryCount = 0
  const maxRetries = 3
  let currentChannel: RealtimeChannel | null = null
  let isCleanedUp = false
  let retryTimeout: NodeJS.Timeout | null = null

  const setupChannel = () => {
    // Don't setup if already cleaned up
    if (isCleanedUp) return

    // Clean up existing channel before creating new one
    if (currentChannel) {
      supabase.removeChannel(currentChannel)
      currentChannel = null
    }

    currentChannel = supabase
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
          if (!isCleanedUp) {
            onNotification(payload.new)
          }
        }
      )
      .subscribe((status) => {
        if (isCleanedUp) return

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Notifications channel subscribed for user: ${userId}`)
          retryCount = 0 // Reset retry count on success
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Notifications channel error for user: ${userId}`)
          if (retryCount < maxRetries) {
            retryCount++
            console.log(`🔄 Retrying notification subscription (${retryCount}/${maxRetries})...`)
            retryTimeout = setTimeout(() => {
              setupChannel()
            }, 2000 * retryCount)
          } else {
            onError?.('Failed to connect to notifications after multiple attempts')
          }
        } else if (status === 'TIMED_OUT') {
          console.error(`⏱️ Notifications channel timed out for user: ${userId}`)
          onError?.('Notification connection timed out')
        } else if (status === 'CLOSED') {
          console.log(`🔒 Notifications channel closed for user: ${userId}`)
        }
      })
  }

  // Initial setup
  setupChannel()

  // Return cleanup function that handles all retries
  return () => {
    isCleanedUp = true
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (currentChannel) {
      supabase.removeChannel(currentChannel)
      currentChannel = null
    }
  }
}

/**
 * Typing indicator types and functions
 */
export interface TypingUser {
  id: string
  name: string
  avatarUrl?: string | null
}

export type TypingCallback = (typingUsers: TypingUser[]) => void

/**
 * Subscribe to typing indicators in a DM conversation
 * Uses Supabase Broadcast for real-time ephemeral events
 * FIX: Added rate limiting to prevent abuse
 */
export function subscribeToTypingDM(
  myUserId: string,
  partnerId: string,
  onTypingChange: TypingCallback
): { cleanup: () => void; sendTyping: (isTyping: boolean, user: TypingUser) => void } {
  const supabase = createClient()
  const channelName = `typing:dm:${[myUserId, partnerId].sort().join('-')}`

  const typingUsers = new Map<string, { user: TypingUser; timeout: NodeJS.Timeout }>()

  const updateTypingState = () => {
    onTypingChange(Array.from(typingUsers.values()).map(v => v.user))
  }

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } }
  })

  channel
    .on('broadcast', { event: 'typing' }, (payload) => {
      const { userId, isTyping, user } = payload.payload as { userId: string; isTyping: boolean; user: TypingUser }

      // Ignore own typing events
      if (userId === myUserId) return

      // FIX: Rate limit incoming typing events to prevent spam
      if (!checkRealtimeRateLimit(`${channelName}:incoming`, 'typing', RealtimeRateLimitPresets.typing)) {
        return // Drop if rate limited
      }

      if (isTyping) {
        // Clear existing timeout for this user
        const existing = typingUsers.get(userId)
        if (existing) {
          clearTimeout(existing.timeout)
        }

        // Set timeout to auto-remove after 3 seconds of no typing
        const timeout = setTimeout(() => {
          typingUsers.delete(userId)
          updateTypingState()
        }, 3000)

        typingUsers.set(userId, { user, timeout })
        updateTypingState()
      } else {
        // User stopped typing
        const existing = typingUsers.get(userId)
        if (existing) {
          clearTimeout(existing.timeout)
          typingUsers.delete(userId)
          updateTypingState()
        }
      }
    })
    .subscribe()

  // FIX: Create rate-limited typing sender
  const typingIndicator = createTypingIndicatorSender(
    (isTyping) => {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: myUserId, isTyping, user: { id: myUserId, name: '' } }
      })
    },
    RealtimeRateLimitPresets.typing
  )

  // Function to broadcast typing state (with rate limiting)
  const sendTyping = (isTyping: boolean, user: TypingUser) => {
    // FIX: Apply rate limiting to outgoing typing events
    if (!checkRealtimeRateLimit(channelName, 'typing', RealtimeRateLimitPresets.typing)) {
      return // Drop if rate limited
    }
    
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: myUserId, isTyping, user }
    })
  }

  // Cleanup function
  const cleanup = () => {
    // Clear all timeouts
    typingUsers.forEach(({ timeout }) => clearTimeout(timeout))
    typingUsers.clear()
    typingIndicator.cleanup()
    supabase.removeChannel(channel)
  }

  return { cleanup, sendTyping }
}

/**
 * Subscribe to typing indicators in a group conversation
 * Uses Supabase Broadcast for real-time ephemeral events
 * FIX: Added rate limiting to prevent abuse
 */
export function subscribeToTypingGroup(
  myUserId: string,
  groupId: string,
  onTypingChange: TypingCallback
): { cleanup: () => void; sendTyping: (isTyping: boolean, user: TypingUser) => void } {
  const supabase = createClient()
  const channelName = `typing:group:${groupId}`

  const typingUsers = new Map<string, { user: TypingUser; timeout: NodeJS.Timeout }>()

  const updateTypingState = () => {
    onTypingChange(Array.from(typingUsers.values()).map(v => v.user))
  }

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } }
  })

  channel
    .on('broadcast', { event: 'typing' }, (payload) => {
      const { userId, isTyping, user } = payload.payload as { userId: string; isTyping: boolean; user: TypingUser }

      // Ignore own typing events
      if (userId === myUserId) return

      // FIX: Rate limit incoming typing events to prevent spam
      if (!checkRealtimeRateLimit(`${channelName}:incoming`, 'typing', RealtimeRateLimitPresets.typing)) {
        return // Drop if rate limited
      }

      if (isTyping) {
        // Clear existing timeout for this user
        const existing = typingUsers.get(userId)
        if (existing) {
          clearTimeout(existing.timeout)
        }

        // Set timeout to auto-remove after 3 seconds of no typing
        const timeout = setTimeout(() => {
          typingUsers.delete(userId)
          updateTypingState()
        }, 3000)

        typingUsers.set(userId, { user, timeout })
        updateTypingState()
      } else {
        // User stopped typing
        const existing = typingUsers.get(userId)
        if (existing) {
          clearTimeout(existing.timeout)
          typingUsers.delete(userId)
          updateTypingState()
        }
      }
    })
    .subscribe()

  // Function to broadcast typing state (with rate limiting)
  const sendTyping = (isTyping: boolean, user: TypingUser) => {
    // FIX: Apply rate limiting to outgoing typing events
    if (!checkRealtimeRateLimit(channelName, 'typing', RealtimeRateLimitPresets.typing)) {
      return // Drop if rate limited
    }
    
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: myUserId, isTyping, user }
    })
  }

  // Cleanup function
  const cleanup = () => {
    // Clear all timeouts
    typingUsers.forEach(({ timeout }) => clearTimeout(timeout))
    typingUsers.clear()
    supabase.removeChannel(channel)
  }

  return { cleanup, sendTyping }
}

/**
 * Broadcast presence (online/offline status) to a channel
 * Returns a cleanup function to properly unsubscribe
 */
export function broadcastPresence(
  channelName: string,
  userData: { userId: string; name: string; status: string }
): () => void {
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

  // PERF: Return cleanup function to prevent subscription leaks
  return () => {
    supabase.removeChannel(channel)
  }
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
 * Subscribe to study session invites for real-time updates
 * Triggers callback when user receives new session invitations
 * This ensures the invites list updates without requiring page refresh
 */
export function subscribeToSessionInvites(
  userId: string,
  onNewInvite: () => void,
  onInviteUpdate?: () => void
): () => void {
  const supabase = createClient()
  let isCleanedUp = false

  const channel = supabase
    .channel(`session-invites:${userId}`)
    // Listen for new invitations (INSERT)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'SessionParticipant',
        filter: `userId=eq.${userId}`,
      },
      (payload) => {
        if (isCleanedUp) return
        const newRecord = payload.new as { status?: string }
        // Only trigger for INVITED status (new invitations)
        if (newRecord.status === 'INVITED') {
          console.log(`📨 [Session Invites] New invitation received for user: ${userId}`)
          onNewInvite()
        }
      }
    )
    // Listen for invitation status changes (UPDATE - e.g., INVITED -> JOINED)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'SessionParticipant',
        filter: `userId=eq.${userId}`,
      },
      () => {
        if (isCleanedUp) return
        console.log(`🔄 [Session Invites] Invitation updated for user: ${userId}`)
        onInviteUpdate?.()
      }
    )
    // Listen for invitation removals (DELETE)
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'SessionParticipant',
        filter: `userId=eq.${userId}`,
      },
      () => {
        if (isCleanedUp) return
        console.log(`🗑️ [Session Invites] Invitation removed for user: ${userId}`)
        onInviteUpdate?.()
      }
    )
    .subscribe((status) => {
      if (isCleanedUp) return

      if (status === 'SUBSCRIBED') {
        console.log(`✅ Session invites channel subscribed for user: ${userId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Session invites channel error for user: ${userId}`)
      }
    })

  return () => {
    isCleanedUp = true
    supabase.removeChannel(channel)
  }
}

/**
 * H6 FIX: Subscribe to new messages for unread count updates
 * Listens to DM messages where user is the recipient and group messages
 * Includes polling fallback for reliability during brief disconnections
 */
export function subscribeToUnreadMessages(
  userId: string,
  onNewMessage: () => void,
  groupIds?: string[],
  options?: {
    pollingIntervalMs?: number  // Default: 30000 (30 seconds)
    enablePollingFallback?: boolean  // Default: true
  }
): () => void {
  const supabase = createClient()
  const { pollingIntervalMs = 30000, enablePollingFallback = true } = options || {}
  
  let isCleanedUp = false
  let pollingInterval: NodeJS.Timeout | null = null
  let realtimeConnected = false
  let lastPolledAt = Date.now()

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
        if (!isCleanedUp) onNewMessage()
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
        if (!isCleanedUp) onNewMessage()
      }
    )
    .subscribe((status) => {
      if (isCleanedUp) return
      
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Unread messages channel subscribed for user: ${userId}`)
        realtimeConnected = true
        
        // H6 FIX: Reconcile unread counts on reconnection
        onNewMessage()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error(`❌ Unread messages channel issue for user: ${userId}`, status)
        realtimeConnected = false
      }
    })

  // Subscribe to group messages if groupIds provided
  let groupChannel: ReturnType<typeof supabase.channel> | null = null
  if (groupIds && groupIds.length > 0) {
    // PERFORMANCE: Use database filter to reduce traffic
    // Supabase supports 'in' filter for up to ~20 values efficiently
    const useDbFilter = groupIds.length <= 20
    const filterConfig: {
      event: 'INSERT'
      schema: 'public'
      table: 'Message'
      filter?: string
    } = {
      event: 'INSERT',
      schema: 'public',
      table: 'Message',
    }

    // Add database-level filter if we have few enough groups
    if (useDbFilter) {
      filterConfig.filter = `groupId=in.(${groupIds.join(',')})`
    }

    groupChannel = supabase
      .channel(`unread-groups:${userId}`)
      .on(
        'postgres_changes',
        filterConfig,
        (payload) => {
          if (isCleanedUp) return
          
          const message = payload.new as { groupId?: string; senderId?: string }

          // Skip messages from self
          if (message.senderId === userId) return

          // If using DB filter, message is already from user's groups
          // If not using DB filter (>20 groups), check in JS
          if (useDbFilter || (message.groupId && groupIds.includes(message.groupId))) {
            onNewMessage()
          }
        }
      )
      .subscribe((status) => {
        if (isCleanedUp) return
        
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Group unread messages channel subscribed for user: ${userId} (${groupIds.length} groups, DB filter: ${useDbFilter})`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Group unread messages channel error for user: ${userId}`)
        }
      })
  }

  // H6 FIX: Periodic polling fallback to reconcile unread counts
  // This catches messages missed during brief disconnections
  if (enablePollingFallback) {
    pollingInterval = setInterval(() => {
      if (isCleanedUp) return
      
      // Always poll to ensure accuracy, regardless of realtime status
      const now = Date.now()
      const timeSinceLastPoll = now - lastPolledAt
      
      // If realtime has been disconnected or it's been a while, trigger refresh
      if (!realtimeConnected || timeSinceLastPoll >= pollingIntervalMs) {
        lastPolledAt = now
        console.log(`[Unread Polling] Refreshing unread counts for user: ${userId}`)
        onNewMessage()
      }
    }, pollingIntervalMs)
  }

  return () => {
    isCleanedUp = true
    
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    
    supabase.removeChannel(channel)
    if (groupChannel) {
      supabase.removeChannel(groupChannel)
    }
  }
}

/**
 * Subscribe to Focus Session Participant changes
 * Listens for invitations, joins, and leaves in real-time
 * Enables instant updates when partners join/leave quick focus sessions
 */
export function subscribeToFocusSessionParticipants(
  focusSessionId: string,
  onParticipantChange: () => void
): () => void {
  const supabase = createClient()
  let isCleanedUp = false

  const channel = supabase
    .channel(`focus-session:${focusSessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'focus_session_participants',
        filter: `focusSessionId=eq.${focusSessionId}`,
      },
      (payload) => {
        if (isCleanedUp) return
        console.log('[Realtime] New focus session participant:', payload)
        onParticipantChange()
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'focus_session_participants',
        filter: `focusSessionId=eq.${focusSessionId}`,
      },
      (payload) => {
        if (isCleanedUp) return
        console.log('[Realtime] Focus session participant updated:', payload)
        onParticipantChange()
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'focus_session_participants',
        filter: `focusSessionId=eq.${focusSessionId}`,
      },
      (payload) => {
        if (isCleanedUp) return
        console.log('[Realtime] Focus session participant removed:', payload)
        onParticipantChange()
      }
    )
    .subscribe()

  return () => {
    isCleanedUp = true
    supabase.removeChannel(channel)
  }
}