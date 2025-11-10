-- ============================================
-- FIX ALL SUPABASE RLS PERFORMANCE WARNINGS
-- ============================================
-- This script fixes all performance warnings from Supabase linter:
-- 1. auth_rls_initplan warnings (auth.uid() re-evaluation)
-- 2. multiple_permissive_policies warnings (multiple SELECT policies)
--
-- Run this in Supabase SQL Editor to apply all optimizations
-- ============================================

-- ============================================
-- FIX 1: MESSAGE TABLE RLS (Multiple Permissive Policies)
-- ============================================

-- Drop old Message policies
DROP POLICY IF EXISTS "Users can view messages they sent" ON "Message";
DROP POLICY IF EXISTS "Users can view messages they received" ON "Message";
DROP POLICY IF EXISTS "Users can view group messages they are members of" ON "Message";
DROP POLICY IF EXISTS "Users can view their messages" ON "Message";

-- Create SINGLE COMBINED SELECT policy for Message table
-- This replaces 3 separate policies with 1 optimized policy
CREATE POLICY "Users can view their messages"
ON "Message"
FOR SELECT
USING (
  -- User sent the message
  (SELECT auth.uid())::text = "senderId"
  OR
  -- User received the message (DM)
  (SELECT auth.uid())::text = "recipientId"
  OR
  -- User is member of group where message was sent
  (
    "groupId" IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "Message"."groupId"
      AND "GroupMember"."userId" = (SELECT auth.uid())::text
    )
  )
);

-- ============================================
-- FIX 2: USER_PRESENCE TABLE RLS
-- ============================================

-- Drop old user_presence policies
DROP POLICY IF EXISTS "Users can view their own presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can view partner presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can insert their own presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can update their own presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can view presence" ON "user_presence";

-- Create optimized user_presence policies
-- COMBINED SELECT policy (fixes multiple permissive policies warning)
CREATE POLICY "Users can view presence"
  ON "user_presence" FOR SELECT
  USING (
    -- User can view their own presence
    "userId" = (SELECT auth.uid())::text
    OR
    -- User can view presence of connected partners
    EXISTS (
      SELECT 1 FROM "Match"
      WHERE (
        ("Match"."senderId" = (SELECT auth.uid())::text AND "Match"."receiverId" = "user_presence"."userId" AND "Match"."status" = 'ACCEPTED')
        OR
        ("Match"."receiverId" = (SELECT auth.uid())::text AND "Match"."senderId" = "user_presence"."userId" AND "Match"."status" = 'ACCEPTED')
      )
    )
  );

CREATE POLICY "Users can insert their own presence"
  ON "user_presence" FOR INSERT
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own presence"
  ON "user_presence" FOR UPDATE
  USING ("userId" = (SELECT auth.uid())::text);

-- ============================================
-- FIX 3: DEVICE_SESSIONS TABLE RLS
-- ============================================

-- Drop old device_sessions policies
DROP POLICY IF EXISTS "Users can view their own device sessions" ON "device_sessions";
DROP POLICY IF EXISTS "Users can insert their own device sessions" ON "device_sessions";
DROP POLICY IF EXISTS "Users can update their own device sessions" ON "device_sessions";
DROP POLICY IF EXISTS "Users can delete their own device sessions" ON "device_sessions";

-- Create optimized device_sessions policies
CREATE POLICY "Users can view their own device sessions"
  ON "device_sessions" FOR SELECT
  USING ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can insert their own device sessions"
  ON "device_sessions" FOR INSERT
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own device sessions"
  ON "device_sessions" FOR UPDATE
  USING ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can delete their own device sessions"
  ON "device_sessions" FOR DELETE
  USING ("userId" = (SELECT auth.uid())::text);

-- ============================================
-- FIX 4: MESSAGE_READ_STATUS TABLE RLS
-- ============================================

-- Drop old message_read_status policies
DROP POLICY IF EXISTS "Users can view read status for their messages" ON "message_read_status";
DROP POLICY IF EXISTS "Users can insert read status for messages they received" ON "message_read_status";

