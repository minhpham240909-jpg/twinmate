/**
 * Send Nudge Tool - Send in-app notification/nudge to another user
 */

import {
  Tool,
  SendNudgeInputSchema,
  SendNudgeOutputSchema,
  SendNudgeInput,
  SendNudgeOutput,
  AgentContext,
} from '../types'
import { SupabaseClient } from '@supabase/supabase-js'

export function createSendNudgeTool(supabase: SupabaseClient): Tool<SendNudgeInput, SendNudgeOutput> {
  return {
    name: 'sendNudge',
    description: 'Send an in-app notification or study invitation nudge to another user. Used for collaboration prompts.',
    category: 'collaboration',
    inputSchema: SendNudgeInputSchema,
    outputSchema: SendNudgeOutputSchema,
    estimatedLatencyMs: 300,

    async call(input: SendNudgeInput, ctx: AgentContext): Promise<SendNudgeOutput> {
      const { toUserId, message, nudgeType, metadata } = input

      // Validate target user exists and is not self
      if (toUserId === ctx.userId) {
        throw new Error('Cannot send nudge to yourself')
      }

      // Check if target user exists
      const { data: targetUser, error: userError } = await supabase
        .from('profile')
        .select('user_id')
        .eq('user_id', toUserId)
        .single()

      if (userError || !targetUser) {
        throw new Error('Target user not found')
      }

      // Create notification record
      // Note: This assumes a 'notification' table exists. If not, we'd create it in migrations.
      // For now, we'll use agent_memory as a temporary store for notifications
      const nudgeRecord = {
        user_id: toUserId, // Recipient
        scope: 'notification',
        key: `nudge_${Date.now()}`,
        value: {
          type: nudgeType,
          fromUserId: ctx.userId,
          message,
          metadata: metadata || {},
          sentAt: new Date().toISOString(),
          read: false,
        },
        expires_at: null, // Notifications don't expire
      }

      const { data, error } = await supabase
        .from('agent_memory')
        .insert(nudgeRecord)
        .select('id')
        .single()

      if (error) {
        throw new Error(`Failed to send nudge: ${error.message}`)
      }

      // Optionally trigger real-time notification via Supabase Realtime
      // This would be handled by a separate channel subscription in the frontend

      return {
        success: true,
        nudgeId: data.id,
        sentAt: new Date().toISOString(),
      }
    },
  }
}
