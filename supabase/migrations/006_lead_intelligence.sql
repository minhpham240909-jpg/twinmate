-- Add deal intelligence columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS confidence INTEGER,
  ADD COLUMN IF NOT EXISTS deal_tier TEXT,
  ADD COLUMN IF NOT EXISTS scoring_reasons TEXT[];
