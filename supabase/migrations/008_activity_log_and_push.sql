-- Activity log for the dashboard activity feed
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('lead_received', 'reply_sent', 'reply_auto_sent', 'lead_skipped')),
  sender_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('slack', 'email')),
  intent_label TEXT CHECK (intent_label IN ('high', 'medium', 'low') OR intent_label IS NULL),
  deal_tier TEXT,
  reply_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast dashboard queries — user's recent activity
CREATE INDEX idx_activity_log_user_created ON activity_log(user_id, created_at DESC);

-- RLS: users can only read their own activity
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
  ON activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Index for sending push to a specific user
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- GRANTs so authenticated users can read activity and service_role can insert
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Add digest preferences to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_hour INTEGER NOT NULL DEFAULT 8 CHECK (digest_hour >= 0 AND digest_hour <= 23),
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false;
