-- Add response priority columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS response_priority TEXT,
  ADD COLUMN IF NOT EXISTS priority_reason TEXT;
