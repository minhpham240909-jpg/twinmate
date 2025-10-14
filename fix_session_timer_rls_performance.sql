-- ============================================
-- Fix SessionTimer RLS Performance Issues
-- Created: 2025-10-10
-- Purpose: Optimize RLS policies to prevent auth.uid() re-evaluation per row
-- ============================================

-- Drop ALL existing policies on SessionTimer
DROP POLICY IF EXISTS "Users can view timer for their sessions" ON "SessionTimer";
DROP POLICY IF EXISTS "Hosts can create timer for their sessions" ON "SessionTimer";
DROP POLICY IF EXISTS "Participants can update timer for their sessions" ON "SessionTimer";
DROP POLICY IF EXISTS "Hosts can delete timer for their sessions" ON "SessionTimer";

-- ============================================
-- Helper function to cache auth.uid() - COMPLETELY eliminates re-evaluation
-- Created in public schema (we don't have permission for auth schema)
-- SECURITY DEFINER ensures it runs with elevated privileges to access auth.uid()
-- STABLE tells Postgres the result won't change within a single query
-- Note: This function may already exist from other migrations, so we use CREATE OR REPLACE
-- ============================================
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()::text;
$$;

-- ============================================
-- OPTIMIZED Policy 1: Users can view timers for sessions they are participating in
-- Uses helper function to cache auth.uid() ONCE per query
-- ============================================
CREATE POLICY "Users can view timer for their sessions"
  ON "SessionTimer"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionTimer"."sessionId"
        AND "SessionParticipant"."userId" = public.get_current_user_id()
    )
  );

-- ============================================
-- OPTIMIZED Policy 2: Session hosts can create timers for their sessions
-- Uses helper function to cache auth.uid() ONCE per query
-- ============================================
CREATE POLICY "Hosts can create timer for their sessions"
  ON "SessionTimer"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionTimer"."sessionId"
        AND "StudySession"."createdBy" = public.get_current_user_id()
    )
  );

-- ============================================
-- OPTIMIZED Policy 3: Session participants can update timers (for controls)
-- Uses helper function to cache auth.uid() ONCE per query
-- ============================================
CREATE POLICY "Participants can update timer for their sessions"
  ON "SessionTimer"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionTimer"."sessionId"
        AND "SessionParticipant"."userId" = public.get_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionTimer"."sessionId"
        AND "SessionParticipant"."userId" = public.get_current_user_id()
    )
  );

-- ============================================
-- OPTIMIZED Policy 4: Session hosts can delete timers
-- Uses helper function to cache auth.uid() ONCE per query
-- ============================================
CREATE POLICY "Hosts can delete timer for their sessions"
  ON "SessionTimer"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionTimer"."sessionId"
        AND "StudySession"."createdBy" = public.get_current_user_id()
    )
  );
