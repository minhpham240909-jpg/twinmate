import { createAdminClient } from '@/lib/supabase/admin'
import type { ActivityAction } from '@/types/lead'

interface LogActivityParams {
  userId: string
  leadId: string | null
  action: ActivityAction
  senderName: string | null
  source: 'slack' | 'email'
  intentLabel: 'high' | 'medium' | 'low' | null
  dealTier: string | null
  replyPreview: string | null
}

/**
 * Logs an activity event. Fire-and-forget — failures are logged but never block the pipeline.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('activity_log').insert({
      user_id: params.userId,
      lead_id: params.leadId,
      action: params.action,
      sender_name: params.senderName,
      source: params.source,
      intent_label: params.intentLabel,
      deal_tier: params.dealTier,
      reply_preview: params.replyPreview?.substring(0, 200) || null,
    })
  } catch (err) {
    console.error('[activity] Failed to log activity:', err)
  }
}
