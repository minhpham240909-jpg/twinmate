-- =====================================================
-- PART 2: DATA UPDATES & RLS SECURITY
-- =====================================================
-- Run this AFTER Part 1 has completed successfully
-- =====================================================

-- Update existing sessions that are in SCHEDULED status to WAITING
UPDATE "StudySession"
SET
  status = 'WAITING',
  "waitingStartedAt" = COALESCE("createdAt", NOW()),
  "waitingExpiresAt" = COALESCE("createdAt", NOW()) + INTERVAL '30 minutes'
WHERE status = 'SCHEDULED' AND "endedAt" IS NULL;

-- Update existing ACTIVE sessions to have proper waitingExpiresAt
UPDATE "StudySession"
SET
  "waitingStartedAt" = COALESCE("createdAt", NOW()),
  "waitingExpiresAt" = COALESCE("createdAt", NOW()) + INTERVAL '30 minutes'
WHERE status = 'ACTIVE' AND "waitingExpiresAt" IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Ensure RLS is enabled on StudySession table
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Users can view sessions they're part of" ON "StudySession";
DROP POLICY IF EXISTS "Users can create their own sessions" ON "StudySession";
DROP POLICY IF EXISTS "Session creators can update their sessions" ON "StudySession";
DROP POLICY IF EXISTS "Session creators can delete their sessions" ON "StudySession";

-- Policy 1: SELECT - Users can view sessions they're participants in
CREATE POLICY "Users can view sessions they're part of"
ON "StudySession"
FOR SELECT
USING (
  auth.uid()::text IN (
    SELECT "userId"
    FROM "SessionParticipant"
    WHERE "sessionId" = "StudySession"."id"
  )
  OR
  auth.uid()::text = "createdBy"
);

-- Policy 2: INSERT - Users can create their own sessions
CREATE POLICY "Users can create their own sessions"
ON "StudySession"
FOR INSERT
WITH CHECK (
  auth.uid()::text = "createdBy"
);

-- Policy 3: UPDATE - Only session creators can update sessions
-- This includes starting the session (WAITING -> ACTIVE transition)
CREATE POLICY "Session creators can update their sessions"
ON "StudySession"
FOR UPDATE
USING (
  auth.uid()::text = "createdBy"
)
WITH CHECK (
  auth.uid()::text = "createdBy"
);

-- Policy 4: DELETE - Only session creators can delete sessions
CREATE POLICY "Session creators can delete their sessions"
ON "StudySession"
FOR DELETE
USING (
  auth.uid()::text = "createdBy"
);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON "StudySession" TO authenticated;

-- =====================================================
-- SessionParticipant RLS
-- =====================================================

-- Ensure SessionParticipant table also has proper RLS
ALTER TABLE "SessionParticipant" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view participants in their sessions" ON "SessionParticipant";
DROP POLICY IF EXISTS "Session creators can manage participants" ON "SessionParticipant";

CREATE POLICY "Users can view participants in their sessions"
ON "SessionParticipant"
FOR SELECT
USING (
  auth.uid()::text = "userId"
  OR
  auth.uid()::text IN (
    SELECT "createdBy"
    FROM "StudySession"
    WHERE "id" = "SessionParticipant"."sessionId"
  )
  OR
  auth.uid()::text IN (
    SELECT "userId"
    FROM "SessionParticipant" AS sp
    WHERE sp."sessionId" = "SessionParticipant"."sessionId"
  )
);

CREATE POLICY "Session creators can manage participants"
ON "SessionParticipant"
FOR ALL
USING (
  auth.uid()::text IN (
    SELECT "createdBy"
    FROM "StudySession"
    WHERE "id" = "SessionParticipant"."sessionId"
  )
)
WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdBy"
    FROM "StudySession"
    WHERE "id" = "SessionParticipant"."sessionId"
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionParticipant" TO authenticated;

-- Add policy comment
COMMENT ON POLICY "Session creators can update their sessions" ON "StudySession"
IS 'Allows session creators to update session status from WAITING to ACTIVE when clicking Start';

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- You can now test the waiting lobby feature
-- =====================================================
