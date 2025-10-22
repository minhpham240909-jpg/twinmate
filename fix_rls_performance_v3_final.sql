-- ==========================================
-- FIX RLS PERFORMANCE ISSUES (Version 3 - FINAL)
-- This script optimizes RLS policies without breaking functionality
-- Run this in Supabase SQL Editor
-- ==========================================

-- IMPORTANT: This script is SAFE and NON-BREAKING
-- It only optimizes performance by:
-- 1. Wrapping auth.uid() calls in SELECT statements
-- 2. Adding explicit type casts where needed
-- 3. Using correct column names (ownerId for Group, createdBy for StudySession)
-- 4. The logic remains exactly the same
-- 5. No policies are removed, only optimized

BEGIN;

-- ==========================================
-- STEP 1: Add INCOMING_CALL to enum (if not already added)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType'
    AND e.enumlabel = 'INCOMING_CALL'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'INCOMING_CALL';
  END IF;
END $$;

-- ==========================================
-- STEP 2: Optimize auth.uid() calls in existing policies
-- Strategy: DROP and recreate with optimized version
-- This is safe because we're recreating with same logic
-- Note: Using ::text cast for text columns
-- ==========================================

-- Fix User table policies
DROP POLICY IF EXISTS "Allow service role full access to User" ON "User";
CREATE POLICY "Allow service role full access to User"
ON "User"
FOR ALL
TO service_role
USING (true);

-- Fix Profile table policies
DROP POLICY IF EXISTS "Allow service role full access to Profile" ON "Profile";
CREATE POLICY "Allow service role full access to Profile"
ON "Profile"
FOR ALL
TO service_role
USING (true);

-- Fix Message table policies
DROP POLICY IF EXISTS "Allow service role full access to Message" ON "Message";
CREATE POLICY "Allow service role full access to Message"
ON "Message"
FOR ALL
TO service_role
USING (true);

-- Fix Match table policies
DROP POLICY IF EXISTS "Allow service role full access to Match" ON "Match";
CREATE POLICY "Allow service role full access to Match"
ON "Match"
FOR ALL
TO service_role
USING (true);

-- Fix Notification table policies
DROP POLICY IF EXISTS "Allow service role full access to Notification" ON "Notification";
CREATE POLICY "Allow service role full access to Notification"
ON "Notification"
FOR ALL
TO service_role
USING (true);

-- Fix SessionMessage table policies
DROP POLICY IF EXISTS "Allow service role full access to SessionMessage" ON "SessionMessage";
CREATE POLICY "Allow service role full access to SessionMessage"
ON "SessionMessage"
FOR ALL
TO service_role
USING (true);

-- Fix StudySession table policies (uses createdBy)
DROP POLICY IF EXISTS "Allow service role full access to StudySession" ON "StudySession";
CREATE POLICY "Allow service role full access to StudySession"
ON "StudySession"
FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Users can view sessions they're part of" ON "StudySession";
CREATE POLICY "Users can view sessions they're part of"
ON "StudySession"
FOR SELECT
USING (
  "createdBy" = (SELECT auth.uid())::text
  OR
  EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "StudySession"."id"
    AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
    AND "SessionParticipant"."status" = 'JOINED'
  )
);

DROP POLICY IF EXISTS "Users can create their own sessions" ON "StudySession";
CREATE POLICY "Users can create their own sessions"
ON "StudySession"
FOR INSERT
WITH CHECK ("createdBy" = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Session creators can update their sessions" ON "StudySession";
CREATE POLICY "Session creators can update their sessions"
ON "StudySession"
FOR UPDATE
USING ("createdBy" = (SELECT auth.uid())::text)
WITH CHECK ("createdBy" = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Session creators can delete their sessions" ON "StudySession";
CREATE POLICY "Session creators can delete their sessions"
ON "StudySession"
FOR DELETE
USING ("createdBy" = (SELECT auth.uid())::text);

-- Fix SessionParticipant table policies
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON "SessionParticipant";
CREATE POLICY "Users can view participants in their sessions"
ON "SessionParticipant"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND (
      "StudySession"."createdBy" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "SessionParticipant" sp
        WHERE sp."sessionId" = "StudySession"."id"
        AND sp."userId" = (SELECT auth.uid())::text
        AND sp."status" = 'JOINED'
      )
    )
  )
);

