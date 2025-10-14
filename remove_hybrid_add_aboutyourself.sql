-- Remove hybrid collaboration fields and add "aboutYourself" field
-- ⚠️  WARNING: This migration is DESTRUCTIVE and will delete data.
-- ⚠️  IMPORTANT: Back up your database before running this migration!
--
-- To back up your data, run this query first:
-- SELECT id, "collaborationType", skills, "lookingFor", industry,
--        "skillsCustomDescription", "lookingForCustomDescription"
-- INTO TEMP TABLE profile_backup_<timestamp>
-- FROM "Profile"
-- WHERE "collaborationType" IS NOT NULL OR skills IS NOT NULL OR "lookingFor" IS NOT NULL
--    OR industry IS NOT NULL OR "skillsCustomDescription" IS NOT NULL
--    OR "lookingForCustomDescription" IS NOT NULL;

BEGIN;

-- Add new "aboutYourself" field FIRST (before dropping old columns)
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "aboutYourself" TEXT;

-- Migrate existing data to the new "aboutYourself" column
-- Concatenate all relevant fields into a readable format
UPDATE "Profile"
SET "aboutYourself" = CONCAT_WS(E'\n\n',
  CASE
    WHEN "collaborationType" IS NOT NULL
    THEN 'Collaboration Type: ' || "collaborationType"::text
    ELSE NULL
  END,
  CASE
    WHEN skills IS NOT NULL AND array_length(skills, 1) > 0
    THEN 'Skills: ' || array_to_string(skills, ', ')
    ELSE NULL
  END,
  CASE
    WHEN "skillsCustomDescription" IS NOT NULL AND "skillsCustomDescription" != ''
    THEN 'About My Skills: ' || "skillsCustomDescription"
    ELSE NULL
  END,
  CASE
    WHEN "lookingFor" IS NOT NULL AND array_length("lookingFor", 1) > 0
    THEN 'Looking For: ' || array_to_string("lookingFor", ', ')
    ELSE NULL
  END,
  CASE
    WHEN "lookingForCustomDescription" IS NOT NULL AND "lookingForCustomDescription" != ''
    THEN 'What I''m Looking For: ' || "lookingForCustomDescription"
    ELSE NULL
  END,
  CASE
    WHEN industry IS NOT NULL AND industry != ''
    THEN 'Industry: ' || industry
    ELSE NULL
  END
)
WHERE "aboutYourself" IS NULL
  AND (
    "collaborationType" IS NOT NULL
    OR skills IS NOT NULL
    OR "lookingFor" IS NOT NULL
    OR industry IS NOT NULL
    OR "skillsCustomDescription" IS NOT NULL
    OR "lookingForCustomDescription" IS NOT NULL
  );

-- Drop indexes first
DROP INDEX IF EXISTS "Profile_collaborationType_idx";
DROP INDEX IF EXISTS "Profile_skills_idx";

-- Now safe to remove hybrid columns from Profile table (data has been migrated)
ALTER TABLE "Profile"
  DROP COLUMN IF EXISTS "collaborationType",
  DROP COLUMN IF EXISTS "skills",
  DROP COLUMN IF EXISTS "lookingFor",
  DROP COLUMN IF EXISTS "industry",
  DROP COLUMN IF EXISTS "skillsCustomDescription",
  DROP COLUMN IF EXISTS "lookingForCustomDescription";

-- Handle CollaborationType enum drop safely
-- First, check for any dependencies
DO $$
DECLARE
    dep_count INTEGER;
    dep_list TEXT;
BEGIN
    -- Check for columns still using this enum
    SELECT COUNT(*), string_agg(table_name || '.' || column_name, ', ')
    INTO dep_count, dep_list
    FROM information_schema.columns
    WHERE udt_name = 'CollaborationType';

    IF dep_count > 0 THEN
        RAISE EXCEPTION 'Cannot drop CollaborationType enum: still used by columns: %', dep_list;
    END IF;

    -- Check for array types, function parameters, etc.
    SELECT COUNT(*)
    INTO dep_count
    FROM pg_type
    WHERE typname = '_collaborationtype'; -- Array type

    IF dep_count > 0 THEN
        RAISE WARNING 'CollaborationType array type still exists, attempting cleanup...';
        -- Drop array type first if it exists
        DROP TYPE IF EXISTS "CollaborationType"[] CASCADE;
    END IF;

    -- Now safe to drop the enum
    DROP TYPE IF EXISTS "CollaborationType" CASCADE;
    RAISE NOTICE 'CollaborationType enum dropped successfully';
END $$;

COMMIT;

-- Verify changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Profile'
AND column_name IN ('aboutYourself', 'collaborationType', 'skills', 'lookingFor', 'industry')
ORDER BY column_name;

-- ============================================================================
-- ROLLBACK/DOWNGRADE INSTRUCTIONS (run manually if needed to restore columns)
-- ============================================================================
-- NOTE: This is a BEST-EFFORT rollback. Parsed data may not perfectly restore
-- to original structure. Original data should be backed up before migration.
--
-- -- 1. Recreate the enum type
-- CREATE TYPE "CollaborationType" AS ENUM ('SEEKING_PARTNER', 'OFFERING_HELP', 'NETWORKING');
--
-- -- 2. Recreate columns
-- ALTER TABLE "Profile"
--   ADD COLUMN "collaborationType" "CollaborationType",
--   ADD COLUMN "skills" TEXT[],
--   ADD COLUMN "lookingFor" TEXT[],
--   ADD COLUMN "industry" TEXT,
--   ADD COLUMN "skillsCustomDescription" TEXT,
--   ADD COLUMN "lookingForCustomDescription" TEXT;
--
-- -- 3. Attempt to parse data back from aboutYourself (LOSSY - manual review recommended)
-- -- This is complex and lossy. Best to restore from backup instead.
-- -- If you need to parse, consider writing custom logic based on the format above.
--
-- -- 4. Recreate indexes
-- CREATE INDEX "Profile_collaborationType_idx" ON "Profile"("collaborationType");
-- CREATE INDEX "Profile_skills_idx" ON "Profile" USING gin(skills);
--
-- ============================================================================
