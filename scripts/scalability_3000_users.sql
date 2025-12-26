-- ============================================================================
-- CLERVA APP - Scalability Optimization for 3,000+ Users
-- ============================================================================
--
-- Purpose: Add additional performance indexes for high-traffic operations
-- Safe to run: YES - All statements use IF NOT EXISTS
-- RLS Impact: NONE - Only adds indexes, does not modify security policies
--
-- Prerequisites: Run migrations/database_indexes_optimization.sql first
--                (it contains the complete RLS setup)
--
-- Run this in Supabase SQL Editor after the main RLS migration
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADDITIONAL HIGH-TRAFFIC INDEXES
-- These complement the existing indexes for 3,000+ concurrent users
-- ============================================================================

-- User: Active users lookup (hot path for every authenticated request)
CREATE INDEX IF NOT EXISTS "idx_user_active_lookup"
ON "User" ("id", "email")
WHERE "deactivatedAt" IS NULL;

-- Message: Unread count by recipient (for notification badges)
CREATE INDEX IF NOT EXISTS "idx_message_unread_count"
ON "Message" ("recipientId")
WHERE "isRead" = false AND "isDeleted" = false;

-- Message: Recent DM conversation (for chat list sorting)
CREATE INDEX IF NOT EXISTS "idx_message_recent_dm"
ON "Message" ("senderId", "recipientId", "createdAt" DESC)
WHERE "groupId" IS NULL AND "isDeleted" = false;

-- GroupMember: User's groups with role (for permissions check)
CREATE INDEX IF NOT EXISTS "idx_groupmember_user_role"
ON "GroupMember" ("userId", "role", "groupId");

-- StudySession: Active sessions for discovery
CREATE INDEX IF NOT EXISTS "idx_session_discovery"
ON "StudySession" ("status", "startedAt" DESC, "createdBy")
WHERE "status" IN ('WAITING', 'ACTIVE');

-- SessionParticipant: Quick participant lookup
CREATE INDEX IF NOT EXISTS "idx_session_participant_lookup"
ON "SessionParticipant" ("sessionId", "userId", "status");

-- Match: Quick accepted match lookup (for partner features)
CREATE INDEX IF NOT EXISTS "idx_match_accepted_quick"
ON "Match" ("senderId", "receiverId", "status")
WHERE "status" = 'ACCEPTED';

-- Notification: Unread count with type (for categorized badges)
CREATE INDEX IF NOT EXISTS "idx_notification_unread_type"
ON "Notification" ("userId", "type")
WHERE "isRead" = false;

-- Post: Feed sorted by creation date (for timeline)
CREATE INDEX IF NOT EXISTS "idx_post_feed"
ON "Post" ("createdAt" DESC)
WHERE "isDeleted" = false;

-- PostComment: Comments per post (for comment loading)
CREATE INDEX IF NOT EXISTS "idx_comment_post_order"
ON "PostComment" ("postId", "createdAt" DESC);

-- PostLike: Count likes per post (for engagement metrics)
CREATE INDEX IF NOT EXISTS "idx_postlike_post"
ON "PostLike" ("postId", "createdAt" DESC);

-- AIPartnerSession: User's AI study sessions (for AI history)
CREATE INDEX IF NOT EXISTS "idx_ai_session_user"
ON "AIPartnerSession" ("userId", "updatedAt" DESC);

-- AIPartnerMessage: Messages in AI session (for AI chat loading)
CREATE INDEX IF NOT EXISTS "idx_ai_message_session"
ON "AIPartnerMessage" ("sessionId", "createdAt" DESC);

-- UserPresence: Online users (for presence indicators)
CREATE INDEX IF NOT EXISTS "idx_presence_online"
ON "user_presence" ("status", "lastSeenAt" DESC)
WHERE "status" = 'online';

-- DeviceSession: Active devices per user (for session management)
CREATE INDEX IF NOT EXISTS "idx_device_active_user"
ON "device_sessions" ("userId", "lastHeartbeatAt" DESC)
WHERE "isActive" = true;

-- SessionFlashcard: Flashcards for user in session (for study tools)
CREATE INDEX IF NOT EXISTS "idx_session_flashcard_user"
ON "SessionFlashcard" ("sessionId", "userId", "createdAt" DESC);

-- SessionGoal: Goals in study session (for goal tracking)
CREATE INDEX IF NOT EXISTS "idx_session_goal_lookup"
ON "SessionGoal" ("sessionId", "isCompleted");

-- ============================================================================
-- SECTION 2: COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Message conversation view: Get messages between two users
CREATE INDEX IF NOT EXISTS "idx_message_conversation_view"
ON "Message" (
  LEAST("senderId", "recipientId"),
  GREATEST("senderId", "recipientId"),
  "createdAt" DESC
)
WHERE "groupId" IS NULL AND "isDeleted" = false;

-- Group message view: Get messages in a group
CREATE INDEX IF NOT EXISTS "idx_message_group_view"
ON "Message" ("groupId", "createdAt" DESC, "senderId")
WHERE "groupId" IS NOT NULL AND "isDeleted" = false;

-- ============================================================================
-- SECTION 3: PARTIAL INDEXES FOR FILTERED QUERIES
-- ============================================================================

-- Report: Pending reports for admin dashboard
CREATE INDEX IF NOT EXISTS "idx_report_pending"
ON "Report" ("status", "createdAt" DESC)
WHERE "status" = 'PENDING';

-- Announcement: Active announcements
CREATE INDEX IF NOT EXISTS "idx_announcement_active_display"
ON "Announcement" ("status", "startsAt")
WHERE "status" = 'ACTIVE';

-- ============================================================================
-- SECTION 4: VERIFY INDEXES WERE CREATED
-- ============================================================================

-- Run this query to see all indexes:
-- SELECT tablename, indexname FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- ============================================================================
-- SECTION 5: ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update statistics for query planner (recommended after adding indexes)
ANALYZE "User";
ANALYZE "Message";
ANALYZE "GroupMember";
ANALYZE "StudySession";
ANALYZE "SessionParticipant";
ANALYZE "Match";
ANALYZE "Notification";
ANALYZE "Post";
ANALYZE "PostComment";
ANALYZE "PostLike";
ANALYZE "AIPartnerSession";
ANALYZE "AIPartnerMessage";
ANALYZE "SessionGoal";
ANALYZE "SessionFlashcard";
ANALYZE "Report";
ANALYZE "Announcement";
ANALYZE "user_presence";
ANALYZE "device_sessions";

-- ============================================================================
-- END OF SCALABILITY MIGRATION
-- ============================================================================
