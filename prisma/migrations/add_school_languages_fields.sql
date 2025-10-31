-- Migration: Add school and languages fields to Profile table
-- These fields were missing from the previous aboutYourself migration

-- Add school column (text field)
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "school" TEXT;

-- Add languages column (text field)
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "languages" TEXT;

-- Add comments for documentation
COMMENT ON COLUMN "Profile"."school" IS 'School or institution name';
COMMENT ON COLUMN "Profile"."languages" IS 'Languages spoken by the user';
