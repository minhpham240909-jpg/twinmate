-- Soft-delete for leads: instead of permanent delete, set deleted_at timestamp
-- Leads can be restored within 30 days; after that a cron or manual cleanup removes them
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for fast queries: non-deleted leads (most common) and finding deleted leads for restore
CREATE INDEX IF NOT EXISTS idx_leads_user_deleted_at ON public.leads(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Allow users to delete their own activity log entries
CREATE POLICY "Users can delete own activity"
  ON public.activity_log
  FOR DELETE
  USING (auth.uid() = user_id);
