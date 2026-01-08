/**
 * Server-side Realtime Broadcast Functions
 * 
 * These functions are called from API routes to notify clients
 * of new messages in real-time using Supabase Broadcast.
 * 
 * Supabase Broadcast works immediately without needing table publications,
 * making it ideal for instant message delivery.
 */

import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Broadcast a new message to the appropriate channel
 * Called from the send message API after a message is created
 * 
 * @param messageId - The ID of the newly created message
 * @param senderId - The ID of the sender
 * @param conversationType - 'group' or 'partner'
 * @param conversationId - The group ID or partner ID
 */
export async function broadcastNewMessage(
  messageId: string,
  senderId: string,
  conversationType: 'group' | 'partner',
  conversationId: string
): Promise<void> {
  try {
    const supabase = await createServerClient()
    
    if (conversationType === 'group') {
      // Broadcast to group channel
      const channelName = `group:${conversationId}`
      
      await supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          messageId,
          senderId,
          groupId: conversationId
        }
      })
      
      console.log(`📡 [Broadcast] Group message sent: ${messageId} to ${channelName}`)
      
    } else if (conversationType === 'partner') {
      // Broadcast to DM channel
      const sortedIds = [senderId, conversationId].sort()
      const channelName = `dm:${sortedIds[0]}-${sortedIds[1]}`
      
      await supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          messageId,
          senderId,
          recipientId: conversationId
        }
      })
      
      console.log(`📡 [Broadcast] DM message sent: ${messageId} to ${channelName}`)
    }
  } catch (error) {
    // Log but don't throw - broadcast failure shouldn't prevent message from being sent
    console.error('[Broadcast] Failed to broadcast message:', error)
  }
}

/**
 * Broadcast a message read event
 * Called when a user marks messages as read
 */
export async function broadcastMessageRead(
  userId: string,
  conversationType: 'group' | 'partner',
  conversationId: string
): Promise<void> {
  try {
    const supabase = await createServerClient()
    
    if (conversationType === 'partner') {
      const sortedIds = [userId, conversationId].sort()
      const channelName = `dm:${sortedIds[0]}-${sortedIds[1]}`
      
      await supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'messages_read',
        payload: {
          readerId: userId,
          partnerId: conversationId
        }
      })
    }
    // Group read receipts can be added here if needed
  } catch (error) {
    console.error('[Broadcast] Failed to broadcast read receipt:', error)
  }
}

