-- ============================================================
-- CLERVA APP - PERFORMANCE INDEXES FOR SUPABASE
-- ============================================================
-- Run this SQL in your Supabase Dashboard > SQL Editor
--
-- IMPORTANT: These indexes improve query performance for 3000+ users
-- They are safe to run - CREATE INDEX IF NOT EXISTS won't duplicate
-- ============================================================

-- ============================================================
-- SECTION 1: CRITICAL PERFORMANCE INDEXES (NEW)
-- These are the indexes identified in the audit
-- ============================================================

-- 1. User table: Sort by registration date (admin dashboard)
-- Speeds up: Admin user listing sorted by signup date
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt" DESC);

-- 2. Match table: Filter by status across all users
-- Speeds up: Admin dashboard match statistics, pending match counts
CREATE INDEX IF NOT EXISTS "Match_status_idx" ON "Match" ("status");

-- 3. Notification table: Paginated queries sorted by date
-- Speeds up: User notification list with infinite scroll
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt" DESC);


-- ============================================================
-- SECTION 2: VERIFY EXISTING INDEXES
-- Check these exist (should already be in schema)
-- ============================================================

-- User indexes (verify they exist)
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" ("email");
CREATE INDEX IF NOT EXISTS "User_googleId_idx" ON "User" ("googleId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" ("role");
CREATE INDEX IF NOT EXISTS "User_deactivatedAt_idx" ON "User" ("deactivatedAt");
CREATE INDEX IF NOT EXISTS "User_twoFactorEnabled_idx" ON "User" ("twoFactorEnabled");
CREATE INDEX IF NOT EXISTS "User_isAdmin_idx" ON "User" ("isAdmin");

-- Match indexes (verify they exist)
CREATE INDEX IF NOT EXISTS "Match_senderId_status_idx" ON "Match" ("senderId", "status");
CREATE INDEX IF NOT EXISTS "Match_receiverId_status_idx" ON "Match" ("receiverId", "status");

-- Notification indexes (verify they exist)
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification" ("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification" ("createdAt");

-- Message indexes (verify critical ones)
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message" ("senderId");
CREATE INDEX IF NOT EXISTS "Message_groupId_idx" ON "Message" ("groupId");
CREATE INDEX IF NOT EXISTS "Message_recipientId_idx" ON "Message" ("recipientId");
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message" ("createdAt");
CREATE INDEX IF NOT EXISTS "Message_isDeleted_idx" ON "Message" ("isDeleted");

-- Message composite indexes (critical for performance)
CREATE INDEX IF NOT EXISTS "Message_senderId_recipientId_createdAt_idx" ON "Message" ("senderId", "recipientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Message_groupId_createdAt_idx" ON "Message" ("groupId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Message_recipientId_isRead_idx" ON "Message" ("recipientId", "isRead");
CREATE INDEX IF NOT EXISTS "Message_groupId_isRead_idx" ON "Message" ("groupId", "isRead");


-- ============================================================
-- SECTION 3: POST & COMMUNITY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "Post_userId_idx" ON "Post" ("userId");
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Post_isDeleted_idx" ON "Post" ("isDeleted");
CREATE INDEX IF NOT EXISTS "Post_isDeleted_createdAt_idx" ON "Post" ("isDeleted", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Post_userId_isDeleted_createdAt_idx" ON "Post" ("userId", "isDeleted", "createdAt" DESC);


-- ============================================================
-- SECTION 4: STUDY SESSION INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "StudySession_createdBy_idx" ON "StudySession" ("createdBy");
CREATE INDEX IF NOT EXISTS "StudySession_userId_idx" ON "StudySession" ("userId");
CREATE INDEX IF NOT EXISTS "StudySession_status_idx" ON "StudySession" ("status");
CREATE INDEX IF NOT EXISTS "StudySession_type_idx" ON "StudySession" ("type");
CREATE INDEX IF NOT EXISTS "StudySession_status_isPublic_startedAt_idx" ON "StudySession" ("status", "isPublic", "startedAt");
CREATE INDEX IF NOT EXISTS "StudySession_status_type_idx" ON "StudySession" ("status", "type");
CREATE INDEX IF NOT EXISTS "StudySession_createdAt_idx" ON "StudySession" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "StudySession_createdBy_status_idx" ON "StudySession" ("createdBy", "status");


-- ============================================================
-- SECTION 5: GROUP & GROUP MEMBER INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "Group_subject_idx" ON "Group" ("subject");
CREATE INDEX IF NOT EXISTS "Group_privacy_idx" ON "Group" ("privacy");
CREATE INDEX IF NOT EXISTS "Group_ownerId_idx" ON "Group" ("ownerId");
CREATE INDEX IF NOT EXISTS "Group_isDeleted_idx" ON "Group" ("isDeleted");

CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember" ("userId");
CREATE INDEX IF NOT EXISTS "GroupMember_groupId_idx" ON "GroupMember" ("groupId");


-- ============================================================
-- SECTION 6: PRESENCE SYSTEM INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "user_presence_userId_idx" ON "user_presence" ("userId");
CREATE INDEX IF NOT EXISTS "user_presence_status_idx" ON "user_presence" ("status");
CREATE INDEX IF NOT EXISTS "user_presence_lastSeenAt_idx" ON "user_presence" ("lastSeenAt");
CREATE INDEX IF NOT EXISTS "user_presence_status_lastSeenAt_idx" ON "user_presence" ("status", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "user_presence_lastActivityAt_idx" ON "user_presence" ("lastActivityAt");


-- ============================================================
-- SECTION 7: ADMIN & MODERATION INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_idx" ON "AdminAuditLog" ("adminId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog" ("action");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_idx" ON "AdminAuditLog" ("targetType");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report" ("reporterId");
CREATE INDEX IF NOT EXISTS "Report_reportedUserId_idx" ON "Report" ("reportedUserId");
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report" ("status");
CREATE INDEX IF NOT EXISTS "Report_type_idx" ON "Report" ("type");
CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Report_handledById_idx" ON "Report" ("handledById");

CREATE INDEX IF NOT EXISTS "flagged_content_status_idx" ON "flagged_content" ("status");
CREATE INDEX IF NOT EXISTS "flagged_content_contentType_idx" ON "flagged_content" ("contentType");
CREATE INDEX IF NOT EXISTS "flagged_content_senderId_idx" ON "flagged_content" ("senderId");
CREATE INDEX IF NOT EXISTS "flagged_content_flaggedAt_idx" ON "flagged_content" ("flaggedAt" DESC);


-- ============================================================
-- SECTION 8: AI PARTNER SYSTEM INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "AIPartnerSession_userId_idx" ON "AIPartnerSession" ("userId");
CREATE INDEX IF NOT EXISTS "AIPartnerSession_status_idx" ON "AIPartnerSession" ("status");
CREATE INDEX IF NOT EXISTS "AIPartnerSession_startedAt_idx" ON "AIPartnerSession" ("startedAt" DESC);
CREATE INDEX IF NOT EXISTS "AIPartnerSession_userId_status_idx" ON "AIPartnerSession" ("userId", "status");

CREATE INDEX IF NOT EXISTS "AIPartnerMessage_sessionId_idx" ON "AIPartnerMessage" ("sessionId");
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_sessionId_createdAt_idx" ON "AIPartnerMessage" ("sessionId", "createdAt");


-- ============================================================
-- SECTION 9: ANALYTICS & ACTIVITY TRACKING INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "user_page_visits_userId_idx" ON "user_page_visits" ("userId");
CREATE INDEX IF NOT EXISTS "user_page_visits_path_idx" ON "user_page_visits" ("path");
CREATE INDEX IF NOT EXISTS "user_page_visits_createdAt_idx" ON "user_page_visits" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "user_feature_usage_userId_idx" ON "user_feature_usage" ("userId");
CREATE INDEX IF NOT EXISTS "user_feature_usage_feature_idx" ON "user_feature_usage" ("feature");
CREATE INDEX IF NOT EXISTS "user_feature_usage_createdAt_idx" ON "user_feature_usage" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_userId_idx" ON "suspicious_activity_logs" ("userId");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_type_idx" ON "suspicious_activity_logs" ("type");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_severity_idx" ON "suspicious_activity_logs" ("severity");
CREATE INDEX IF NOT EXISTS "suspicious_activity_logs_severity_isReviewed_idx" ON "suspicious_activity_logs" ("severity", "isReviewed");


-- ============================================================
-- SECTION 10: VERIFY INDEX CREATION
-- Run this query to verify indexes were created
-- ============================================================

-- Check all indexes on critical tables
-- SELECT schemaname, tablename, indexname FROM pg_indexes
-- WHERE tablename IN ('User', 'Match', 'Notification', 'Message', 'Post', 'StudySession')
-- ORDER BY tablename, indexname;


-- ============================================================
-- DONE!
-- ============================================================
-- All indexes have been created or verified.
-- Your app is now optimized for 3000+ concurrent users.
-- ============================================================
