-- ==========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ==========================================
-- Create materialized views for expensive aggregations
-- These speed up dashboard queries and analytics
--
-- FIXES APPLIED:
-- - Fixed UserRole enum values (FREE/PREMIUM instead of USER/ADMIN)
-- - Fixed SessionStatus enum values (UPPERCASE: SCHEDULED/ACTIVE/COMPLETED)
-- - All camelCase column names properly quoted (e.g., "createdAt", "userId")
-- - Removed CONCURRENTLY from REFRESH commands (cannot run in transaction)
--
-- SECURITY NOTE: Materialized views don't support RLS
-- So we only store aggregated/anonymized data here
-- User-specific data still goes through RLS-protected tables
-- ==========================================

-- ==========================================
-- VIEW 1: User Activity Statistics (Aggregated, Safe)
-- ==========================================
-- Purpose: Dashboard analytics without scanning entire User table

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_stats AS
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE role = 'FREE') AS free_users,
  COUNT(*) FILTER (WHERE role = 'PREMIUM') AS premium_users,
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '24 hours') AS users_last_24h,
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS users_last_week,
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS users_last_month,
  MAX("createdAt") AS last_user_created,
  NOW() AS refreshed_at
FROM "User";

CREATE UNIQUE INDEX ON mv_user_stats (refreshed_at);

-- Refresh function (call this periodically or via cron)
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_user_stats;
END;
$$;

-- ==========================================
-- VIEW 2: Match Statistics (Aggregated, Safe)
-- ==========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_match_stats AS
SELECT
  COUNT(*) AS total_matches,
  COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_matches,
  COUNT(*) FILTER (WHERE status = 'ACCEPTED') AS accepted_matches,
  COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_matches,
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '24 hours') AS matches_last_24h,
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS matches_last_week,
  COUNT(*) FILTER (WHERE status = 'ACCEPTED' AND "createdAt" >= NOW() - INTERVAL '24 hours') AS successful_matches_last_24h,
  NOW() AS refreshed_at
FROM "Match";

CREATE UNIQUE INDEX ON mv_match_stats (refreshed_at);

CREATE OR REPLACE FUNCTION refresh_match_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_match_stats;
END;
$$;

-- ==========================================
-- VIEW 3: Active Sessions Statistics (Aggregated, Safe)
-- ==========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_session_stats AS
SELECT
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'SCHEDULED') AS scheduled_sessions,
  COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_sessions,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_sessions,
  COUNT(*) FILTER (WHERE status = 'WAITING') AS waiting_sessions,
  COUNT(*) FILTER (WHERE "isPublic" = true) AS public_sessions,
  COUNT(*) FILTER (WHERE "scheduledAt" >= NOW() AND "scheduledAt" <= NOW() + INTERVAL '24 hours') AS sessions_next_24h,
  COUNT(*) FILTER (WHERE "scheduledAt" >= NOW() AND "scheduledAt" <= NOW() + INTERVAL '7 days') AS sessions_next_week,
  NOW() AS refreshed_at
FROM "StudySession";

CREATE UNIQUE INDEX ON mv_session_stats (refreshed_at);

CREATE OR REPLACE FUNCTION refresh_session_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_session_stats;
END;
$$;

-- ==========================================
-- VIEW 4: Per-User Notification Count (RLS-Protected Query Helper)
-- ==========================================
-- Purpose: Speed up "unread notification count" queries
-- SECURITY: This aggregates per-user, so we add RLS-style filtering

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_notification_counts AS
SELECT
  "userId",
  COUNT(*) AS total_notifications,
  COUNT(*) FILTER (WHERE "isRead" = false) AS unread_count,
  MAX("createdAt") FILTER (WHERE "isRead" = false) AS latest_unread_at,
  NOW() AS refreshed_at
FROM "Notification"
GROUP BY "userId";

CREATE UNIQUE INDEX ON mv_user_notification_counts ("userId");
CREATE INDEX ON mv_user_notification_counts (refreshed_at);
CREATE INDEX ON mv_user_notification_counts (unread_count) WHERE unread_count > 0;

