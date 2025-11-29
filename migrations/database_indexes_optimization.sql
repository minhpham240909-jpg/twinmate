-- ============================================================================
-- Database Indexes Optimization + RLS Security
--
-- This migration includes:
-- 1. Performance indexes for all tables
-- 2. Row Level Security (RLS) policies for all tables
-- 3. Realtime subscription setup
--
-- Run in Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core User Tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;

-- Matching & Connections
ALTER TABLE "Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlockedUser" ENABLE ROW LEVEL SECURITY;

-- Groups
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupInvite" ENABLE ROW LEVEL SECURITY;

-- Messaging
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationArchive" ENABLE ROW LEVEL SECURITY;

-- Study Sessions
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTimer" ENABLE ROW LEVEL SECURITY;

-- Collaboration Features
ALTER TABLE "SessionWhiteboard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionWhiteboardVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionFlashcard" ENABLE ROW LEVEL SECURITY;

-- Gamification
ALTER TABLE "Badge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;

-- Notifications & Sessions
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

-- Community
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostRepost" ENABLE ROW LEVEL SECURITY;

-- Presence System
ALTER TABLE "user_presence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_read_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "typing_indicators" ENABLE ROW LEVEL SECURITY;

-- Admin & Moderation
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementDismissal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserWarning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flagged_content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: DROP EXISTING POLICIES (Clean Slate)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: HELPER FUNCTION FOR ADMIN CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 4: RLS POLICIES - USER & PROFILE
-- ============================================================================

-- User: Public read (API filters sensitive data), self update
CREATE POLICY "Users can view user profiles"
ON "User" FOR SELECT USING (true);

CREATE POLICY "Users can update own data"
ON "User" FOR UPDATE USING ((select auth.uid())::text = id);

-- Profile: Public read, self manage
CREATE POLICY "Users can view all profiles"
ON "Profile" FOR SELECT USING (true);

CREATE POLICY "Users can manage own profile"
ON "Profile" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- LearningProfile: Public read, self manage
CREATE POLICY "Users can view learning profiles"
ON "LearningProfile" FOR SELECT USING (true);

CREATE POLICY "Users can manage own learning profile"
ON "LearningProfile" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- UserSettings: Self only
CREATE POLICY "Users can manage own settings"
ON "UserSettings" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 5: RLS POLICIES - MATCH & CONNECTIONS
-- ============================================================================

CREATE POLICY "Users can view own matches"
ON "Match" FOR SELECT
USING ((select auth.uid())::text = "senderId" OR (select auth.uid())::text = "receiverId");

CREATE POLICY "Users can create matches"
ON "Match" FOR INSERT
WITH CHECK ((select auth.uid())::text = "senderId");

CREATE POLICY "Users can update own matches"
ON "Match" FOR UPDATE
USING ((select auth.uid())::text = "senderId" OR (select auth.uid())::text = "receiverId");

CREATE POLICY "Users can manage own blocks"
ON "BlockedUser" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 6: RLS POLICIES - GROUPS
-- ============================================================================

