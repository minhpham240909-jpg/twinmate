import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS } from '@/lib/stripe/plans'

export async function canProcessLead(userId: string): Promise<{
  allowed: boolean
  reason?: string
  warning?: string
  usage?: { used: number; limit: number; percentage: number }
}> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, leads_used_this_month, plan_lead_limit')
    .eq('id', userId)
    .single()

  if (!profile) return { allowed: false, reason: 'User not found' }

  // Check trial expiration
  if (profile.subscription_status === 'trialing') {
    if (profile.trial_ends_at && new Date(profile.trial_ends_at) < new Date()) {
      return { allowed: false, reason: 'Your free trial has ended. Upgrade to keep scoring leads.' }
    }
  }

  // Check subscription status
  if (!['active', 'trialing'].includes(profile.subscription_status)) {
    return { allowed: false, reason: 'Subscription inactive. Upgrade to continue.' }
  }

  const used = profile.leads_used_this_month
  const limit = profile.plan_lead_limit
  if (!limit || limit <= 0) {
    return { allowed: false, reason: 'Plan configuration error. Please contact support.' }
  }
  const percentage = Math.round((used / limit) * 100)
  const usage = { used, limit, percentage }

  // Hard limit — stop processing
  if (used >= limit) {
    return {
      allowed: false,
      reason: `You've used all ${limit} leads this month. Resets next month or upgrade for more.`,
      usage,
    }
  }

  // Soft warning at 80%
  let warning: string | undefined
  if (percentage >= 80) {
    const remaining = limit - used
    warning = `You've used ${used} of ${limit} leads this month (${remaining} remaining).`
  }

  return { allowed: true, warning, usage }
}

export async function canSendReply(userId: string): Promise<{
  allowed: boolean
  reason?: string
  usage?: { used: number; limit: number }
}> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, replies_sent_this_month')
    .eq('id', userId)
    .single()

  if (!profile) return { allowed: false, reason: 'User not found' }

  // Check trial expiration
  if (profile.subscription_status === 'trialing') {
    if (profile.trial_ends_at && new Date(profile.trial_ends_at) < new Date()) {
      return { allowed: false, reason: 'Your free trial has ended. Upgrade to send replies.' }
    }
  }

  // Check subscription status
  if (!['active', 'trialing'].includes(profile.subscription_status)) {
    return { allowed: false, reason: 'Subscription inactive. Upgrade to continue.' }
  }

  const isPro = profile.subscription_status === 'active'
  const limit = isPro ? PLANS.PRO.replyLimit : PLANS.FREE_TRIAL.replyLimit
  const used = profile.replies_sent_this_month ?? 0

  if (used >= limit) {
    return {
      allowed: false,
      reason: isPro
        ? "You've reached the reply limit this month."
        : `You've used all ${limit} free replies. Upgrade to Pro for unlimited replies.`,
      usage: { used, limit },
    }
  }

  return { allowed: true, usage: { used, limit } }
}
