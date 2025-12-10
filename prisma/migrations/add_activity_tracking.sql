-- User Activity Tracking Tables
-- Run this SQL to add activity tracking capabilities
-- Safe to run multiple times (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- Optimized for Supabase RLS performance (uses select auth.uid())

-- Page Visit Tracking
CREATE TABLE IF NOT EXISTS "user_page_visits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageName" TEXT,
    "referrer" TEXT,
    "sessionId" TEXT,
    "deviceId" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "query" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_page_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_page_visits_userId_idx" ON "user_page_visits"("userId");
CREATE INDEX IF NOT EXISTS "user_page_visits_path_idx" ON "user_page_visits"("path");
CREATE INDEX IF NOT EXISTS "user_page_visits_createdAt_idx" ON "user_page_visits"("createdAt");
CREATE INDEX IF NOT EXISTS "user_page_visits_userId_path_idx" ON "user_page_visits"("userId", "path");
CREATE INDEX IF NOT EXISTS "user_page_visits_userId_createdAt_idx" ON "user_page_visits"("userId", "createdAt");

-- Feature Usage Tracking
CREATE TABLE IF NOT EXISTS "user_feature_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feature_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_feature_usage_userId_idx" ON "user_feature_usage"("userId");
CREATE INDEX IF NOT EXISTS "user_feature_usage_feature_idx" ON "user_feature_usage"("feature");
CREATE INDEX IF NOT EXISTS "user_feature_usage_category_idx" ON "user_feature_usage"("category");
CREATE INDEX IF NOT EXISTS "user_feature_usage_createdAt_idx" ON "user_feature_usage"("createdAt");
CREATE INDEX IF NOT EXISTS "user_feature_usage_userId_feature_idx" ON "user_feature_usage"("userId", "feature");
CREATE INDEX IF NOT EXISTS "user_feature_usage_userId_createdAt_idx" ON "user_feature_usage"("userId", "createdAt");

-- Search Query Tracking
CREATE TABLE IF NOT EXISTS "user_search_queries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "filters" JSONB,
    "resultCount" INTEGER,
    "clickedResults" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_search_queries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_search_queries_userId_idx" ON "user_search_queries"("userId");
CREATE INDEX IF NOT EXISTS "user_search_queries_searchType_idx" ON "user_search_queries"("searchType");
CREATE INDEX IF NOT EXISTS "user_search_queries_createdAt_idx" ON "user_search_queries"("createdAt");
CREATE INDEX IF NOT EXISTS "user_search_queries_userId_createdAt_idx" ON "user_search_queries"("userId", "createdAt");

-- User Session Analytics
CREATE TABLE IF NOT EXISTS "user_session_analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalDuration" INTEGER,
    "activeTime" INTEGER NOT NULL DEFAULT 0,
    "pagesVisited" INTEGER NOT NULL DEFAULT 0,
    "uniquePages" INTEGER NOT NULL DEFAULT 0,
    "featuresUsed" INTEGER NOT NULL DEFAULT 0,
    "searchesMade" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "postsCreated" INTEGER NOT NULL DEFAULT 0,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_session_analytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_session_analytics_sessionId_key" ON "user_session_analytics"("sessionId");
CREATE INDEX IF NOT EXISTS "user_session_analytics_userId_idx" ON "user_session_analytics"("userId");
CREATE INDEX IF NOT EXISTS "user_session_analytics_sessionId_idx" ON "user_session_analytics"("sessionId");
CREATE INDEX IF NOT EXISTS "user_session_analytics_startedAt_idx" ON "user_session_analytics"("startedAt");
CREATE INDEX IF NOT EXISTS "user_session_analytics_userId_startedAt_idx" ON "user_session_analytics"("userId", "startedAt");

-- Suspicious Activity Types Enum
DO $$ BEGIN
    CREATE TYPE "SuspiciousActivityType" AS ENUM (
        'RAPID_MESSAGING',
        'DUPLICATE_CONTENT',
        'MASS_CONNECTION_REQUESTS',
        'LOGIN_FROM_NEW_LOCATION',
        'MULTIPLE_FAILED_LOGINS',
        'PROFILE_SPAM',
        'UNUSUAL_SEARCH_PATTERN',
        'CONTENT_FLAGGED',
        'RAPID_REPORTING',
        'BULK_ACTIONS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Suspicious Activity Severity Enum
DO $$ BEGIN
    CREATE TYPE "SuspiciousActivitySeverity" AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Suspicious Activity Log
CREATE TABLE IF NOT EXISTS "suspicious_activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SuspiciousActivityType" NOT NULL,
    "severity" "SuspiciousActivitySeverity" NOT NULL DEFAULT 'LOW',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "detectedBy" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suspicious_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_userId_idx" ON "suspicious_activity_logs"("userId");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_type_idx" ON "suspicious_activity_logs"("type");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_severity_idx" ON "suspicious_activity_logs"("severity");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_isReviewed_idx" ON "suspicious_activity_logs"("isReviewed");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_createdAt_idx" ON "suspicious_activity_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_userId_type_idx" ON "suspicious_activity_logs"("userId", "type");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_severity_isReviewed_idx" ON "suspicious_activity_logs"("severity", "isReviewed");

-- User Activity Summary (daily aggregates)
CREATE TABLE IF NOT EXISTS "user_activity_summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "avgSessionLength" INTEGER NOT NULL DEFAULT 0,
    "totalPageViews" INTEGER NOT NULL DEFAULT 0,
    "uniquePageViews" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "postsCreated" INTEGER NOT NULL DEFAULT 0,
    "postsLiked" INTEGER NOT NULL DEFAULT 0,
    "commentsCreated" INTEGER NOT NULL DEFAULT 0,
    "connectionsSent" INTEGER NOT NULL DEFAULT 0,
    "connectionsAccepted" INTEGER NOT NULL DEFAULT 0,
    "groupsJoined" INTEGER NOT NULL DEFAULT 0,
    "sessionsJoined" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_activity_summaries_userId_date_key" ON "user_activity_summaries"("userId", "date");
CREATE INDEX IF NOT EXISTS "user_activity_summaries_userId_idx" ON "user_activity_summaries"("userId");
CREATE INDEX IF NOT EXISTS "user_activity_summaries_date_idx" ON "user_activity_summaries"("date");

-- ==========================================
-- FUNCTIONS: Auto-update updatedAt timestamp
-- ==========================================
CREATE OR REPLACE FUNCTION update_activity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS trigger_user_session_analytics_updated_at ON "user_session_analytics";
CREATE TRIGGER trigger_user_session_analytics_updated_at
    BEFORE UPDATE ON "user_session_analytics"
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_updated_at();

DROP TRIGGER IF EXISTS trigger_user_activity_summaries_updated_at ON "user_activity_summaries";
CREATE TRIGGER trigger_user_activity_summaries_updated_at
    BEFORE UPDATE ON "user_activity_summaries"
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all activity tracking tables
ALTER TABLE "user_page_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_feature_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_search_queries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_session_analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suspicious_activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_activity_summaries" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER PAGE VISITS POLICIES
-- Using (select auth.uid()) for performance optimization
-- Single consolidated policy per action
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can insert own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can view own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Users can update own page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "Admins can view all page visits" ON "user_page_visits";
DROP POLICY IF EXISTS "user_page_visits_select_policy" ON "user_page_visits";
DROP POLICY IF EXISTS "user_page_visits_insert_policy" ON "user_page_visits";
DROP POLICY IF EXISTS "user_page_visits_update_policy" ON "user_page_visits";

-- Consolidated SELECT policy: Users see own data, admins see all
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

-- INSERT policy: Users can only insert their own page visits
CREATE POLICY "user_page_visits_insert_policy"
  ON "user_page_visits" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- UPDATE policy: Users can only update their own page visits
CREATE POLICY "user_page_visits_update_policy"
  ON "user_page_visits" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- USER FEATURE USAGE POLICIES
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can insert own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Users can view own feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "Admins can view all feature usage" ON "user_feature_usage";
DROP POLICY IF EXISTS "user_feature_usage_select_policy" ON "user_feature_usage";
DROP POLICY IF EXISTS "user_feature_usage_insert_policy" ON "user_feature_usage";

-- Consolidated SELECT policy: Users see own data, admins see all
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

-- INSERT policy: Users can only insert their own feature usage
CREATE POLICY "user_feature_usage_insert_policy"
  ON "user_feature_usage" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- ==========================================
-- USER SEARCH QUERIES POLICIES
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can insert own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can view own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Users can update own search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "Admins can view all search queries" ON "user_search_queries";
DROP POLICY IF EXISTS "user_search_queries_select_policy" ON "user_search_queries";
DROP POLICY IF EXISTS "user_search_queries_insert_policy" ON "user_search_queries";
DROP POLICY IF EXISTS "user_search_queries_update_policy" ON "user_search_queries";

-- Consolidated SELECT policy: Users see own data, admins see all
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

-- INSERT policy: Users can only insert their own search queries
CREATE POLICY "user_search_queries_insert_policy"
  ON "user_search_queries" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- UPDATE policy: Users can only update their own search queries
CREATE POLICY "user_search_queries_update_policy"
  ON "user_search_queries" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- USER SESSION ANALYTICS POLICIES
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can insert own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can view own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Users can update own session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "Admins can view all session analytics" ON "user_session_analytics";
DROP POLICY IF EXISTS "user_session_analytics_select_policy" ON "user_session_analytics";
DROP POLICY IF EXISTS "user_session_analytics_insert_policy" ON "user_session_analytics";
DROP POLICY IF EXISTS "user_session_analytics_update_policy" ON "user_session_analytics";

-- Consolidated SELECT policy: Users see own data, admins see all
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

-- INSERT policy: Users can only insert their own session analytics
CREATE POLICY "user_session_analytics_insert_policy"
  ON "user_session_analytics" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- UPDATE policy: Users can only update their own session analytics
CREATE POLICY "user_session_analytics_update_policy"
  ON "user_session_analytics" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- SUSPICIOUS ACTIVITY LOGS POLICIES
-- Only admins can view/update, only service role can insert
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Admins can view suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Admins can update suspicious activity logs" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "Service role can insert suspicious activity" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_activity_logs_select_policy" ON "suspicious_activity_logs";
DROP POLICY IF EXISTS "suspicious_activity_logs_update_policy" ON "suspicious_activity_logs";

-- SELECT policy: Only admins can view suspicious activity logs
CREATE POLICY "suspicious_activity_logs_select_policy"
  ON "suspicious_activity_logs" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- UPDATE policy: Only admins can update suspicious activity logs (for review)
CREATE POLICY "suspicious_activity_logs_update_policy"
  ON "suspicious_activity_logs" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- Note: INSERT is handled by service_role which bypasses RLS
-- No INSERT policy needed for authenticated users

-- ==========================================
-- USER ACTIVITY SUMMARIES POLICIES
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view own activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Service role can manage activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "Admins can view all activity summaries" ON "user_activity_summaries";
DROP POLICY IF EXISTS "user_activity_summaries_select_policy" ON "user_activity_summaries";

-- Consolidated SELECT policy: Users see own data, admins see all
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

-- Note: INSERT/UPDATE is handled by service_role which bypasses RLS
-- This is for system aggregation only

-- ==========================================
-- GRANT PERMISSIONS TO SERVICE ROLE
-- ==========================================

-- Grant full access to service_role for server-side operations (bypasses RLS)
GRANT ALL ON "user_page_visits" TO service_role;
GRANT ALL ON "user_feature_usage" TO service_role;
GRANT ALL ON "user_search_queries" TO service_role;
GRANT ALL ON "user_session_analytics" TO service_role;
GRANT ALL ON "suspicious_activity_logs" TO service_role;
GRANT ALL ON "user_activity_summaries" TO service_role;

-- Grant select to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE ON "user_page_visits" TO authenticated;
GRANT SELECT, INSERT ON "user_feature_usage" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "user_search_queries" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "user_session_analytics" TO authenticated;
GRANT SELECT ON "suspicious_activity_logs" TO authenticated;
GRANT SELECT ON "user_activity_summaries" TO authenticated;
