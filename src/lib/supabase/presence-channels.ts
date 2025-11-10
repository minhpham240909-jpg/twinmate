import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Presence status type
export type PresenceStatus = 'online' | 'away' | 'offline'

// Presence state shape
export interface PresenceState {
  userId: string
  status: PresenceStatus
  lastSeenAt: string
  isPrivate: boolean
}

// Typing indicator state
export interface TypingState {
  userId: string
  userName: string
  isTyping: boolean
}

// Create typing indicator channel for a conversation
export function createTypingChannel(conversationId: string): RealtimeChannel {
  const supabase = createClient()

  return supabase.channel(`typing:${conversationId}`, {
    config: {
      broadcast: {
        self: false, // Don't receive own typing events
      },
    },
  })
}

// Broadcast typing status
export async function broadcastTyping(
  channel: RealtimeChannel,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      userId,
      userName,
      isTyping,
    },
  })
}

// Subscribe to typing indicators
export function subscribeToTyping(
  channel: RealtimeChannel,
  onTypingChange: (state: TypingState) => void
): void {
  channel
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      onTypingChange(payload as TypingState)
    })
    .subscribe()
}

// Cleanup function
export async function cleanupChannels(channels: RealtimeChannel[]): Promise<void> {
  const supabase = createClient()

  for (const channel of channels) {
    await supabase.removeChannel(channel)
  }
}
