-- Admin Dashboard Performance Indexes
-- This migration adds indexes to improve admin dashboard query performance

-- =====================================================
-- USER PRESENCE INDEXES (for online users tracking)
-- =====================================================

-- Index for finding online users quickly
CREATE INDEX IF NOT EXISTS "user_presence_status_lastSeenAt_idx"
ON "user_presence" ("status", "lastSeenAt" DESC)
WHERE "status" = 'online';

-- Index for finding recently active users
CREATE INDEX IF NOT EXISTS "user_presence_lastActivityAt_idx"
ON "user_presence" ("lastActivityAt" DESC);

-- =====================================================
-- USER INDEXES (for admin dashboard stats)
-- =====================================================

-- Index for counting users by creation date (growth charts)
CREATE INDEX IF NOT EXISTS "User_createdAt_date_idx"
ON "User" (DATE("createdAt"));

-- Index for last login queries (active users)
CREATE INDEX IF NOT EXISTS "User_lastLoginAt_idx"
ON "User" ("lastLoginAt" DESC)
WHERE "lastLoginAt" IS NOT NULL;

-- Composite index for admin user queries
CREATE INDEX IF NOT EXISTS "User_isAdmin_deactivatedAt_idx"
ON "User" ("isAdmin", "deactivatedAt");

-- =====================================================
-- MESSAGE INDEXES (for admin message analytics)
-- =====================================================

-- Index for message count by date
CREATE INDEX IF NOT EXISTS "Message_createdAt_date_idx"
ON "Message" (DATE("createdAt"));

-- Index for unread message counts
CREATE INDEX IF NOT EXISTS "Message_isRead_createdAt_idx"
ON "Message" ("isRead", "createdAt" DESC)
WHERE "isDeleted" = false;

-- =====================================================
-- STUDY SESSION INDEXES (for session analytics)
-- =====================================================

-- Index for session analytics by date
CREATE INDEX IF NOT EXISTS "StudySession_startedAt_date_idx"
ON "StudySession" (DATE("startedAt"));

-- Index for active sessions
CREATE INDEX IF NOT EXISTS "StudySession_status_active_idx"
ON "StudySession" ("status", "startedAt" DESC)
WHERE "status" IN ('ACTIVE', 'WAITING');

-- =====================================================
-- REPORT INDEXES (for moderation dashboard)
-- =====================================================

-- Index for pending reports (frequently queried)
CREATE INDEX IF NOT EXISTS "Report_status_pending_idx"
ON "Report" ("status", "createdAt" DESC)
WHERE "status" = 'PENDING';

-- =====================================================
-- AI PARTNER INDEXES (for AI analytics)
-- =====================================================

-- Index for AI session analytics
CREATE INDEX IF NOT EXISTS "AIPartnerSession_status_startedAt_idx"
ON "AIPartnerSession" ("status", "startedAt" DESC);

-- Index for AI message analytics
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_createdAt_date_idx"
ON "AIPartnerMessage" (DATE("createdAt"));

-- Index for flagged AI messages
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_wasFlagged_idx"
ON "AIPartnerMessage" ("wasFlagged", "createdAt" DESC)
WHERE "wasFlagged" = true;

-- =====================================================
-- AUDIT LOG INDEXES (for admin audit trail)
-- =====================================================

-- Index for audit log queries by admin
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_createdAt_idx"
ON "AdminAuditLog" ("adminId", "createdAt" DESC);

-- Index for audit log queries by action type
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx"
ON "AdminAuditLog" ("action", "createdAt" DESC);

-- =====================================================
-- POST INDEXES (for community analytics)
-- =====================================================

-- Index for post analytics by date
CREATE INDEX IF NOT EXISTS "Post_createdAt_date_idx"
ON "Post" (DATE("createdAt"))
WHERE "isDeleted" = false;

-- =====================================================
-- DEVICE SESSION INDEXES (for active device tracking)
-- =====================================================

-- Index for active device sessions
CREATE INDEX IF NOT EXISTS "device_sessions_isActive_lastHeartbeat_idx"
ON "device_sessions" ("isActive", "lastHeartbeatAt" DESC)
WHERE "isActive" = true;

-- =====================================================
-- FEEDBACK INDEXES (for admin feedback dashboard)
-- =====================================================

-- Index for pending feedback
CREATE INDEX IF NOT EXISTS "Feedback_status_createdAt_idx"
ON "Feedback" ("status", "createdAt" DESC);

-- Index for feedback by rating
CREATE INDEX IF NOT EXISTS "Feedback_rating_idx"
ON "Feedback" ("rating");