CREATE POLICY "Users can view accessible groups"
ON "Group" FOR SELECT
USING (
  "privacy" = 'PUBLIC'
  OR (select auth.uid())::text = "ownerId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "Group"."id"
    AND gm."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can create groups"
ON "Group" FOR INSERT
WITH CHECK ((select auth.uid())::text = "ownerId");

CREATE POLICY "Group owners can update"
ON "Group" FOR UPDATE
USING ((select auth.uid())::text = "ownerId");

CREATE POLICY "Group owners can delete"
ON "Group" FOR DELETE
USING ((select auth.uid())::text = "ownerId");

CREATE POLICY "Users can view group members"
ON "GroupMember" FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "GroupMember"."groupId"
    AND gm."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can join groups"
ON "GroupMember" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can leave groups"
ON "GroupMember" FOR DELETE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can view group invites"
ON "GroupInvite" FOR SELECT
USING ((select auth.uid())::text = "inviterId" OR (select auth.uid())::text = "inviteeId");

CREATE POLICY "Users can create group invites"
ON "GroupInvite" FOR INSERT
WITH CHECK ((select auth.uid())::text = "inviterId");

CREATE POLICY "Invitees can respond to invites"
ON "GroupInvite" FOR UPDATE
USING ((select auth.uid())::text = "inviteeId");

-- ============================================================================
-- PART 7: RLS POLICIES - MESSAGES
-- ============================================================================

CREATE POLICY "Users can view messages"
ON "Message" FOR SELECT
USING (
  (select auth.uid())::text = "senderId"
  OR (select auth.uid())::text = "recipientId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "Message"."groupId"
    AND gm."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can send messages"
ON "Message" FOR INSERT
WITH CHECK ((select auth.uid())::text = "senderId");

CREATE POLICY "Users can update own messages"
ON "Message" FOR UPDATE
USING ((select auth.uid())::text = "senderId");

CREATE POLICY "Users can delete own messages"
ON "Message" FOR DELETE
USING ((select auth.uid())::text = "senderId");

CREATE POLICY "Users can manage own archives"
ON "ConversationArchive" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 8: RLS POLICIES - STUDY SESSIONS
-- ============================================================================

CREATE POLICY "Users can view sessions"
ON "StudySession" FOR SELECT
USING (
  (select auth.uid())::text = "createdBy"
  OR (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "StudySession"."id"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can create sessions"
ON "StudySession" FOR INSERT
WITH CHECK ((select auth.uid())::text = "createdBy");

CREATE POLICY "Hosts can update sessions"
ON "StudySession" FOR UPDATE
USING ((select auth.uid())::text = "createdBy" OR (select auth.uid())::text = "userId");

CREATE POLICY "Users can view session participants"
ON "SessionParticipant" FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionParticipant"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can join sessions"
ON "SessionParticipant" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own participation"
ON "SessionParticipant" FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Participants can view session goals"
ON "SessionGoal" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionGoal"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Hosts can manage session goals"
ON "SessionGoal" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "StudySession" ss
    WHERE ss."id" = "SessionGoal"."sessionId"
    AND ss."createdBy" = (select auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "StudySession" ss
    WHERE ss."id" = "SessionGoal"."sessionId"
    AND ss."createdBy" = (select auth.uid())::text
  )
);

CREATE POLICY "Participants can view session messages"
ON "SessionMessage" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionMessage"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Participants can send session messages"
ON "SessionMessage" FOR INSERT
WITH CHECK (
  (select auth.uid())::text = "senderId"
  AND EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionMessage"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Participants can view session timer"
ON "SessionTimer" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionTimer"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Hosts can manage session timer"
ON "SessionTimer" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "StudySession" ss
    WHERE ss."id" = "SessionTimer"."sessionId"
    AND ss."createdBy" = (select auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "StudySession" ss
    WHERE ss."id" = "SessionTimer"."sessionId"
    AND ss."createdBy" = (select auth.uid())::text
  )
);

-- ============================================================================
-- PART 9: RLS POLICIES - COLLABORATION FEATURES
-- ============================================================================

CREATE POLICY "Participants can access whiteboards"
ON "SessionWhiteboard" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionWhiteboard"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionWhiteboard"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Participants can access whiteboard versions"
ON "SessionWhiteboardVersion" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "SessionWhiteboard" wb
    JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
    WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
    AND sp."userId" = (select auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "SessionWhiteboard" wb
    JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
    WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Participants can access notes"
ON "SessionNote" FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionNote"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionNote"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Users can manage own flashcards"
ON "SessionFlashcard" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 10: RLS POLICIES - GAMIFICATION
-- ============================================================================

CREATE POLICY "Anyone can view badges"
ON "Badge" FOR SELECT USING (true);

CREATE POLICY "Anyone can view user badges"
ON "UserBadge" FOR SELECT USING (true);

CREATE POLICY "System can award badges"
ON "UserBadge" FOR INSERT WITH CHECK (true);

-- ============================================================================
-- PART 11: RLS POLICIES - NOTIFICATIONS
-- ============================================================================

CREATE POLICY "Users can view own notifications"
ON "Notification" FOR SELECT
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can insert own notifications"
ON "Notification" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own notifications"
ON "Notification" FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own notifications"
ON "Notification" FOR DELETE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can manage own sessions"
ON "Session" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 12: RLS POLICIES - COMMUNITY (POSTS)
-- ============================================================================

CREATE POLICY "Users can view posts"
ON "Post" FOR SELECT
USING ("isDeleted" = false OR (select auth.uid())::text = "userId");

CREATE POLICY "Users can create posts"
ON "Post" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own posts"
ON "Post" FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own posts"
ON "Post" FOR DELETE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Anyone can view likes"
ON "PostLike" FOR SELECT USING (true);

CREATE POLICY "Users can create likes"
ON "PostLike" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own likes"
ON "PostLike" FOR DELETE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Anyone can view comments"
ON "PostComment" FOR SELECT USING (true);

CREATE POLICY "Users can create comments"
ON "PostComment" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own comments"
ON "PostComment" FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own comments"
ON "PostComment" FOR DELETE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Anyone can view reposts"
ON "PostRepost" FOR SELECT USING (true);

CREATE POLICY "Users can create reposts"
ON "PostRepost" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own reposts"
ON "PostRepost" FOR DELETE
USING ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 13: RLS POLICIES - PRESENCE SYSTEM
-- ============================================================================

CREATE POLICY "Users can view presence"
ON "user_presence" FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "Match" m
    WHERE m."status" = 'ACCEPTED'
    AND (
      (m."senderId" = (select auth.uid())::text AND m."receiverId" = "user_presence"."userId")
      OR (m."receiverId" = (select auth.uid())::text AND m."senderId" = "user_presence"."userId")
    )
  )
);

CREATE POLICY "Users can insert own presence"
ON "user_presence" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own presence"
ON "user_presence" FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own presence"
ON "user_presence" FOR DELETE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can manage own device sessions"
ON "device_sessions" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can view message read status"
ON "message_read_status" FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "Message" m
    WHERE m."id" = "message_read_status"."messageId"
    AND (m."senderId" = (select auth.uid())::text OR m."recipientId" = (select auth.uid())::text)
  )
);

