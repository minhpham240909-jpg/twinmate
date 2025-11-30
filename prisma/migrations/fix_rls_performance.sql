-- ==========================================
-- FIX RLS PERFORMANCE WARNINGS
-- ==========================================
-- This migration fixes two types of performance issues:
-- 1. auth_rls_initplan: Optimizes auth.uid() calls by wrapping in SELECT
-- 2. multiple_permissive_policies: Merges duplicate policies into single policies

-- ==========================================
-- PART 1: FIX Profile TABLE - MERGE DUPLICATE POLICIES
-- ==========================================

-- Drop the separate location policies (we'll merge them into existing profile policies)
DROP POLICY IF EXISTS "Users can view their own location" ON "Profile";
DROP POLICY IF EXISTS "Users can update their own location" ON "Profile";

-- Drop existing profile policies (we'll recreate them optimized)
DROP POLICY IF EXISTS "Users can view all profiles" ON "Profile";
DROP POLICY IF EXISTS "Users can update their own profile" ON "Profile";

-- Recreate optimized profile policies (merged with location access)
CREATE POLICY "Users can view all profiles"
ON "Profile" FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON "Profile" FOR UPDATE
USING ((select auth.uid())::text = "userId");

-- ==========================================
-- PART 2: FIX SessionNote POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view notes for their sessions" ON "SessionNote";
DROP POLICY IF EXISTS "Users can update notes for their sessions" ON "SessionNote";
DROP POLICY IF EXISTS "Session hosts can insert notes" ON "SessionNote";
DROP POLICY IF EXISTS "Session hosts can delete notes" ON "SessionNote";

CREATE POLICY "Users can view notes for their sessions"
ON "SessionNote" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
    AND "SessionParticipant"."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can update notes for their sessions"
ON "SessionNote" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
    AND "SessionParticipant"."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Session hosts can insert notes"
ON "SessionNote" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionNote"."sessionId"
    AND "StudySession"."createdBy" = (select auth.uid())::text
  )
);

CREATE POLICY "Session hosts can delete notes"
ON "SessionNote" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionNote"."sessionId"
    AND "StudySession"."createdBy" = (select auth.uid())::text
  )
);

-- ==========================================
-- PART 3: FIX SessionFlashcard POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can update their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON "SessionFlashcard";

CREATE POLICY "Users can view their own flashcards"
ON "SessionFlashcard" FOR SELECT
USING ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can insert their own flashcards"
ON "SessionFlashcard" FOR INSERT
WITH CHECK (
  "userId" = (select auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "SessionFlashcard"."sessionId"
    AND "SessionParticipant"."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can update their own flashcards"
ON "SessionFlashcard" FOR UPDATE
USING ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can delete their own flashcards"
ON "SessionFlashcard" FOR DELETE
USING ("userId" = (select auth.uid())::text);

-- ==========================================
-- PART 4: FIX UserSettings POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can insert own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can update own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can delete own settings" ON "UserSettings";

CREATE POLICY "Users can view own settings"
ON "UserSettings" FOR SELECT
USING ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can insert own settings"
ON "UserSettings" FOR INSERT
WITH CHECK ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can update own settings"
ON "UserSettings" FOR UPDATE
USING ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can delete own settings"
ON "UserSettings" FOR DELETE
USING ("userId" = (select auth.uid())::text);

-- ==========================================
-- PART 5: FIX BlockedUser POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own blocked users" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can block other users" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can unblock users" ON "BlockedUser";

CREATE POLICY "Users can view own blocked users"
ON "BlockedUser" FOR SELECT
USING ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can block other users"
ON "BlockedUser" FOR INSERT
WITH CHECK ("userId" = (select auth.uid())::text);

CREATE POLICY "Users can unblock users"
ON "BlockedUser" FOR DELETE
USING ("userId" = (select auth.uid())::text);

-- ==========================================
-- PART 6: FIX SessionWhiteboard POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view whiteboards for their sessions" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Users can update whiteboards for their sessions" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Session hosts can insert whiteboards" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Session hosts can delete whiteboards" ON "SessionWhiteboard";

CREATE POLICY "Users can view whiteboards for their sessions"
ON "SessionWhiteboard" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
    AND "SessionParticipant"."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can update whiteboards for their sessions"
ON "SessionWhiteboard" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
    AND "SessionParticipant"."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Session hosts can insert whiteboards"
ON "SessionWhiteboard" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
    AND "StudySession"."createdBy" = (select auth.uid())::text
  )
);

CREATE POLICY "Session hosts can delete whiteboards"
ON "SessionWhiteboard" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
    AND "StudySession"."createdBy" = (select auth.uid())::text
  )
);

-- ==========================================
-- PART 7: FIX SessionWhiteboardVersion POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view whiteboard versions for their sessions" ON "SessionWhiteboardVersion";
DROP POLICY IF EXISTS "Users can create whiteboard versions for their sessions" ON "SessionWhiteboardVersion";

