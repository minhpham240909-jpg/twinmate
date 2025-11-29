-- =====================================================
-- FIX RLS WARNINGS - Supabase Database Linter
-- Run this in Supabase SQL Editor
-- =====================================================
-- Based on actual Prisma schema column names

-- =====================================================
-- 1. FIX MULTIPLE PERMISSIVE POLICIES ON "Group" TABLE
-- Consolidate 3 policies into 1 combined policy
-- =====================================================

-- Drop existing overlapping SELECT policies
DROP POLICY IF EXISTS "Users can view groups" ON "Group";
DROP POLICY IF EXISTS "Users can view public groups" ON "Group";
DROP POLICY IF EXISTS "Users can view their own deleted groups" ON "Group";

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view groups - consolidated" ON "Group"
FOR SELECT
TO authenticated
USING (
  -- User is a member of the group
  EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "GroupMember"."groupId" = "Group".id
    AND "GroupMember"."userId" = auth.uid()::text
  )
  OR
  -- Group is public (not deleted)
  (privacy = 'PUBLIC' AND "isDeleted" = false)
  OR
  -- User is the owner of the group
  ("ownerId" = auth.uid()::text)
);

-- =====================================================
-- 2. FIX MULTIPLE PERMISSIVE POLICIES ON "GroupInvite" TABLE
-- =====================================================

-- Drop existing overlapping SELECT policies
DROP POLICY IF EXISTS "Users can view group invites" ON "GroupInvite";
DROP POLICY IF EXISTS "authenticated_groupinvite_access" ON "GroupInvite";

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view group invites - consolidated" ON "GroupInvite"
FOR SELECT
TO authenticated
USING (
  -- User is the invitee
  "inviteeId" = auth.uid()::text
  OR
  -- User is the inviter
  "inviterId" = auth.uid()::text
  OR
  -- User is admin/owner of the group
  EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "GroupMember"."groupId" = "GroupInvite"."groupId"
    AND "GroupMember"."userId" = auth.uid()::text
    AND "GroupMember"."role" IN ('OWNER', 'ADMIN')
  )
);

-- =====================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES ON "GroupMember" TABLE
-- =====================================================

-- Drop existing overlapping SELECT policies
DROP POLICY IF EXISTS "Users can view and manage group members" ON "GroupMember";
DROP POLICY IF EXISTS "Users can view group memberships" ON "GroupMember";

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view group members - consolidated" ON "GroupMember"
FOR SELECT
TO authenticated
USING (
  -- User is viewing their own membership
  "userId" = auth.uid()::text
  OR
  -- User is a member of the same group
  EXISTS (
    SELECT 1 FROM "GroupMember" AS gm2
    WHERE gm2."groupId" = "GroupMember"."groupId"
    AND gm2."userId" = auth.uid()::text
  )
  OR
  -- Group is public
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group".id = "GroupMember"."groupId"
    AND "Group".privacy = 'PUBLIC'
    AND "Group"."isDeleted" = false
  )
);

-- =====================================================
-- 4. FIX MULTIPLE PERMISSIVE POLICIES ON "Message" TABLE
-- =====================================================

-- Drop existing overlapping SELECT policies
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON "Message";
DROP POLICY IF EXISTS "Users can view their messages" ON "Message";
DROP POLICY IF EXISTS "Users can view their own deleted messages" ON "Message";

-- Create single consolidated SELECT policy
CREATE POLICY "Users can view messages - consolidated" ON "Message"
FOR SELECT
TO authenticated
USING (
  -- User is the sender
  "senderId" = auth.uid()::text
  OR
  -- User is the recipient (for DMs)
  "recipientId" = auth.uid()::text
  OR
  -- User is a member of the group (for group messages)
  (
    "groupId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "Message"."groupId"
      AND "GroupMember"."userId" = auth.uid()::text
    )
  )
);

-- =====================================================
-- 5. FIX FUNCTION SEARCH PATH - search_chunks
-- =====================================================

-- Check if the function exists and recreate with fixed search_path
-- Skip this if you don't have this function or it errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_chunks') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.search_chunks(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.78,
        match_count int DEFAULT 10
      )
      RETURNS TABLE (
        id uuid,
        content text,
        metadata jsonb,
        similarity float
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $func$
      BEGIN
        RETURN QUERY
        SELECT
          c.id,
          c.content,
          c.metadata,
          1 - (c.embedding <=> query_embedding) AS similarity
        FROM "DocumentChunk" c
        WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
        ORDER BY c.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $func$;
    ';
  END IF;
END $$;

-- =====================================================
-- 6. FIX MATERIALIZED VIEWS IN API
-- Revoke direct access (recommended for security)
-- =====================================================

-- Revoke access from anon/authenticated roles
-- These will only error if the view doesn't exist, which is fine
DO $$ BEGIN
  REVOKE SELECT ON public.mv_user_notification_counts FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE SELECT ON public.mv_user_stats FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE SELECT ON public.mv_match_stats FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE SELECT ON public.mv_session_stats FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE SELECT ON public.mv_user_match_counts FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE SELECT ON public.mv_online_users FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- =====================================================
-- 7. VERIFY CHANGES
-- =====================================================

-- Check policies on Group table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'Group';

-- Check policies on GroupInvite table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'GroupInvite';

-- Check policies on GroupMember table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'GroupMember';

-- Check policies on Message table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'Message';

-- =====================================================
-- NOTE: LEAKED PASSWORD PROTECTION
-- =====================================================
-- This setting is in Supabase Dashboard, not SQL:
-- 1. Go to Authentication > Settings
-- 2. Scroll to "Password Settings"
-- 3. Enable "Leaked password protection"
-- =====================================================