CREATE POLICY "Users can mark messages as read"
ON "message_read_status" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can manage own typing"
ON "typing_indicators" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- PART 14: RLS POLICIES - ADMIN & MODERATION
-- ============================================================================

CREATE POLICY "Admins can view audit logs"
ON "AdminAuditLog" FOR SELECT USING (is_admin());

CREATE POLICY "Admins can insert audit logs"
ON "AdminAuditLog" FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Users can view active announcements"
ON "Announcement" FOR SELECT
USING ("status" = 'ACTIVE' OR is_admin());

CREATE POLICY "Admins can manage announcements"
ON "Announcement" FOR ALL
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users can manage own dismissals"
ON "AnnouncementDismissal" FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can view own reports"
ON "Report" FOR SELECT
USING ((select auth.uid())::text = "reporterId" OR is_admin());

CREATE POLICY "Users can create reports"
ON "Report" FOR INSERT
WITH CHECK ((select auth.uid())::text = "reporterId");

CREATE POLICY "Admins can update reports"
ON "Report" FOR UPDATE USING (is_admin());

CREATE POLICY "Users can view own warnings"
ON "UserWarning" FOR SELECT
USING ((select auth.uid())::text = "userId" OR is_admin());

CREATE POLICY "Admins can manage warnings"
ON "UserWarning" FOR ALL
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can view bans"
ON "UserBan" FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage bans"
ON "UserBan" FOR ALL
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can view flagged content"
ON "flagged_content" FOR SELECT USING (is_admin());

CREATE POLICY "System can insert flagged content"
ON "flagged_content" FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update flagged content"
ON "flagged_content" FOR UPDATE USING (is_admin());

CREATE POLICY "Users can view own feedback"
ON "Feedback" FOR SELECT
USING ((select auth.uid())::text = "userId" OR is_admin());

