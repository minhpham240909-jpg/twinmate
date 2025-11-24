-- Migration: Remove deprecated onlineStatus field from Profile table
-- This migration removes the legacy onlineStatus column and its index
-- UserPresence.status is now the single source of truth for online status

BEGIN;

-- Step 1: Drop the index on onlineStatus (if it exists)
DROP INDEX IF EXISTS "Profile_onlineStatus_idx";

-- Step 2: Drop the onlineStatus column from Profile table
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "onlineStatus";

-- Step 3: Verify the changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Profile'
    AND column_name = 'onlineStatus'
  ) THEN
    RAISE NOTICE 'SUCCESS: onlineStatus column has been removed from Profile table';
  ELSE
    RAISE EXCEPTION 'FAILED: onlineStatus column still exists in Profile table';
  END IF;
END $$;

COMMIT;