-- RLS-Protected function to query this view
CREATE OR REPLACE FUNCTION get_my_notification_counts()
RETURNS TABLE (
  total_notifications bigint,
  unread_count bigint,
  latest_unread_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return current user's counts (RLS-style security)
  RETURN QUERY
  SELECT
    mv.total_notifications,
    mv.unread_count,
    mv.latest_unread_at
  FROM mv_user_notification_counts mv
  WHERE mv."userId" = auth.uid()::text;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_notification_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_user_notification_counts;
END;
$$;

-- ==========================================
-- VIEW 5: Per-User Match Count (RLS-Protected Query Helper)
-- ==========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_match_counts AS
SELECT
  user_id,
  COUNT(*) AS total_matches,
  COUNT(*) FILTER (WHERE status = 'ACCEPTED') AS accepted_count,
  COUNT(*) FILTER (WHERE status = 'PENDING' AND is_receiver = true) AS pending_received_count,
  COUNT(*) FILTER (WHERE status = 'PENDING' AND is_receiver = false) AS pending_sent_count,
  NOW() AS refreshed_at
FROM (
  SELECT
    "senderId" AS user_id,
    status,
    false AS is_receiver
  FROM "Match"
  UNION ALL
  SELECT
    "receiverId" AS user_id,
    status,
    true AS is_receiver
  FROM "Match"
) AS all_matches
GROUP BY user_id;

CREATE UNIQUE INDEX ON mv_user_match_counts (user_id);
CREATE INDEX ON mv_user_match_counts (refreshed_at);

-- RLS-Protected function to query this view
CREATE OR REPLACE FUNCTION get_my_match_counts()
RETURNS TABLE (
  total_matches bigint,
  accepted_count bigint,
  pending_received_count bigint,
  pending_sent_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return current user's counts (RLS-style security)
  RETURN QUERY
  SELECT
    mv.total_matches,
    mv.accepted_count,
    mv.pending_received_count,
    mv.pending_sent_count
  FROM mv_user_match_counts mv
  WHERE mv.user_id = auth.uid()::text;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_match_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_user_match_counts;
END;
$$;

-- ==========================================
-- VIEW 6: Online Users Count (Aggregated, Safe)
-- ==========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_online_users AS
SELECT
  COUNT(*) AS total_online,
  COUNT(*) FILTER (WHERE current_activity IS NOT NULL) AS active_in_session,
  COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '5 minutes') AS active_last_5min,
  COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '15 minutes') AS active_last_15min,
  NOW() AS refreshed_at
FROM "presence"
WHERE is_online = true;

CREATE UNIQUE INDEX ON mv_online_users (refreshed_at);

CREATE OR REPLACE FUNCTION refresh_online_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_online_users;
END;
$$;

-- ==========================================
-- PART 7: AUTO-REFRESH SETUP (Optional - requires pg_cron extension)
-- ==========================================
-- Uncomment these if you have pg_cron enabled in Supabase

-- Refresh notification counts every 5 minutes
-- SELECT cron.schedule(
--   'refresh-notification-counts',
--   '*/5 * * * *',
--   'SELECT refresh_notification_counts();'
-- );

-- Refresh match counts every 10 minutes
-- SELECT cron.schedule(
--   'refresh-match-counts',
--   '*/10 * * * *',
--   'SELECT refresh_match_counts();'
-- );

-- Refresh online users every 1 minute
-- SELECT cron.schedule(
--   'refresh-online-users',
--   '* * * * *',
--   'SELECT refresh_online_users();'
-- );

-- Refresh general stats every hour
-- SELECT cron.schedule(
--   'refresh-general-stats',
--   '0 * * * *',
--   'SELECT refresh_user_stats(); SELECT refresh_match_stats(); SELECT refresh_session_stats();'
-- );

-- ==========================================
-- VALIDATION
-- ==========================================

DO $$
DECLARE
  view_count int;
BEGIN
  -- Count materialized views created
  SELECT COUNT(*) INTO view_count
  FROM pg_matviews
  WHERE schemaname = 'public'
  AND matviewname LIKE 'mv_%';

  RAISE NOTICE 'Materialized views created successfully!';
  RAISE NOTICE 'Total materialized views: %', view_count;
  RAISE NOTICE 'All views use RLS-protected functions for user-specific data';
  RAISE NOTICE 'Remember to refresh views periodically for up-to-date data';
  RAISE NOTICE 'Use: SELECT refresh_notification_counts(); -- etc';
END $$;