-- Create optimized message_read_status policies
CREATE POLICY "Users can view read status for their messages"
  ON "message_read_status" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Message"
      WHERE "Message"."id" = "message_read_status"."messageId"
        AND (
          "Message"."senderId" = (SELECT auth.uid())::text 
          OR 
          "Message"."recipientId" = (SELECT auth.uid())::text
        )
    )
  );

CREATE POLICY "Users can insert read status for messages they received"
  ON "message_read_status" FOR INSERT
  WITH CHECK (
    "userId" = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM "Message"
      WHERE "Message"."id" = "message_read_status"."messageId"
        AND "Message"."recipientId" = (SELECT auth.uid())::text
    )
  );

-- ============================================
-- FIX 5: TYPING_INDICATORS TABLE RLS
-- ============================================

-- Drop old typing_indicators policies
DROP POLICY IF EXISTS "Users can view typing indicators for their conversations" ON "typing_indicators";
DROP POLICY IF EXISTS "Users can insert their own typing indicators" ON "typing_indicators";
DROP POLICY IF EXISTS "Users can update their own typing indicators" ON "typing_indicators";
DROP POLICY IF EXISTS "Users can delete their own typing indicators" ON "typing_indicators";

-- Create optimized typing_indicators policies
CREATE POLICY "Users can view typing indicators for their conversations"
  ON "typing_indicators" FOR SELECT
  USING (
    -- For DM conversations (conversationId is userId)
    "conversationId" = (SELECT auth.uid())::text
    OR "userId" = (SELECT auth.uid())::text
    OR EXISTS (
      -- For group conversations (conversationId is groupId)
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "typing_indicators"."conversationId"
        AND "GroupMember"."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "Users can insert their own typing indicators"
  ON "typing_indicators" FOR INSERT
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own typing indicators"
  ON "typing_indicators" FOR UPDATE
  USING ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can delete their own typing indicators"
  ON "typing_indicators" FOR DELETE
  USING ("userId" = (SELECT auth.uid())::text);

-- ============================================
-- VALIDATION & SUMMARY
-- ============================================

DO $$
DECLARE
  message_policies int;
  presence_policies int;
  device_policies int;
  read_status_policies int;
  typing_policies int;
BEGIN
  -- Count policies for each table
  SELECT COUNT(*) INTO message_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'Message';
  
  SELECT COUNT(*) INTO presence_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_presence';
  
  SELECT COUNT(*) INTO device_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'device_sessions';
  
  SELECT COUNT(*) INTO read_status_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'message_read_status';
  
  SELECT COUNT(*) INTO typing_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'typing_indicators';

  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ RLS PERFORMANCE OPTIMIZATIONS APPLIED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Policy Counts (After Optimization):';
  RAISE NOTICE '  • Message table: % policies', message_policies;
  RAISE NOTICE '  • user_presence: % policies', presence_policies;
  RAISE NOTICE '  • device_sessions: % policies', device_policies;
  RAISE NOTICE '  • message_read_status: % policies', read_status_policies;
  RAISE NOTICE '  • typing_indicators: % policies', typing_policies;
  RAISE NOTICE '';
  RAISE NOTICE 'Optimizations Applied:';
  RAISE NOTICE '  ✅ All auth.uid() wrapped in (SELECT auth.uid())';
  RAISE NOTICE '  ✅ Multiple SELECT policies combined into single policies';
  RAISE NOTICE '  ✅ Eliminated row-by-row re-evaluation of auth functions';
  RAISE NOTICE '  ✅ Improved query performance at scale';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Results:';
  RAISE NOTICE '  ✅ 0 auth_rls_initplan warnings';
  RAISE NOTICE '  ✅ 0 multiple_permissive_policies warnings';
  RAISE NOTICE '  ✅ Faster query execution for large datasets';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Run Supabase Database Linter again';
  RAISE NOTICE '  2. Verify all warnings are resolved';
  RAISE NOTICE '  3. Test app functionality to ensure RLS works correctly';
  RAISE NOTICE '================================================';
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
