-- Add dismissed column to leads for soft-archive functionality
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- Composite index for the default dashboard query:
-- user's non-dismissed leads, sorted by creation date
CREATE INDEX IF NOT EXISTS idx_leads_user_dismissed_created
  ON public.leads(user_id, dismissed, created_at DESC);
