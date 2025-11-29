-- ============================================================================
-- Fix RLS Performance Issues
--
-- This migration:
-- 1. Uses (select auth.uid()) instead of auth.uid() for performance
-- 2. Removes duplicate/conflicting policies
-- 3. Consolidates policies to avoid multiple permissive policies
--
-- Run this in Supabase SQL Editor after the initial realtime_rls_security.sql
-- ============================================================================

-- ============================================================================
-- 1. FIX NOTIFICATION TABLE POLICIES
-- ============================================================================

-- Drop all existing Notification policies to start fresh
DROP POLICY IF EXISTS "Users can only access own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only insert own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only update own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only delete own notifications" ON "Notification";

-- Recreate with optimized (select auth.uid()) pattern
CREATE POLICY "Users can only access own notifications"
ON "Notification"
FOR SELECT
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can only insert own notifications"
ON "Notification"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can only update own notifications"
ON "Notification"
FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can only delete own notifications"
ON "Notification"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- ============================================================================
-- 2. FIX MESSAGE TABLE POLICIES
-- ============================================================================

-- Drop all existing Message policies
DROP POLICY IF EXISTS "Users can access messages in their conversations" ON "Message";
DROP POLICY IF EXISTS "Users can send messages" ON "Message";
DROP POLICY IF EXISTS "Users can update own messages" ON "Message";
DROP POLICY IF EXISTS "Users can delete own messages" ON "Message";
DROP POLICY IF EXISTS "Users can view messages - consolidated" ON "Message";
DROP POLICY IF EXISTS "Users can update their own messages" ON "Message";

-- Recreate consolidated policies with optimized pattern
CREATE POLICY "Users can access messages in their conversations"
ON "Message"
FOR SELECT
USING (
  (select auth.uid())::text = "senderId"
  OR (select auth.uid())::text = "recipientId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "Message"."groupId"
    AND gm."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can send messages"
ON "Message"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "senderId");

CREATE POLICY "Users can update own messages"
ON "Message"
FOR UPDATE
USING ((select auth.uid())::text = "senderId");

CREATE POLICY "Users can delete own messages"
ON "Message"
FOR DELETE
USING ((select auth.uid())::text = "senderId");

-- ============================================================================
-- 3. FIX GROUP MEMBER TABLE POLICIES
-- ============================================================================

-- Drop all existing GroupMember policies
DROP POLICY IF EXISTS "Users can view their group memberships" ON "GroupMember";
DROP POLICY IF EXISTS "Group members can view other members" ON "GroupMember";
DROP POLICY IF EXISTS "Users can view group members - consolidated" ON "GroupMember";

-- Create single consolidated policy for SELECT
CREATE POLICY "Users can view group members - consolidated"
ON "GroupMember"
FOR SELECT
USING (
  -- User is the member OR user is in the same group
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "GroupMember"."groupId"
    AND gm."userId" = (select auth.uid())::text
  )
);

-- ============================================================================
-- 4. FIX USER_PRESENCE TABLE POLICIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_presence') THEN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Users can view presence of connected users" ON "user_presence";
    DROP POLICY IF EXISTS "Users can update own presence" ON "user_presence";
    DROP POLICY IF EXISTS "Users can view presence" ON "user_presence";
    DROP POLICY IF EXISTS "Users can insert their own presence" ON "user_presence";
    DROP POLICY IF EXISTS "Users can update their own presence" ON "user_presence";

    -- Create optimized consolidated policies
    EXECUTE 'CREATE POLICY "Users can view presence - consolidated"
    ON "user_presence"
    FOR SELECT
    USING (
      (select auth.uid())::text = "userId"
      OR EXISTS (
        SELECT 1 FROM "Match" m
        WHERE m."status" = ''ACCEPTED''
        AND (
          (m."senderId" = (select auth.uid())::text AND m."receiverId" = "user_presence"."userId")
          OR (m."receiverId" = (select auth.uid())::text AND m."senderId" = "user_presence"."userId")
        )
      )
    )';

    EXECUTE 'CREATE POLICY "Users can manage own presence"
    ON "user_presence"
    FOR ALL
    USING ((select auth.uid())::text = "userId")
    WITH CHECK ((select auth.uid())::text = "userId")';
  END IF;
END $$;

-- ============================================================================
-- 5. FIX STUDY SESSION TABLE POLICIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'StudySession') THEN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Session participants can view sessions" ON "StudySession";
    DROP POLICY IF EXISTS "Users can create sessions" ON "StudySession";
    DROP POLICY IF EXISTS "Session hosts can update sessions" ON "StudySession";
    DROP POLICY IF EXISTS "Users can view sessions they're part of" ON "StudySession";
    DROP POLICY IF EXISTS "Users can create their own sessions" ON "StudySession";
    DROP POLICY IF EXISTS "Session creators can update their sessions" ON "StudySession";

    -- Create optimized consolidated policies
    EXECUTE 'CREATE POLICY "Session participants can view sessions - optimized"
    ON "StudySession"
    FOR SELECT
    USING (
      (select auth.uid())::text = "createdBy"
      OR (select auth.uid())::text = "userId"
      OR EXISTS (
        SELECT 1 FROM "SessionParticipant" sp
        WHERE sp."sessionId" = "StudySession"."id"
        AND sp."userId" = (select auth.uid())::text
      )
    )';

    EXECUTE 'CREATE POLICY "Users can create sessions - optimized"
    ON "StudySession"
    FOR INSERT
    WITH CHECK ((select auth.uid())::text = "createdBy")';

    EXECUTE 'CREATE POLICY "Session hosts can update sessions - optimized"
    ON "StudySession"
    FOR UPDATE
    USING (
      (select auth.uid())::text = "createdBy"
      OR (select auth.uid())::text = "userId"
    )';
  END IF;
END $$;

-- ============================================================================
-- 6. FIX GROUP TABLE POLICIES (if mentioned in warnings)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Group') THEN
    DROP POLICY IF EXISTS "Users can view groups - consolidated" ON "Group";

    -- Note: Group table uses "privacy" enum (PUBLIC/PRIVATE) and "ownerId" instead of isPublic/createdBy
    EXECUTE 'CREATE POLICY "Users can view groups - optimized"
    ON "Group"
    FOR SELECT
    USING (
      "privacy" = ''PUBLIC''
      OR (select auth.uid())::text = "ownerId"
      OR EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (select auth.uid())::text
      )
    )';
  END IF;
END $$;

-- ============================================================================
-- 7. FIX GROUP INVITE TABLE POLICIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'GroupInvite') THEN
    DROP POLICY IF EXISTS "Users can view group invites - consolidated" ON "GroupInvite";

    EXECUTE 'CREATE POLICY "Users can view group invites - optimized"
    ON "GroupInvite"
    FOR SELECT
    USING (
      (select auth.uid())::text = "inviterId"
      OR (select auth.uid())::text = "inviteeId"
    )';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run this to verify no more warnings:
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE tablename IN ('Notification', 'Message', 'GroupMember', 'user_presence', 'StudySession', 'Group', 'GroupInvite')
-- ORDER BY tablename, policyname;

-- ============================================================================
-- NOTE: After running this migration, the Supabase linter warnings should
-- be resolved. The key changes are:
-- 1. Using (select auth.uid()) instead of auth.uid() for init plan optimization
-- 2. Consolidating multiple permissive policies into single policies
-- ============================================================================