CREATE POLICY "Users can view whiteboard versions for their sessions"
ON "SessionWhiteboardVersion" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionWhiteboard" wb
    INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
    WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can create whiteboard versions for their sessions"
ON "SessionWhiteboardVersion" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "SessionWhiteboard" wb
    INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
    WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
    AND sp."userId" = (select auth.uid())::text
  )
);

-- ==========================================
-- PART 8: FIX presence TABLE - MERGE DUPLICATE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can upsert own presence" ON "presence";
DROP POLICY IF EXISTS "Users can view and manage presence" ON "presence";

-- Create single optimized policy for presence
CREATE POLICY "Users can manage presence"
ON "presence" FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================
-- PART 9: FIX ACTIVITY TRACKING TABLES
-- ==========================================

-- ==========================================
-- USER PAGE VISITS - DROP & RECREATE OPTIMIZED
-- ==========================================

DROP POLICY IF EXISTS "Users can insert own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can view own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can update own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Admins can view all page visits" ON "user_page_visits";

-- INSERT: Users can insert their own records (optimized with select wrapper)
CREATE POLICY "page_visits_insert_own"
  ON "user_page_visits" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy for users viewing own OR admins viewing all
CREATE POLICY "page_visits_select"
  ON "user_page_visits" FOR SELECT TO authenticated
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- UPDATE: Users can update their own records
CREATE POLICY "page_visits_update_own"
  ON "user_page_visits" FOR UPDATE TO authenticated
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- USER FEATURE USAGE - DROP & RECREATE OPTIMIZED
-- ==========================================

DROP POLICY IF EXISTS "Users can insert own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Users can view own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Admins can view all feature usage" ON "user_feature_usage";

-- INSERT: Users can insert their own records
CREATE POLICY "feature_usage_insert_own"
  ON "user_feature_usage" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy for users viewing own OR admins viewing all
CREATE POLICY "feature_usage_select"
  ON "user_feature_usage" FOR SELECT TO authenticated
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- ==========================================
-- USER SEARCH QUERIES - DROP & RECREATE OPTIMIZED
-- ==========================================

DROP POLICY IF EXISTS "Users can insert own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can view own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can update own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Admins can view all search queries" ON "user_search_queries";

-- INSERT: Users can insert their own records
CREATE POLICY "search_queries_insert_own"
  ON "user_search_queries" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy for users viewing own OR admins viewing all
CREATE POLICY "search_queries_select"
  ON "user_search_queries" FOR SELECT TO authenticated
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- UPDATE: Users can update their own records
CREATE POLICY "search_queries_update_own"
  ON "user_search_queries" FOR UPDATE TO authenticated
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- USER SESSION ANALYTICS - DROP & RECREATE OPTIMIZED
-- ==========================================

DROP POLICY IF EXISTS "Users can insert own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can view own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can update own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Admins can view all session analytics" ON "user_session_analytics";

-- INSERT: Users can insert their own records
CREATE POLICY "session_analytics_insert_own"
  ON "user_session_analytics" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy for users viewing own OR admins viewing all
CREATE POLICY "session_analytics_select"
  ON "user_session_analytics" FOR SELECT TO authenticated
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- UPDATE: Users can update their own records
CREATE POLICY "session_analytics_update_own"
  ON "user_session_analytics" FOR UPDATE TO authenticated
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- SUSPICIOUS ACTIVITY LOGS - DROP & RECREATE OPTIMIZED
-- ==========================================

DROP POLICY IF EXISTS "Admins can view suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Admins can update suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Service role can insert suspicious activity" ON "suspicious_activity_logs";

-- SELECT: Only admins can view (optimized)
CREATE POLICY "suspicious_logs_select_admin"
  ON "suspicious_activity_logs" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- UPDATE: Only admins can update (for review)
CREATE POLICY "suspicious_logs_update_admin"
  ON "suspicious_activity_logs" FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- INSERT: Service role only (system inserts via API)
CREATE POLICY "suspicious_logs_insert_service"
  ON "suspicious_activity_logs" FOR INSERT TO service_role
  WITH CHECK (true);

-- ==========================================
-- USER ACTIVITY SUMMARIES - DROP & RECREATE OPTIMIZED
-- ==========================================

DROP POLICY IF EXISTS "Users can view own activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Service role can manage activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Admins can view all activity summaries" ON "user_activity_summaries";

-- SELECT: Combined - users see own OR admins see all (single policy)
CREATE POLICY "activity_summaries_select"
  ON "user_activity_summaries" FOR SELECT TO authenticated
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- INSERT/UPDATE/DELETE: Service role only (system aggregation)
CREATE POLICY "activity_summaries_all_service"
  ON "user_activity_summaries" FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- VALIDATION
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE 'RLS performance optimization completed successfully!';
  RAISE NOTICE 'All auth.uid() calls now use (select auth.uid()) for better performance';
  RAISE NOTICE 'Duplicate policies have been merged into single policies with OR conditions';
END $$;