CREATE POLICY "Users can create feedback"
ON "Feedback" FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Admins can update feedback"
ON "Feedback" FOR UPDATE USING (is_admin());

-- ============================================================================
-- PART 15: PERFORMANCE INDEXES - USER TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_user_email" ON "User" ("email");
CREATE INDEX IF NOT EXISTS "idx_user_is_admin" ON "User" ("isAdmin") WHERE "isAdmin" = true;
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User" ("role");
CREATE INDEX IF NOT EXISTS "idx_user_last_login" ON "User" ("lastLoginAt");
CREATE INDEX IF NOT EXISTS "idx_user_deactivated" ON "User" ("deactivatedAt") WHERE "deactivatedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_user_active_created" ON "User" ("createdAt" DESC) WHERE "deactivatedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_user_google_id" ON "User" ("googleId") WHERE "googleId" IS NOT NULL;

-- ============================================================================
-- PART 16: PERFORMANCE INDEXES - PROFILE TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_profile_subjects" ON "Profile" USING GIN ("subjects");
CREATE INDEX IF NOT EXISTS "idx_profile_interests" ON "Profile" USING GIN ("interests");
CREATE INDEX IF NOT EXISTS "idx_profile_goals" ON "Profile" USING GIN ("goals");
CREATE INDEX IF NOT EXISTS "idx_profile_available_days" ON "Profile" USING GIN ("availableDays");
CREATE INDEX IF NOT EXISTS "idx_profile_skill_level" ON "Profile" ("skillLevel");
CREATE INDEX IF NOT EXISTS "idx_profile_study_style" ON "Profile" ("studyStyle");
CREATE INDEX IF NOT EXISTS "idx_profile_age" ON "Profile" ("age");
CREATE INDEX IF NOT EXISTS "idx_profile_location" ON "Profile" ("location_country", "location_state", "location_city")
  WHERE "location_visibility" = 'public';
