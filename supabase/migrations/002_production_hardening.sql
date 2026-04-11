-- =============================================
-- Clerva v1 — Production Hardening Migration
-- Missing indexes, columns, and functions for
-- concurrent multi-user load
-- =============================================

-- ===================
-- MISSING COLUMN
-- ===================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS replies_sent_this_month INTEGER DEFAULT 0;

-- ===================
-- MISSING FUNCTION: increment_replies_sent
-- (atomic SQL increment — safe under concurrent calls)
-- ===================
CREATE OR REPLACE FUNCTION public.increment_replies_sent(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET replies_sent_this_month = replies_sent_this_month + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ===================
-- UPDATE monthly reset to also clear replies counter
-- ===================
CREATE OR REPLACE FUNCTION public.reset_monthly_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET leads_used_this_month = 0,
      replies_sent_this_month = 0,
      updated_at = NOW()
  WHERE subscription_status IN ('active', 'trialing');
END;
$$;

-- ===================
-- MISSING INDEXES
-- ===================

-- slack_installations: looked up by team_id in Slack event processing
CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id
  ON public.slack_installations(team_id);

-- slack_installations: looked up by user_id for token retrieval
CREATE INDEX IF NOT EXISTS idx_slack_installations_user_id
  ON public.slack_installations(user_id);

-- email_addresses: looked up by user_id + is_active for connection status checks
CREATE INDEX IF NOT EXISTS idx_email_addresses_user_active
  ON public.email_addresses(user_id, is_active);

-- profiles: looked up by subscription_id in Stripe webhook handlers
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id
  ON public.profiles(subscription_id);

-- feedback_log: RLS policy filters on user_id
CREATE INDEX IF NOT EXISTS idx_feedback_log_user_id
  ON public.feedback_log(user_id);
