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
-- 3. SESSION MESSAGE INDEXES (Chat Performance)
-- ============================================================

-- Optimizes: Loading chat messages for a study session (ordered by time)
CREATE INDEX IF NOT EXISTS "SessionMessage_sessionId_createdAt_idx"
ON "SessionMessage"("sessionId", "createdAt" DESC);

-- ============================================================
-- 4. STUDY SESSION INDEXES
-- ============================================================

-- Optimizes: Finding active sessions for a user
CREATE INDEX IF NOT EXISTS "StudySession_createdBy_status_idx"
ON "StudySession"("createdBy", "status");

-- Optimizes: Finding sessions by status and ended time
CREATE INDEX IF NOT EXISTS "StudySession_status_endedAt_idx"
ON "StudySession"("status", "endedAt");

-- ============================================================
-- 5. SESSION PARTICIPANT INDEXES
-- ============================================================

-- Optimizes: Finding all participants in a session
CREATE INDEX IF NOT EXISTS "SessionParticipant_sessionId_joinedAt_idx"
ON "SessionParticipant"("sessionId", "joinedAt");

-- Optimizes: Finding all sessions a user has participated in
CREATE INDEX IF NOT EXISTS "SessionParticipant_userId_joinedAt_idx"
ON "SessionParticipant"("userId", "joinedAt" DESC);

-- ============================================================
-- 6. SESSION NOTE INDEXES
-- ============================================================

-- Optimizes: Loading notes for a session (ordered by creation time)
CREATE INDEX IF NOT EXISTS "SessionNote_sessionId_createdAt_idx"
ON "SessionNote"("sessionId", "createdAt" DESC);

-- Optimizes: Finding user's own notes across sessions
CREATE INDEX IF NOT EXISTS "SessionNote_userId_createdAt_idx"
ON "SessionNote"("userId", "createdAt" DESC);

-- ============================================================
-- 7. ANALYTICS INDEXES
-- ============================================================

-- Optimizes: Page visit queries by user and time
CREATE INDEX IF NOT EXISTS "user_page_visits_userId_enteredAt_idx"
ON "user_page_visits"("userId", "enteredAt" DESC);

-- Optimizes: Feature usage analytics queries
CREATE INDEX IF NOT EXISTS "user_feature_usage_userId_createdAt_idx"
ON "user_feature_usage"("userId", "createdAt" DESC);

-- Optimizes: Feature usage by category for dashboards
CREATE INDEX IF NOT EXISTS "user_feature_usage_category_createdAt_idx"
ON "user_feature_usage"("category", "createdAt" DESC);

-- ============================================================
-- 8. GROUP INDEXES
-- ============================================================

-- Optimizes: Finding pending invites for a user
CREATE INDEX IF NOT EXISTS "GroupInvite_inviteeId_status_idx"
ON "GroupInvite"("inviteeId", "status");

-- Optimizes: Finding group members efficiently
CREATE INDEX IF NOT EXISTS "GroupMember_groupId_role_idx"
ON "GroupMember"("groupId", "role");

-- ============================================================
-- 9. MATCH INDEXES
-- ============================================================

-- Optimizes: Finding matches by status (for partner lookups)
CREATE INDEX IF NOT EXISTS "Match_status_createdAt_idx"
ON "Match"("status", "createdAt" DESC);

-- Optimizes: Finding all matches for a user (sent or received)
CREATE INDEX IF NOT EXISTS "Match_senderId_status_idx"
ON "Match"("senderId", "status");

CREATE INDEX IF NOT EXISTS "Match_receiverId_status_idx"
ON "Match"("receiverId", "status");

-- ============================================================
-- 10. NOTIFICATION INDEXES
-- ============================================================

-- Optimizes: Finding unread notifications for a user
-- Column is "isRead" not "read"
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
ON "Notification"("userId", "isRead", "createdAt" DESC);

-- ============================================================
-- UPDATE STATISTICS (Run after creating indexes)
-- ============================================================

-- Update query planner statistics for optimal performance
ANALYZE "Post";
ANALYZE "user_presence";
ANALYZE "SessionMessage";
ANALYZE "StudySession";
ANALYZE "SessionParticipant";
ANALYZE "SessionNote";
ANALYZE "user_page_visits";
ANALYZE "user_feature_usage";
ANALYZE "GroupInvite";
ANALYZE "GroupMember";
ANALYZE "Match";
ANALYZE "Notification";

-- ============================================================
-- VERIFICATION QUERIES (Optional - check indexes were created)
-- ============================================================

-- Uncomment to verify indexes exist:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
