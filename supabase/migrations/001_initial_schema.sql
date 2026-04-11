-- =============================================
-- Clerva v1 — Initial Database Schema
-- =============================================

-- ===================
-- PROFILES
-- ===================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  -- Agency/freelancer profile
  business_name TEXT,
  niche TEXT,
  tone TEXT DEFAULT 'professional',
  booking_link TEXT,
  custom_instructions TEXT,
  -- Onboarding state
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 1,
  -- Billing
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'trialing',
  subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  leads_used_this_month INTEGER DEFAULT 0,
  plan_lead_limit INTEGER DEFAULT 25,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===================
-- SLACK INSTALLATIONS
-- ===================
CREATE TABLE public.slack_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT,
  bot_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  bot_user_id TEXT NOT NULL,
  authed_user_id TEXT,
  scope TEXT,
  monitored_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

ALTER TABLE public.slack_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own installations"
  ON public.slack_installations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own installations"
  ON public.slack_installations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own installations"
  ON public.slack_installations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own installations"
  ON public.slack_installations FOR DELETE
  USING (auth.uid() = user_id);

-- ===================
-- EMAIL ADDRESSES
-- ===================
CREATE TABLE public.email_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inbound_address TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email addresses"
  ON public.email_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email addresses"
  ON public.email_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ===================
-- LEADS (core table)
-- ===================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Source
  source TEXT NOT NULL CHECK (source IN ('slack', 'email')),
  source_id TEXT,
  source_channel TEXT,
  source_channel_name TEXT,
  -- Raw content
  sender_name TEXT,
  sender_identifier TEXT,
  raw_message TEXT NOT NULL,
  thread_context TEXT,
  -- AI scoring
  intent_score REAL,
  intent_label TEXT CHECK (intent_label IN ('high', 'medium', 'low')),
  summary_bullets TEXT[],
  suggested_reply TEXT,
  -- AI metadata
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  ai_latency_ms INTEGER,
  -- User feedback
  feedback TEXT CHECK (feedback IN ('positive', 'negative')),
  feedback_at TIMESTAMPTZ,
  -- Reply tracking
  reply_sent BOOLEAN DEFAULT FALSE,
  reply_sent_at TIMESTAMPTZ,
  -- Slack-specific
  slack_thread_ts TEXT,
  slack_channel_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_user_created ON public.leads(user_id, created_at DESC);
CREATE INDEX idx_leads_user_label ON public.leads(user_id, intent_label);
CREATE INDEX idx_leads_user_source ON public.leads(user_id, source);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id);

-- ===================
-- FEEDBACK LOG
-- ===================
CREATE TABLE public.feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('positive', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.feedback_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON public.feedback_log FOR SELECT
  USING (auth.uid() = user_id);

-- ===================
-- FUNCTIONS
-- ===================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment lead counter
CREATE OR REPLACE FUNCTION public.increment_leads_used(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET leads_used_this_month = leads_used_this_month + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Monthly counter reset
CREATE OR REPLACE FUNCTION public.reset_monthly_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET leads_used_this_month = 0,
      updated_at = NOW()
  WHERE subscription_status IN ('active', 'trialing');
END;
$$;

-- ===================
-- GRANTS
-- ===================
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.slack_installations TO authenticated;
GRANT ALL ON public.slack_installations TO service_role;
GRANT ALL ON public.email_addresses TO authenticated;
GRANT ALL ON public.email_addresses TO service_role;
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
GRANT ALL ON public.feedback_log TO authenticated;
GRANT ALL ON public.feedback_log TO service_role;
