-- Migration: Add aboutYourselfItems and aboutYourself fields to Profile table
-- This adds the new "Add more about yourself" section fields

-- Add aboutYourselfItems column (array of strings)
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "aboutYourselfItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add aboutYourself column (text field)
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "aboutYourself" TEXT;

-- Add comments for documentation
COMMENT ON COLUMN "Profile"."aboutYourselfItems" IS 'Custom tags/items that users can add to describe themselves';
COMMENT ON COLUMN "Profile"."aboutYourself" IS 'Detailed description for the "Add more about yourself" section';
