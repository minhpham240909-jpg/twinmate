-- ==========================================
-- CLEANUP DUPLICATE RLS POLICIES
-- Run this FIRST before running other migrations
-- This removes all old policies to prevent duplicates
-- ==========================================

-- ==========================================
-- USER PAGE VISITS - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can insert own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can view own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can update own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Admins can view all page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "user_page_visits_select_policy" ON "user_page_visits";
DROP POLICY IF EXISTS "user_page_visits_insert_policy" ON "user_page_visits";
DROP POLICY IF EXISTS "user_page_visits_update_policy" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_insert_own" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_select" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_update_own" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_select_admin" ON "user_page_visits";

-- ==========================================
-- USER FEATURE USAGE - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can insert own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Users can view own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Admins can view all feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "user_feature_usage_select_policy" ON "user_feature_usage";
DROP POLICY IF EXISTS "user_feature_usage_insert_policy" ON "user_feature_usage";
DROP POLICY IF EXISTS "feature_usage_insert_own" ON "user_feature_usage";
DROP POLICY IF EXISTS "feature_usage_select" ON "user_feature_usage";
DROP POLICY IF EXISTS "feature_usage_select_admin" ON "user_feature_usage";

-- ==========================================
-- USER SEARCH QUERIES - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can insert own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can view own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can update own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Admins can view all search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "user_search_queries_select_policy" ON "user_search_queries";
DROP POLICY IF EXISTS "user_search_queries_insert_policy" ON "user_search_queries";
DROP POLICY IF EXISTS "user_search_queries_update_policy" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_insert_own" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_select" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_update_own" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_select_admin" ON "user_search_queries";

-- ==========================================
-- USER SESSION ANALYTICS - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can insert own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can view own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can update own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Admins can view all session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "user_session_analytics_select_policy" ON "user_session_analytics";
DROP POLICY IF EXISTS "user_session_analytics_insert_policy" ON "user_session_analytics";
DROP POLICY IF EXISTS "user_session_analytics_update_policy" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_insert_own" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_select" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_update_own" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_select_admin" ON "user_session_analytics";

-- ==========================================
-- SUSPICIOUS ACTIVITY LOGS - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Admins can view suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Admins can update suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Service role can insert suspicious activity" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_activity_logs_select_policy" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_activity_logs_update_policy" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_logs_select_admin" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_logs_update_admin" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_logs_insert_service" ON "suspicious_activity_logs";

-- ==========================================
-- USER ACTIVITY SUMMARIES - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can view own activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Service role can manage activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Admins can view all activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "user_activity_summaries_select_policy" ON "user_activity_summaries";
DROP POLICY IF EXISTS "activity_summaries_select" ON "user_activity_summaries";
DROP POLICY IF EXISTS "activity_summaries_select_admin" ON "user_activity_summaries";

-- ==========================================
-- AI USER MEMORY - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can view own memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Users can insert own memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Users can update own memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Service role can manage user memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Admins can view all user memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "ai_user_memory_select_policy" ON "ai_user_memory";
DROP POLICY IF EXISTS "ai_user_memory_insert_policy" ON "ai_user_memory";
DROP POLICY IF EXISTS "ai_user_memory_update_policy" ON "ai_user_memory";

-- ==========================================
-- AI MEMORY ENTRIES - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can view own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Users can insert own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Users can update own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Users can delete own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Service role can manage memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Admins can view all memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_select_policy" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_insert_policy" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_update_policy" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_delete_policy" ON "ai_memory_entries";

-- ==========================================
-- Now create the CORRECT policies (one per action)
-- Using (select auth.uid()) for performance
-- ==========================================

-- ==========================================
-- USER PAGE VISITS POLICIES
-- ==========================================
CREATE POLICY "user_page_visits_select_policy"
  ON "user_page_visits" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "user_page_visits_insert_policy"
  ON "user_page_visits" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "user_page_visits_update_policy"
  ON "user_page_visits" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- USER FEATURE USAGE POLICIES
-- ==========================================
CREATE POLICY "user_feature_usage_select_policy"
  ON "user_feature_usage" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "user_feature_usage_insert_policy"
  ON "user_feature_usage" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- ==========================================
-- USER SEARCH QUERIES POLICIES
-- ==========================================
CREATE POLICY "user_search_queries_select_policy"
  ON "user_search_queries" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "user_search_queries_insert_policy"
  ON "user_search_queries" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "user_search_queries_update_policy"
  ON "user_search_queries" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- USER SESSION ANALYTICS POLICIES
-- ==========================================
CREATE POLICY "user_session_analytics_select_policy"
  ON "user_session_analytics" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "user_session_analytics_insert_policy"
  ON "user_session_analytics" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "user_session_analytics_update_policy"
  ON "user_session_analytics" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- SUSPICIOUS ACTIVITY LOGS POLICIES
-- ==========================================
CREATE POLICY "suspicious_activity_logs_select_policy"
  ON "suspicious_activity_logs" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "suspicious_activity_logs_update_policy"
  ON "suspicious_activity_logs" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- ==========================================
-- USER ACTIVITY SUMMARIES POLICIES
-- ==========================================
CREATE POLICY "user_activity_summaries_select_policy"
  ON "user_activity_summaries" FOR SELECT
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
-- AI USER MEMORY POLICIES
-- ==========================================
CREATE POLICY "ai_user_memory_select_policy"
  ON "ai_user_memory" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "ai_user_memory_insert_policy"
  ON "ai_user_memory" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "ai_user_memory_update_policy"
  ON "ai_user_memory" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- AI MEMORY ENTRIES POLICIES
-- ==========================================
CREATE POLICY "ai_memory_entries_select_policy"
  ON "ai_memory_entries" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

CREATE POLICY "ai_memory_entries_insert_policy"
  ON "ai_memory_entries" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "ai_memory_entries_update_policy"
  ON "ai_memory_entries" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

CREATE POLICY "ai_memory_entries_delete_policy"
  ON "ai_memory_entries" FOR DELETE
  USING ((select auth.uid())::text = "userId");
