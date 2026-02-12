-- =============================================
-- Adecis v1 — Add reminder_sent to leads table
-- Tracks whether a 24h reminder was sent for
-- unreplied high-intent leads
-- =============================================

-- Add the column
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Index for the cron query:
-- finds HIGH intent, unreplied, unreminded leads older than 24h
CREATE INDEX IF NOT EXISTS idx_leads_unreplied_high
  ON public.leads(intent_label, reply_sent, reminder_sent, created_at)
  WHERE intent_label = 'high' AND reply_sent = FALSE AND reminder_sent = FALSE;
