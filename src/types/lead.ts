export interface Lead {
  id: string
  user_id: string
  source: 'slack' | 'email'
  source_id: string | null
  source_channel: string | null
  source_channel_name: string | null
  sender_name: string | null
  sender_identifier: string | null
  raw_message: string
  thread_context: string | null
  intent_score: number | null
  intent_label: 'high' | 'medium' | 'low' | 'scoring_failed' | null
  summary_bullets: string[] | null
  suggested_reply: string | null
  model_used: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  ai_latency_ms: number | null
  confidence: number | null
  deal_tier: string | null
  scoring_reasons: string[] | null
  feedback: 'positive' | 'negative' | null
  feedback_at: string | null
  reply_sent: boolean
  reply_sent_at: string | null
  reminder_sent: boolean
  slack_thread_ts: string | null
  slack_channel_id: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  business_name: string | null
  niche: string | null
  tone: string
  booking_link: string | null
  custom_instructions: string | null
  auto_reply_enabled: boolean
  reply_from_name: string | null
  onboarding_completed: boolean
  onboarding_step: number
  stripe_customer_id: string | null
  subscription_status: string
  subscription_id: string | null
  trial_ends_at: string
  leads_used_this_month: number
  replies_sent_this_month: number
  plan_lead_limit: number
  created_at: string
  updated_at: string
}
