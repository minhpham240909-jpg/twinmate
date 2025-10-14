-- Fix StudySession table - add missing columns manually
-- Run this in Supabase SQL Editor
-- IMPORTANT: Run this entire script in a transaction to ensure atomicity

BEGIN;

-- Add createdAt and updatedAt first (as nullable, will backfill then make NOT NULL)
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP;

-- Add all other missing columns (nullable first, will enforce NOT NULL after backfill)
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER DEFAULT 10;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT false;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "agoraChannel" TEXT;

-- Backfill existing NULL values for required columns
-- Set createdAt/updatedAt to now() if NULL
UPDATE "StudySession" SET "createdAt" = now() WHERE "createdAt" IS NULL;
UPDATE "StudySession" SET "updatedAt" = now() WHERE "updatedAt" IS NULL;

-- Set status to 'SCHEDULED' if NULL
UPDATE "StudySession" SET "status" = 'SCHEDULED' WHERE "status" IS NULL;

-- Update existing rows to have createdBy = userId (only if userId is not null)
-- Skip rows where userId is also NULL - these need manual review
UPDATE "StudySession"
SET "createdBy" = "userId"
WHERE "createdBy" IS NULL AND "userId" IS NOT NULL;

-- Log warning: Check for any rows still missing createdBy
-- If this returns rows, you need to either:
-- 1. Set them to a system/default user ID
-- 2. Delete the orphaned sessions
-- 3. Manually assign them to appropriate users
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM "StudySession"
    WHERE "createdBy" IS NULL;

    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % StudySession rows with NULL createdBy. These must be fixed before setting NOT NULL constraint.', orphan_count;
        -- Optionally set to a system user or fail:
        -- UPDATE "StudySession" SET "createdBy" = 'system-user-id' WHERE "createdBy" IS NULL;
    END IF;
END $$;

-- Verify referential integrity before adding FK constraint
-- Find any createdBy values that don't have a corresponding User
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM "StudySession" ss
    LEFT JOIN "User" u ON ss."createdBy" = u."id"
    WHERE ss."createdBy" IS NOT NULL AND u."id" IS NULL;

    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % StudySession rows with createdBy values that do not exist in User table. Fix these before adding FK constraint:', orphan_count;
        -- Log the orphaned IDs for review
        RAISE NOTICE 'Orphaned createdBy values: %', (
            SELECT array_agg(DISTINCT ss."createdBy")
            FROM "StudySession" ss
            LEFT JOIN "User" u ON ss."createdBy" = u."id"
            WHERE ss."createdBy" IS NOT NULL AND u."id" IS NULL
        );
        -- Options to fix:
        -- 1. Delete orphaned sessions:
        -- DELETE FROM "StudySession" WHERE "createdBy" NOT IN (SELECT "id" FROM "User");
        -- 2. Or set to a valid system user:
        -- UPDATE "StudySession" SET "createdBy" = 'valid-system-user-id'
        -- WHERE "createdBy" NOT IN (SELECT "id" FROM "User");
    END IF;
END $$;

-- Now make required columns NOT NULL (with defaults for future inserts)
ALTER TABLE "StudySession" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "StudySession" ALTER COLUMN "createdAt" SET DEFAULT now();

ALTER TABLE "StudySession" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "StudySession" ALTER COLUMN "updatedAt" SET DEFAULT now();

ALTER TABLE "StudySession" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "StudySession" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

-- Only set createdBy NOT NULL if all rows have been backfilled
-- Uncomment this after verifying no NULL createdBy values remain:
-- ALTER TABLE "StudySession" ALTER COLUMN "createdBy" SET NOT NULL;

-- Add foreign key constraint if not exists (with NOT VALID to avoid lock, then validate)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudySession_createdBy_fkey'
    ) THEN
        ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE
        NOT VALID;

        -- Validate the constraint (checks existing rows)
        ALTER TABLE "StudySession" VALIDATE CONSTRAINT "StudySession_createdBy_fkey";
    END IF;
END $$;

-- Add unique constraint on agoraChannel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudySession_agoraChannel_key'
    ) THEN
        ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_agoraChannel_key" UNIQUE ("agoraChannel");
    END IF;
END $$;

-- Create trigger function to auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_study_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate (idempotent)
DROP TRIGGER IF EXISTS set_study_session_updated_at ON "StudySession";
CREATE TRIGGER set_study_session_updated_at
    BEFORE UPDATE ON "StudySession"
    FOR EACH ROW
    EXECUTE FUNCTION update_study_session_updated_at();

-- Add indexes
CREATE INDEX IF NOT EXISTS "StudySession_createdBy_idx" ON "StudySession"("createdBy");
CREATE INDEX IF NOT EXISTS "StudySession_status_idx" ON "StudySession"("status");
CREATE INDEX IF NOT EXISTS "StudySession_agoraChannel_idx" ON "StudySession"("agoraChannel");
CREATE INDEX IF NOT EXISTS "StudySession_updatedAt_idx" ON "StudySession"("updatedAt");

COMMIT;
