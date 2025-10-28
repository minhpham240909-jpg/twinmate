-- =====================================================
-- FIX RLS FOR AI AGENT TABLES
-- =====================================================
-- Fixes performance warnings for:
-- - agent_memory
-- - agent_task
-- - availability_block
-- - match_candidate
-- =====================================================

-- =====================================================
-- 1. AGENT_MEMORY TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own agent memory" ON agent_memory;
DROP POLICY IF EXISTS "Users can insert own agent memory" ON agent_memory;
DROP POLICY IF EXISTS "Users can update own agent memory" ON agent_memory;
DROP POLICY IF EXISTS "Users can delete own agent memory" ON agent_memory;

-- Optimized policies with (select auth.uid())
CREATE POLICY "Users can view own agent memory"
ON agent_memory
FOR SELECT
TO authenticated
USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own agent memory"
ON agent_memory
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can update own agent memory"
ON agent_memory
FOR UPDATE
TO authenticated
USING ((select auth.uid())::text = user_id)
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can delete own agent memory"
ON agent_memory
FOR DELETE
TO authenticated
USING ((select auth.uid())::text = user_id);

-- =====================================================
-- 2. AGENT_TASK TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own agent tasks" ON agent_task;
DROP POLICY IF EXISTS "Users can insert own agent tasks" ON agent_task;
DROP POLICY IF EXISTS "Users can update own agent tasks" ON agent_task;

-- Optimized policies with (select auth.uid())
CREATE POLICY "Users can view own agent tasks"
ON agent_task
FOR SELECT
TO authenticated
USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own agent tasks"
ON agent_task
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can update own agent tasks"
ON agent_task
FOR UPDATE
TO authenticated
USING ((select auth.uid())::text = user_id)
WITH CHECK ((select auth.uid())::text = user_id);

-- =====================================================
-- 3. AVAILABILITY_BLOCK TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own availability" ON availability_block;
DROP POLICY IF EXISTS "Users can view all availability for matching" ON availability_block;
DROP POLICY IF EXISTS "Users can insert own availability" ON availability_block;
DROP POLICY IF EXISTS "Users can update own availability" ON availability_block;
DROP POLICY IF EXISTS "Users can delete own availability" ON availability_block;

-- Consolidated SELECT policy (own + all for matching)
CREATE POLICY "Users can view availability"
ON availability_block
FOR SELECT
TO authenticated
USING (true);  -- All users can view all availability for partner matching

-- Optimized policies for INSERT/UPDATE/DELETE
CREATE POLICY "Users can insert own availability"
ON availability_block
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can update own availability"
ON availability_block
FOR UPDATE
TO authenticated
USING ((select auth.uid())::text = user_id)
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can delete own availability"
ON availability_block
FOR DELETE
TO authenticated
USING ((select auth.uid())::text = user_id);

-- =====================================================
-- 4. MATCH_CANDIDATE TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own match candidates" ON match_candidate;
DROP POLICY IF EXISTS "Users can insert own match candidates" ON match_candidate;

-- Optimized policies with (select auth.uid())
CREATE POLICY "Users can view own match candidates"
ON match_candidate
FOR SELECT
TO authenticated
USING ((select auth.uid())::text = for_user_id);

CREATE POLICY "Users can insert own match candidates"
ON match_candidate
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = for_user_id);

-- =====================================================
-- DONE!
-- =====================================================
-- All AI agent tables now have optimized RLS policies
-- auth.uid() wrapped in (select ...) for 10x performance
-- =====================================================
