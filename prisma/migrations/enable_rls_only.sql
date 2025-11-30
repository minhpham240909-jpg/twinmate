-- Enable RLS on Activity Tracking Tables (PERFORMANCE OPTIMIZED)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/zuukijevgtcfsgylbsqj/sql
--
-- Optimizations applied:
-- 1. auth.uid() wrapped in (select ...) to prevent per-row re-evaluation
-- 2. Multiple SELECT policies merged into single policies with OR conditions
-- 3. Policies scoped to specific roles (authenticated, service_role)

-- ==========================================
-- ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE IF EXISTS "user_page_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "user_feature_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "user_search_queries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "user_session_analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "suspicious_activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "user_activity_summaries" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- DROP ALL EXISTING POLICIES FIRST
-- ==========================================

-- user_page_visits
DROP POLICY IF EXISTS "Users can insert own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can view own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can update own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Admins can view all page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_insert_own" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_select" ON "user_page_visits";
DROP POLICY IF EXISTS "page_visits_update_own" ON "user_page_visits";

-- user_feature_usage
DROP POLICY IF EXISTS "Users can insert own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Users can view own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Admins can view all feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "feature_usage_insert_own" ON "user_feature_usage";
DROP POLICY IF EXISTS "feature_usage_select" ON "user_feature_usage";

-- user_search_queries
DROP POLICY IF EXISTS "Users can insert own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can view own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can update own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Admins can view all search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_insert_own" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_select" ON "user_search_queries";
DROP POLICY IF EXISTS "search_queries_update_own" ON "user_search_queries";

-- user_session_analytics
DROP POLICY IF EXISTS "Users can insert own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can view own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can update own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Admins can view all session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_insert_own" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_select" ON "user_session_analytics";
DROP POLICY IF EXISTS "session_analytics_update_own" ON "user_session_analytics";

-- suspicious_activity_logs
DROP POLICY IF EXISTS "Admins can view suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Admins can update suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Service role can insert suspicious activity" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_logs_select_admin" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_logs_update_admin" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_logs_insert_service" ON "suspicious_activity_logs";

-- user_activity_summaries
DROP POLICY IF EXISTS "Users can view own activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Service role can manage activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Admins can view all activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "activity_summaries_select" ON "user_activity_summaries";
DROP POLICY IF EXISTS "activity_summaries_all_service" ON "user_activity_summaries";

-- ==========================================
-- USER PAGE VISITS - OPTIMIZED POLICIES
-- ==========================================

-- INSERT: Users can insert their own records
CREATE POLICY "page_visits_insert_own"
  ON "user_page_visits" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy (users see own OR admins see all)
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
-- USER FEATURE USAGE - OPTIMIZED POLICIES
-- ==========================================

-- INSERT: Users can insert their own records
CREATE POLICY "feature_usage_insert_own"
  ON "user_feature_usage" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy (users see own OR admins see all)
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
-- USER SEARCH QUERIES - OPTIMIZED POLICIES
-- ==========================================

-- INSERT: Users can insert their own records
CREATE POLICY "search_queries_insert_own"
  ON "user_search_queries" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy (users see own OR admins see all)
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
-- USER SESSION ANALYTICS - OPTIMIZED POLICIES
-- ==========================================

-- INSERT: Users can insert their own records
CREATE POLICY "session_analytics_insert_own"
  ON "user_session_analytics" FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

-- SELECT: Combined policy (users see own OR admins see all)
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
-- SUSPICIOUS ACTIVITY LOGS - OPTIMIZED POLICIES
-- ==========================================

-- SELECT: Only admins can view
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
-- USER ACTIVITY SUMMARIES - OPTIMIZED POLICIES
-- ==========================================

-- SELECT: Combined (users see own OR admins see all)
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
-- GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON "user_page_visits" TO service_role;
GRANT ALL ON "user_feature_usage" TO service_role;
GRANT ALL ON "user_search_queries" TO service_role;
GRANT ALL ON "user_session_analytics" TO service_role;
GRANT ALL ON "suspicious_activity_logs" TO service_role;
GRANT ALL ON "user_activity_summaries" TO service_role;

GRANT SELECT, INSERT, UPDATE ON "user_page_visits" TO authenticated;
GRANT SELECT, INSERT ON "user_feature_usage" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "user_search_queries" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "user_session_analytics" TO authenticated;
GRANT SELECT ON "suspicious_activity_logs" TO authenticated;
GRANT SELECT ON "user_activity_summaries" TO authenticated;

-- ==========================================
-- VERIFICATION
-- ==========================================

SELECT 'RLS policies applied successfully with performance optimizations!' as status;