CREATE INDEX IF NOT EXISTS "idx_profile_updated" ON "Profile" ("updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_profile_looking" ON "Profile" ("isLookingForPartner") WHERE "isLookingForPartner" = true;

-- ============================================================================
-- PART 17: PERFORMANCE INDEXES - MESSAGE TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_message_sender_created" ON "Message" ("senderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_message_recipient_created" ON "Message" ("recipientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_message_group_created" ON "Message" ("groupId", "createdAt" DESC) WHERE "groupId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_message_unread" ON "Message" ("recipientId", "isRead") WHERE "isRead" = false;
CREATE INDEX IF NOT EXISTS "idx_message_deleted" ON "Message" ("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_message_dm_conversation" ON "Message" ("senderId", "recipientId", "createdAt" DESC) WHERE "groupId" IS NULL;

-- ============================================================================
-- PART 18: PERFORMANCE INDEXES - NOTIFICATION TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_notification_user_created" ON "Notification" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_notification_unread" ON "Notification" ("userId", "isRead") WHERE "isRead" = false;
CREATE INDEX IF NOT EXISTS "idx_notification_type" ON "Notification" ("type");

-- ============================================================================
-- PART 19: PERFORMANCE INDEXES - MATCH TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_match_sender_status" ON "Match" ("senderId", "status");
CREATE INDEX IF NOT EXISTS "idx_match_receiver_status" ON "Match" ("receiverId", "status");
CREATE INDEX IF NOT EXISTS "idx_match_pending" ON "Match" ("receiverId", "createdAt" DESC) WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "idx_match_accepted" ON "Match" ("senderId", "receiverId") WHERE "status" = 'ACCEPTED';
CREATE INDEX IF NOT EXISTS "idx_match_created" ON "Match" ("createdAt" DESC);

-- ============================================================================
-- PART 20: PERFORMANCE INDEXES - STUDY SESSION TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_session_creator" ON "StudySession" ("createdBy", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_session_user" ON "StudySession" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_session_status" ON "StudySession" ("status");
CREATE INDEX IF NOT EXISTS "idx_session_scheduled" ON "StudySession" ("scheduledAt") WHERE "scheduledAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_session_active" ON "StudySession" ("status", "createdAt" DESC)
  WHERE "status" IN ('WAITING', 'ACTIVE');
CREATE INDEX IF NOT EXISTS "idx_session_waiting_expires" ON "StudySession" ("waitingExpiresAt")
  WHERE "status" = 'WAITING';
CREATE INDEX IF NOT EXISTS "idx_session_subject" ON "StudySession" ("subject") WHERE "subject" IS NOT NULL;

-- ============================================================================
-- PART 21: PERFORMANCE INDEXES - POST TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_post_user_created" ON "Post" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_post_feed" ON "Post" ("createdAt" DESC) WHERE "isDeleted" = false;
CREATE INDEX IF NOT EXISTS "idx_post_deleted" ON "Post" ("deletedAt") WHERE "deletedAt" IS NOT NULL;

-- ============================================================================
-- PART 22: PERFORMANCE INDEXES - GROUP TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_group_privacy" ON "Group" ("privacy", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_group_name" ON "Group" ("name");
CREATE INDEX IF NOT EXISTS "idx_group_owner" ON "Group" ("ownerId");
CREATE INDEX IF NOT EXISTS "idx_group_subject" ON "Group" ("subject");
CREATE INDEX IF NOT EXISTS "idx_group_not_deleted" ON "Group" ("createdAt" DESC) WHERE "isDeleted" = false;

-- ============================================================================
-- PART 23: PERFORMANCE INDEXES - GROUP MEMBER TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_group_member_user" ON "GroupMember" ("userId");
CREATE INDEX IF NOT EXISTS "idx_group_member_group" ON "GroupMember" ("groupId");
CREATE INDEX IF NOT EXISTS "idx_group_member_role" ON "GroupMember" ("role");

-- ============================================================================
-- PART 24: PERFORMANCE INDEXES - PRESENCE TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_presence_status" ON "user_presence" ("status") WHERE "status" != 'offline';
CREATE INDEX IF NOT EXISTS "idx_presence_activity" ON "user_presence" ("lastActivityAt");
CREATE INDEX IF NOT EXISTS "idx_device_session_active" ON "device_sessions" ("userId", "isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_device_session_heartbeat" ON "device_sessions" ("lastHeartbeatAt") WHERE "isActive" = true;

-- ============================================================================
-- PART 25: PERFORMANCE INDEXES - ADMIN TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_audit_admin_created" ON "AdminAuditLog" ("adminId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "AdminAuditLog" ("action", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_target" ON "AdminAuditLog" ("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "idx_report_status" ON "Report" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_report_pending" ON "Report" ("createdAt" DESC) WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "idx_flagged_pending" ON "flagged_content" ("flaggedAt" DESC) WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "idx_announcement_active" ON "Announcement" ("startsAt", "expiresAt") WHERE "status" = 'ACTIVE';

-- ============================================================================
-- PART 26: PERFORMANCE INDEXES - BLOCKED USERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_blocked_user" ON "BlockedUser" ("userId");
CREATE INDEX IF NOT EXISTS "idx_blocked_target" ON "BlockedUser" ("blockedUserId");
CREATE INDEX IF NOT EXISTS "idx_blocked_lookup" ON "BlockedUser" ("userId", "blockedUserId");

-- ============================================================================
-- PART 27: PERFORMANCE INDEXES - FLASHCARDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_flashcard_user" ON "SessionFlashcard" ("userId");
CREATE INDEX IF NOT EXISTS "idx_flashcard_session" ON "SessionFlashcard" ("sessionId");
CREATE INDEX IF NOT EXISTS "idx_flashcard_review_due" ON "SessionFlashcard" ("userId", "nextReviewDate")
  WHERE "nextReviewDate" IS NOT NULL;

-- ============================================================================
-- PART 28: ENABLE REALTIME
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'Message') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Message";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'Notification') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'Match') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Match";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "user_presence";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'GroupMember') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "GroupMember";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "typing_indicators";
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check policies:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Check indexes:
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;

-- Check realtime:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
