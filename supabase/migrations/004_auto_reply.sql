-- Add auto-reply settings to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reply_from_name TEXT;

-- Enable Realtime on leads table for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
