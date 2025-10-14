-- Add aboutYourselfItems field to Profile table

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "aboutYourselfItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Verify changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Profile'
AND column_name IN ('aboutYourselfItems', 'aboutYourself')
ORDER BY column_name;
