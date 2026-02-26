-- Add show_low and show_dismissed preference columns to profiles
-- These control whether low-intent and dismissed leads are visible on the dashboard
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_low boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_dismissed boolean NOT NULL DEFAULT false;
