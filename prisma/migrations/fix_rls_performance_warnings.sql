-- ============================================================================
-- FIX RLS PERFORMANCE WARNINGS
-- ============================================================================
-- This SQL fixes two types of performance warnings:
-- 1. auth_rls_initplan: Using (select auth.uid()) instead of auth.uid()
-- 2. multiple_permissive_policies: Remove duplicate old policies
--
-- Run this SQL in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES ON AI PARTNER TABLES
-- ============================================================================

-- AIPartnerSession - Drop ALL policies
DROP POLICY IF EXISTS "Users can view their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Users can insert their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Users can update their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Users can delete their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Service role has full access to AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "session_select_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "session_insert_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "session_update_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "session_delete_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_select" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_insert" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_update" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_delete" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_service" ON "AIPartnerSession";

-- AIPartnerMessage - Drop ALL policies
DROP POLICY IF EXISTS "Users can view messages in their sessions" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "Users can insert messages in their sessions" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "Service role has full access to AI partner messages" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_select_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_insert_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_update_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_delete_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_select" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_insert" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_service" ON "AIPartnerMessage";

-- AIPartnerPersona - Drop ALL policies
DROP POLICY IF EXISTS "Anyone can view active AI partner personas" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "Admins can manage AI partner personas" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "Service role has full access to AI partner personas" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_select_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_insert_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_update_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_delete_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "ai_persona_select" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "ai_persona_admin_manage" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "ai_persona_service" ON "AIPartnerPersona";

-- ai_user_memory - Drop ALL policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_user_memory') THEN
        DROP POLICY IF EXISTS "Users can view their own AI memory" ON "ai_user_memory";
        DROP POLICY IF EXISTS "Users can manage their own AI memory" ON "ai_user_memory";
        DROP POLICY IF EXISTS "Service role has full access to AI memory" ON "ai_user_memory";
        DROP POLICY IF EXISTS "ai_memory_select" ON "ai_user_memory";
        DROP POLICY IF EXISTS "ai_memory_manage" ON "ai_user_memory";
        DROP POLICY IF EXISTS "ai_memory_service" ON "ai_user_memory";
    END IF;
END $$;

-- ai_memory_entries - Drop ALL policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memory_entries') THEN
        DROP POLICY IF EXISTS "Users can view their own memory entries" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "Users can manage their own memory entries" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "Service role has full access to memory entries" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "ai_memory_entry_select" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "ai_memory_entry_manage" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "ai_memory_entry_service" ON "ai_memory_entries";
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CREATE OPTIMIZED POLICIES FOR AIPartnerSession
-- ============================================================================

-- Enable RLS
ALTER TABLE "AIPartnerSession" ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own sessions, admins can view all
CREATE POLICY "ai_session_select"
ON "AIPartnerSession"
FOR SELECT
TO authenticated
USING (
    "userId" = (select auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Users can only insert their own sessions
CREATE POLICY "ai_session_insert"
ON "AIPartnerSession"
FOR INSERT
TO authenticated
WITH CHECK (
    "userId" = (select auth.uid())::text
);

-- UPDATE: Users can only update their own sessions
CREATE POLICY "ai_session_update"
ON "AIPartnerSession"
FOR UPDATE
TO authenticated
USING ("userId" = (select auth.uid())::text)
WITH CHECK ("userId" = (select auth.uid())::text);

-- DELETE: Users can only delete their own sessions
CREATE POLICY "ai_session_delete"
ON "AIPartnerSession"
FOR DELETE
TO authenticated
USING ("userId" = (select auth.uid())::text);

-- Service role bypass (for backend API)
CREATE POLICY "ai_session_service"
ON "AIPartnerSession"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: CREATE OPTIMIZED POLICIES FOR AIPartnerMessage
-- ============================================================================

-- Enable RLS
ALTER TABLE "AIPartnerMessage" ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view messages from their own sessions
CREATE POLICY "ai_message_select"
ON "AIPartnerMessage"
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM "AIPartnerSession"
        WHERE "AIPartnerSession".id = "AIPartnerMessage"."sessionId"
        AND "AIPartnerSession"."userId" = (select auth.uid())::text
    )
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Users can only insert messages in their own sessions
CREATE POLICY "ai_message_insert"
ON "AIPartnerMessage"
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "AIPartnerSession"
        WHERE "AIPartnerSession".id = "AIPartnerMessage"."sessionId"
        AND "AIPartnerSession"."userId" = (select auth.uid())::text
    )
);

-- Service role bypass
CREATE POLICY "ai_message_service"
ON "AIPartnerMessage"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 4: CREATE OPTIMIZED POLICIES FOR AIPartnerPersona
-- ============================================================================

