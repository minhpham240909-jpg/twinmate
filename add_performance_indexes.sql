-- ============================================================
-- PERFORMANCE INDEXES FOR CLERVA APP
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. POST TABLE INDEXES (Community Feed Performance)
-- ============================================================

-- Index for fetching non-deleted posts ordered by date (feed queries)
CREATE INDEX IF NOT EXISTS "Post_isDeleted_createdAt_idx"
ON "Post" ("isDeleted", "createdAt" DESC);

-- Composite index for fetching user's posts (profile page)
CREATE INDEX IF NOT EXISTS "Post_userId_isDeleted_createdAt_idx"
ON "Post" ("userId", "isDeleted", "createdAt" DESC);

-- ============================================================
-- 2. USER PRESENCE TABLE INDEXES (Online Status Performance)
-- ============================================================

-- Index for presence cleanup/timeout queries
CREATE INDEX IF NOT EXISTS "user_presence_lastSeenAt_idx"
ON "user_presence" ("lastSeenAt");

-- Composite index for finding stale online users (cleanup cron job)
CREATE INDEX IF NOT EXISTS "user_presence_status_lastSeenAt_idx"
ON "user_presence" ("status", "lastSeenAt");

-- ============================================================
-- VERIFICATION QUERIES (Optional - check indexes were created)
-- ============================================================

-- Uncomment to verify indexes exist:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename IN ('Post', 'user_presence')
-- ORDER BY tablename, indexname;
