-- Migration: Add focusTime column to AIPartnerSession table
-- This column tracks Pomodoro timer focus time separately from total session duration
-- Run this in Supabase SQL Editor

-- Add the focusTime column if it doesn't exist
ALTER TABLE "AIPartnerSession" ADD COLUMN IF NOT EXISTS "focusTime" INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN "AIPartnerSession"."focusTime" IS 'Pomodoro focus time in seconds (only when timer was actively running, not total session duration)';

-- Create index for analytics queries (non-concurrent version for Supabase SQL Editor)
CREATE INDEX IF NOT EXISTS idx_ai_partner_session_focus_time
ON "AIPartnerSession" ("focusTime")
WHERE "focusTime" IS NOT NULL AND "focusTime" > 0;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'AIPartnerSession'
AND column_name = 'focusTime';
