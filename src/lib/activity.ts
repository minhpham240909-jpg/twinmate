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
 * Logs an activity event. Fire-and-forget with one retry — failures are logged but never block the pipeline.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const row = {
    user_id: params.userId,
    lead_id: params.leadId,
    action: params.action,
    sender_name: params.senderName,
    source: params.source,
    intent_label: params.intentLabel,
    deal_tier: params.dealTier,
    reply_preview: params.replyPreview?.substring(0, 200) || null,
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const supabase = createAdminClient()
      const { error } = await supabase.from('activity_log').insert(row)
      if (!error) return
      if (attempt === 2) {
        console.error('[activity] Failed to log activity after retry:', error)
        return
      }
    } catch (err) {
      if (attempt === 2) {
        console.error('[activity] Failed to log activity after retry:', err)
        return
      }
    }
    // Brief pause before retry
    await new Promise((r) => setTimeout(r, 300))
  }
}