-- Enable RLS
ALTER TABLE "AIPartnerPersona" ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone authenticated can view active personas, admins see all
CREATE POLICY "ai_persona_select"
ON "AIPartnerPersona"
FOR SELECT
TO authenticated
USING (
    "isActive" = true
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Only admins
CREATE POLICY "ai_persona_insert"
ON "AIPartnerPersona"
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- UPDATE: Only admins
CREATE POLICY "ai_persona_update"
ON "AIPartnerPersona"
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- DELETE: Only admins
CREATE POLICY "ai_persona_delete"
ON "AIPartnerPersona"
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- Service role bypass
CREATE POLICY "ai_persona_service"
ON "AIPartnerPersona"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 5: CREATE OPTIMIZED POLICIES FOR AI MEMORY TABLES (if they exist)
-- ============================================================================

-- ai_user_memory
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_user_memory') THEN
        ALTER TABLE "ai_user_memory" ENABLE ROW LEVEL SECURITY;

        -- SELECT: Users can only view their own memory
        EXECUTE 'CREATE POLICY "ai_memory_select"
        ON "ai_user_memory"
        FOR SELECT
        TO authenticated
        USING ("userId" = (select auth.uid())::text)';

        -- INSERT: Users can only insert their own memory
        EXECUTE 'CREATE POLICY "ai_memory_insert"
        ON "ai_user_memory"
        FOR INSERT
        TO authenticated
        WITH CHECK ("userId" = (select auth.uid())::text)';

        -- UPDATE: Users can only update their own memory
        EXECUTE 'CREATE POLICY "ai_memory_update"
        ON "ai_user_memory"
        FOR UPDATE
        TO authenticated
        USING ("userId" = (select auth.uid())::text)
        WITH CHECK ("userId" = (select auth.uid())::text)';

        -- DELETE: Users can only delete their own memory
        EXECUTE 'CREATE POLICY "ai_memory_delete"
        ON "ai_user_memory"
        FOR DELETE
        TO authenticated
        USING ("userId" = (select auth.uid())::text)';

        -- Service role bypass
        EXECUTE 'CREATE POLICY "ai_memory_service"
        ON "ai_user_memory"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)';

        RAISE NOTICE 'Created ai_user_memory policies';
    ELSE
        RAISE NOTICE 'Table ai_user_memory does not exist, skipping';
    END IF;
END $$;

-- ai_memory_entries
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memory_entries') THEN
        ALTER TABLE "ai_memory_entries" ENABLE ROW LEVEL SECURITY;

        -- SELECT: Users can only view their own entries
        EXECUTE 'CREATE POLICY "ai_memory_entry_select"
        ON "ai_memory_entries"
        FOR SELECT
        TO authenticated
        USING ("userId" = (select auth.uid())::text)';

        -- INSERT: Users can only insert their own entries
        EXECUTE 'CREATE POLICY "ai_memory_entry_insert"
        ON "ai_memory_entries"
        FOR INSERT
        TO authenticated
        WITH CHECK ("userId" = (select auth.uid())::text)';

        -- UPDATE: Users can only update their own entries
        EXECUTE 'CREATE POLICY "ai_memory_entry_update"
        ON "ai_memory_entries"
        FOR UPDATE
        TO authenticated
        USING ("userId" = (select auth.uid())::text)
        WITH CHECK ("userId" = (select auth.uid())::text)';

        -- DELETE: Users can only delete their own entries
        EXECUTE 'CREATE POLICY "ai_memory_entry_delete"
        ON "ai_memory_entries"
        FOR DELETE
        TO authenticated
        USING ("userId" = (select auth.uid())::text)';

        -- Service role bypass
        EXECUTE 'CREATE POLICY "ai_memory_entry_service"
        ON "ai_memory_entries"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)';

        RAISE NOTICE 'Created ai_memory_entries policies';
    ELSE
        RAISE NOTICE 'Table ai_memory_entries does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: VERIFY POLICIES
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Check AIPartnerSession (should be 5 policies)
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'AIPartnerSession' AND schemaname = 'public';
    RAISE NOTICE 'AIPartnerSession has % policies (expected: 5)', policy_count;

    -- Check AIPartnerMessage (should be 3 policies)
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'AIPartnerMessage' AND schemaname = 'public';
    RAISE NOTICE 'AIPartnerMessage has % policies (expected: 3)', policy_count;

    -- Check AIPartnerPersona (should be 5 policies)
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'AIPartnerPersona' AND schemaname = 'public';
    RAISE NOTICE 'AIPartnerPersona has % policies (expected: 5)', policy_count;
END $$;

-- ============================================================================
-- STEP 7: ANALYZE TABLES FOR PERFORMANCE
-- ============================================================================

ANALYZE "AIPartnerSession";
ANALYZE "AIPartnerMessage";
ANALYZE "AIPartnerPersona";

-- ============================================================================
-- COMPLETE
-- ============================================================================
--
-- Changes made:
-- 1. Dropped ALL old policies (both new and legacy named ones)
-- 2. Created new policies with (select auth.uid()) instead of auth.uid()
-- 3. Used TO authenticated/service_role instead of generic USING(auth.role())
-- 4. Split policies by action (SELECT, INSERT, UPDATE, DELETE) to avoid overlaps
-- 5. Used simpler service_role policy: USING(true) WITH CHECK(true)
--
-- Policy counts per table:
-- - AIPartnerSession: 5 (select, insert, update, delete, service)
-- - AIPartnerMessage: 3 (select, insert, service)
-- - AIPartnerPersona: 5 (select, insert, update, delete, service)
-- - ai_user_memory: 5 (if exists)
-- - ai_memory_entries: 5 (if exists)
--
-- This should eliminate all performance warnings related to:
-- - auth_rls_initplan (re-evaluation of auth functions)
-- - multiple_permissive_policies (duplicate policies)
--
-- ============================================================================