DROP POLICY IF EXISTS "Session creators can manage participants" ON "SessionParticipant";
CREATE POLICY "Session creators can manage participants"
ON "SessionParticipant"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND "StudySession"."createdBy" = (SELECT auth.uid())::text
  )
);

-- Fix SessionGoal table policies
DROP POLICY IF EXISTS "Users can view goals in their sessions" ON "SessionGoal";
CREATE POLICY "Users can view goals in their sessions"
ON "SessionGoal"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionGoal"."sessionId"
    AND (
      "StudySession"."createdBy" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "SessionParticipant"
        WHERE "SessionParticipant"."sessionId" = "StudySession"."id"
        AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
        AND "SessionParticipant"."status" = 'JOINED'
      )
    )
  )
);

DROP POLICY IF EXISTS "Session participants can manage goals" ON "SessionGoal";
CREATE POLICY "Session participants can manage goals"
ON "SessionGoal"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionGoal"."sessionId"
    AND (
      "StudySession"."createdBy" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "SessionParticipant"
        WHERE "SessionParticipant"."sessionId" = "StudySession"."id"
        AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
        AND "SessionParticipant"."status" = 'JOINED'
      )
    )
  )
);

-- Fix Session table policies (userId is text, needs cast)
DROP POLICY IF EXISTS "Users can manage their own sessions" ON "Session";
CREATE POLICY "Users can manage their own sessions"
ON "Session"
FOR ALL
USING ("userId" = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Users can view their own sessions" ON "Session";
CREATE POLICY "Users can view their own sessions"
ON "Session"
FOR SELECT
USING ("userId" = (SELECT auth.uid())::text);

-- Fix ConversationArchive table policies
DROP POLICY IF EXISTS "Users can manage their own archives" ON "ConversationArchive";
CREATE POLICY "Users can manage their own archives"
ON "ConversationArchive"
FOR ALL
USING ("userId" = (SELECT auth.uid())::text);

-- Fix Group table policies (uses ownerId, not createdBy!)
DROP POLICY IF EXISTS "Users can view public groups" ON "Group";
CREATE POLICY "Users can view public groups"
ON "Group"
FOR SELECT
USING (
  "privacy" = 'PUBLIC'
  OR
  EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "GroupMember"."groupId" = "Group"."id"
    AND "GroupMember"."userId" = (SELECT auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Users can create groups" ON "Group";
CREATE POLICY "Users can create groups"
ON "Group"
FOR INSERT
WITH CHECK ("ownerId" = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Group owners can update their groups" ON "Group";
CREATE POLICY "Group owners can update their groups"
ON "Group"
FOR UPDATE
USING ("ownerId" = (SELECT auth.uid())::text)
WITH CHECK ("ownerId" = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Group owners can delete their groups" ON "Group";
CREATE POLICY "Group owners can delete their groups"
ON "Group"
FOR DELETE
USING ("ownerId" = (SELECT auth.uid())::text);

-- Fix GroupMember table policies
DROP POLICY IF EXISTS "Users can view group members" ON "GroupMember";
CREATE POLICY "Users can view group members"
ON "GroupMember"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      "Group"."privacy" = 'PUBLIC'
      OR
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
      )
    )
  )
);

DROP POLICY IF EXISTS "Group owners and admins can manage members" ON "GroupMember";
CREATE POLICY "Group owners and admins can manage members"
ON "GroupMember"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      "Group"."ownerId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
        AND gm."role" IN ('OWNER', 'ADMIN')
      )
    )
  )
);

COMMIT;

-- ==========================================
-- VERIFICATION QUERY
-- Run this after to verify no errors
-- ==========================================
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
