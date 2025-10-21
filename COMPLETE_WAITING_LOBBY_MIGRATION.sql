-- =====================================================
-- COMPLETE WAITING LOBBY MIGRATION (Schema + RLS)
-- =====================================================
-- IMPORTANT: Run PART 1 first, then run PART 2 separately
-- (Due to PostgreSQL enum limitation, they must be in separate transactions)
-- =====================================================

-- =====================================================
-- PART 1: SCHEMA CHANGES (Run this FIRST)
-- =====================================================

-- Add WAITING status to SessionStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'WAITING'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SessionStatus')
  ) THEN
    ALTER TYPE "SessionStatus" ADD VALUE 'WAITING';
  END IF;
END $$;

-- Add new timing columns for waiting lobby
ALTER TABLE "StudySession"
  ADD COLUMN IF NOT EXISTS "waitingStartedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "waitingExpiresAt" TIMESTAMP(3);

-- Make startedAt nullable (it will be null until user clicks "Start")
DO $$
BEGIN
  -- Check if startedAt is NOT NULL before trying to change it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'StudySession'
    AND column_name = 'startedAt'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "StudySession" ALTER COLUMN "startedAt" DROP NOT NULL;
  END IF;

  -- Drop default if it exists
  ALTER TABLE "StudySession" ALTER COLUMN "startedAt" DROP DEFAULT;
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore errors if default doesn't exist
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "StudySession_waitingExpiresAt_status_idx"
  ON "StudySession"("waitingExpiresAt", "status");

CREATE INDEX IF NOT EXISTS "StudySession_createdBy_idx"
  ON "StudySession"("createdBy");

CREATE INDEX IF NOT EXISTS "StudySession_status_waitingExpiresAt_idx"
  ON "StudySession"("status", "waitingExpiresAt");

-- Add comments for documentation
COMMENT ON COLUMN "StudySession"."waitingStartedAt" IS 'When the waiting lobby was created';
COMMENT ON COLUMN "StudySession"."waitingExpiresAt" IS 'When the waiting lobby will expire (30 minutes after creation)';
COMMENT ON COLUMN "StudySession"."startedAt" IS 'When the actual study call started (null until host clicks Start)';

-- =====================================================
-- END OF PART 1
-- =====================================================
-- STOP HERE! Now run PART 2 below in a NEW QUERY
-- =====================================================
