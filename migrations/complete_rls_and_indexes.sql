-- ============================================================================
-- CLERVA APP - Complete RLS Security & Database Index Optimization
-- ============================================================================
--
-- This comprehensive migration includes:
-- 1. RLS (Row Level Security) policies for ALL tables
-- 2. Performance-optimized indexes for common queries
-- 3. Uses (select auth.uid()) pattern for optimal performance
-- 4. Consolidated policies to avoid multiple_permissive_policies warnings
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENABLE RLS ON ALL TABLES
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
-- SECTION 2: DROP ALL EXISTING POLICIES (Clean Slate)
-- ============================================================================

-- User Tables
DROP POLICY IF EXISTS "Users can view own data" ON "User";
DROP POLICY IF EXISTS "Users can update own data" ON "User";

DROP POLICY IF EXISTS "Users can view own profile" ON "Profile";
DROP POLICY IF EXISTS "Users can view public profiles" ON "Profile";
DROP POLICY IF EXISTS "Users can update own profile" ON "Profile";

DROP POLICY IF EXISTS "Users can view own learning profile" ON "LearningProfile";
DROP POLICY IF EXISTS "Users can update own learning profile" ON "LearningProfile";

DROP POLICY IF EXISTS "Users can view own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can update own settings" ON "UserSettings";

-- Match
DROP POLICY IF EXISTS "Users can view own matches" ON "Match";
DROP POLICY IF EXISTS "Users can create matches" ON "Match";
DROP POLICY IF EXISTS "Users can update own matches" ON "Match";

-- BlockedUser
DROP POLICY IF EXISTS "Users can view own blocks" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can create blocks" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can delete own blocks" ON "BlockedUser";

-- Group
DROP POLICY IF EXISTS "Users can view groups - optimized" ON "Group";
DROP POLICY IF EXISTS "Users can create groups" ON "Group";
DROP POLICY IF EXISTS "Group owners can update" ON "Group";
DROP POLICY IF EXISTS "Group owners can delete" ON "Group";

-- GroupMember
DROP POLICY IF EXISTS "Users can view group members - consolidated" ON "GroupMember";
DROP POLICY IF EXISTS "Users can join groups" ON "GroupMember";
DROP POLICY IF EXISTS "Users can leave groups" ON "GroupMember";

-- GroupInvite
DROP POLICY IF EXISTS "Users can view group invites - optimized" ON "GroupInvite";
DROP POLICY IF EXISTS "Users can create group invites" ON "GroupInvite";
DROP POLICY IF EXISTS "Users can respond to invites" ON "GroupInvite";

-- Message
DROP POLICY IF EXISTS "Users can access messages in their conversations" ON "Message";
DROP POLICY IF EXISTS "Users can send messages" ON "Message";
DROP POLICY IF EXISTS "Users can update own messages" ON "Message";
DROP POLICY IF EXISTS "Users can delete own messages" ON "Message";

-- Notification
DROP POLICY IF EXISTS "Users can only access own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only insert own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only update own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only delete own notifications" ON "Notification";

-- StudySession
DROP POLICY IF EXISTS "Session participants can view sessions - optimized" ON "StudySession";
DROP POLICY IF EXISTS "Users can create sessions - optimized" ON "StudySession";
DROP POLICY IF EXISTS "Session hosts can update sessions - optimized" ON "StudySession";

-- user_presence
DROP POLICY IF EXISTS "Users can view presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can view presence - consolidated" ON "user_presence";
DROP POLICY IF EXISTS "Users can manage own presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can insert own presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can update own presence" ON "user_presence";
DROP POLICY IF EXISTS "Users can delete own presence" ON "user_presence";

-- Admin tables
DROP POLICY IF EXISTS "Only admins can view audit logs" ON "AdminAuditLog";
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON "AdminAuditLog";
DROP POLICY IF EXISTS "Anyone can view active announcements" ON "Announcement";
DROP POLICY IF EXISTS "Only admins can manage announcements" ON "Announcement";
DROP POLICY IF EXISTS "Users can view own dismissals" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "Users can dismiss announcements" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "Users can delete own dismissals" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "Users can view own reports or admins view all" ON "Report";
DROP POLICY IF EXISTS "Users can create reports" ON "Report";
DROP POLICY IF EXISTS "Only admins can update reports" ON "Report";
DROP POLICY IF EXISTS "Users can view own warnings or admins view all" ON "UserWarning";
DROP POLICY IF EXISTS "Only admins can manage warnings" ON "UserWarning";
DROP POLICY IF EXISTS "Only admins can view bans" ON "UserBan";
DROP POLICY IF EXISTS "Only admins can manage bans" ON "UserBan";
DROP POLICY IF EXISTS "Only admins can view flagged content" ON "flagged_content";
DROP POLICY IF EXISTS "System can insert flagged content" ON "flagged_content";
DROP POLICY IF EXISTS "Only admins can update flagged content" ON "flagged_content";
DROP POLICY IF EXISTS "Users can view own feedback or admins view all" ON "Feedback";
DROP POLICY IF EXISTS "Users can create feedback" ON "Feedback";
DROP POLICY IF EXISTS "Only admins can update feedback" ON "Feedback";

-- ============================================================================
-- SECTION 3: USER & PROFILE POLICIES
-- ============================================================================

-- User: Users can view basic info of all users (for search/matching)
CREATE POLICY "Users can view user profiles"
ON "User"
FOR SELECT
USING (true); -- Public profiles, sensitive data filtered at API level

-- User: Users can only update themselves
CREATE POLICY "Users can update own data"
ON "User"
FOR UPDATE
USING ((select auth.uid())::text = id);

-- Profile: Users can view all profiles (for matching)
CREATE POLICY "Users can view all profiles"
ON "Profile"
FOR SELECT
USING (true);

-- Profile: Users can only modify their own
CREATE POLICY "Users can manage own profile"
ON "Profile"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- LearningProfile: Users can view all (for matching), modify own
CREATE POLICY "Users can view learning profiles"
ON "LearningProfile"
FOR SELECT
USING (true);

CREATE POLICY "Users can manage own learning profile"
ON "LearningProfile"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- UserSettings: Users can only access their own
CREATE POLICY "Users can manage own settings"
ON "UserSettings"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 4: MATCH & CONNECTION POLICIES
-- ============================================================================

-- Match: Users can view matches they're part of
CREATE POLICY "Users can view own matches"
ON "Match"
FOR SELECT
USING (
  (select auth.uid())::text = "senderId"
  OR (select auth.uid())::text = "receiverId"
);

-- Match: Users can create matches (send connection requests)
CREATE POLICY "Users can create matches"
ON "Match"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "senderId");

-- Match: Users can update matches they're involved in
CREATE POLICY "Users can update own matches"
ON "Match"
FOR UPDATE
USING (
  (select auth.uid())::text = "senderId"
  OR (select auth.uid())::text = "receiverId"
);

-- BlockedUser: Users can manage their own blocks
CREATE POLICY "Users can manage own blocks"
ON "BlockedUser"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 5: GROUP POLICIES
-- ============================================================================

-- Group: View public groups OR groups user is member of
CREATE POLICY "Users can view accessible groups"
ON "Group"
FOR SELECT
USING (
  "privacy" = 'PUBLIC'
  OR (select auth.uid())::text = "ownerId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "Group"."id"
    AND gm."userId" = (select auth.uid())::text
  )
);

-- Group: Anyone can create groups
CREATE POLICY "Users can create groups"
ON "Group"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "ownerId");

-- Group: Only owner can update
CREATE POLICY "Group owners can update"
ON "Group"
FOR UPDATE
USING ((select auth.uid())::text = "ownerId");

-- Group: Only owner can delete
CREATE POLICY "Group owners can delete"
ON "Group"
FOR DELETE
USING ((select auth.uid())::text = "ownerId");

-- GroupMember: View members of groups you're in
CREATE POLICY "Users can view group members"
ON "GroupMember"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "GroupMember"."groupId"
    AND gm."userId" = (select auth.uid())::text
  )
);

-- GroupMember: Users can join groups
CREATE POLICY "Users can join groups"
ON "GroupMember"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- GroupMember: Users can leave (delete their own membership)
CREATE POLICY "Users can leave groups"
ON "GroupMember"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- GroupInvite: View invites sent to you or by you
CREATE POLICY "Users can view group invites"
ON "GroupInvite"
FOR SELECT
USING (
  (select auth.uid())::text = "inviterId"
  OR (select auth.uid())::text = "inviteeId"
);

-- GroupInvite: Create invites
CREATE POLICY "Users can create group invites"
ON "GroupInvite"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "inviterId");

-- GroupInvite: Invitee can respond
CREATE POLICY "Invitees can respond to invites"
ON "GroupInvite"
FOR UPDATE
USING ((select auth.uid())::text = "inviteeId");

-- ============================================================================
-- SECTION 6: MESSAGE POLICIES
-- ============================================================================

-- Message: View messages in conversations you're part of
CREATE POLICY "Users can view messages"
ON "Message"
FOR SELECT
USING (
  (select auth.uid())::text = "senderId"
  OR (select auth.uid())::text = "recipientId"
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "Message"."groupId"
    AND gm."userId" = (select auth.uid())::text
  )
);

-- Message: Send messages
CREATE POLICY "Users can send messages"
ON "Message"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "senderId");

-- Message: Update own messages
CREATE POLICY "Users can update own messages"
ON "Message"
FOR UPDATE
USING ((select auth.uid())::text = "senderId");

-- Message: Soft delete own messages
CREATE POLICY "Users can delete own messages"
ON "Message"
FOR DELETE
USING ((select auth.uid())::text = "senderId");

-- ConversationArchive: Users manage own archives
CREATE POLICY "Users can manage own archives"
ON "ConversationArchive"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 7: STUDY SESSION POLICIES
-- ============================================================================

-- StudySession: View sessions you're part of
CREATE POLICY "Users can view sessions"
ON "StudySession"
FOR SELECT
USING (
  (select auth.uid())::text = "createdBy"
  OR (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "StudySession"."id"
    AND sp."userId" = (select auth.uid())::text
  )
);

-- StudySession: Create sessions
CREATE POLICY "Users can create sessions"
ON "StudySession"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "createdBy");

-- StudySession: Update sessions you host
CREATE POLICY "Hosts can update sessions"
ON "StudySession"
FOR UPDATE
USING (
  (select auth.uid())::text = "createdBy"
  OR (select auth.uid())::text = "userId"
);

-- SessionParticipant: View participants in sessions you're in
CREATE POLICY "Users can view session participants"
ON "SessionParticipant"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionParticipant"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

-- SessionParticipant: Join sessions
CREATE POLICY "Users can join sessions"
ON "SessionParticipant"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- SessionParticipant: Update own status
CREATE POLICY "Users can update own participation"
ON "SessionParticipant"
FOR UPDATE
USING ((select auth.uid())::text = "userId");

-- SessionGoal: View goals for sessions you're in
CREATE POLICY "Participants can view session goals"
ON "SessionGoal"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionGoal"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

-- SessionGoal: Manage goals (host only)
CREATE POLICY "Hosts can manage session goals"
ON "SessionGoal"
FOR ALL
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

-- SessionMessage: View messages in sessions you're in
CREATE POLICY "Participants can view session messages"
ON "SessionMessage"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionMessage"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

-- SessionMessage: Send messages
CREATE POLICY "Participants can send session messages"
ON "SessionMessage"
FOR INSERT
WITH CHECK (
  (select auth.uid())::text = "senderId"
  AND EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionMessage"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

-- SessionTimer: View/manage timer for sessions you're in
CREATE POLICY "Participants can view session timer"
ON "SessionTimer"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionTimer"."sessionId"
    AND sp."userId" = (select auth.uid())::text
  )
);

CREATE POLICY "Hosts can manage session timer"
ON "SessionTimer"
FOR ALL
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
-- SECTION 8: COLLABORATION FEATURES POLICIES
-- ============================================================================

-- SessionWhiteboard: Participants can view/edit
CREATE POLICY "Participants can access whiteboards"
ON "SessionWhiteboard"
FOR ALL
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

-- SessionWhiteboardVersion: Participants can view/create
CREATE POLICY "Participants can access whiteboard versions"
ON "SessionWhiteboardVersion"
FOR ALL
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

-- SessionNote: Participants can access
CREATE POLICY "Participants can access notes"
ON "SessionNote"
FOR ALL
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

-- SessionFlashcard: Users can only access their own
CREATE POLICY "Users can manage own flashcards"
ON "SessionFlashcard"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 9: GAMIFICATION POLICIES
-- ============================================================================

-- Badge: Everyone can view badges
CREATE POLICY "Anyone can view badges"
ON "Badge"
FOR SELECT
USING (true);

-- UserBadge: View badges of any user
CREATE POLICY "Anyone can view user badges"
ON "UserBadge"
FOR SELECT
USING (true);

-- UserBadge: System can award badges
CREATE POLICY "System can award badges"
ON "UserBadge"
FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- SECTION 10: NOTIFICATION POLICIES
-- ============================================================================

-- Notification: Users can only access their own
CREATE POLICY "Users can view own notifications"
ON "Notification"
FOR SELECT
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can insert own notifications"
ON "Notification"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own notifications"
ON "Notification"
FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own notifications"
ON "Notification"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- Session (Auth): Users can only access their own
CREATE POLICY "Users can manage own sessions"
ON "Session"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 11: COMMUNITY (POSTS) POLICIES
-- ============================================================================

-- Post: View non-deleted public posts or own posts
CREATE POLICY "Users can view posts"
ON "Post"
FOR SELECT
USING (
  "isDeleted" = false
  OR (select auth.uid())::text = "userId"
);

-- Post: Create posts
CREATE POLICY "Users can create posts"
ON "Post"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- Post: Update own posts
CREATE POLICY "Users can update own posts"
ON "Post"
FOR UPDATE
USING ((select auth.uid())::text = "userId");

-- Post: Delete own posts
CREATE POLICY "Users can delete own posts"
ON "Post"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- PostLike: View all likes
CREATE POLICY "Anyone can view likes"
ON "PostLike"
FOR SELECT
USING (true);

-- PostLike: Users can like
CREATE POLICY "Users can create likes"
ON "PostLike"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- PostLike: Users can unlike
CREATE POLICY "Users can delete own likes"
ON "PostLike"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- PostComment: View all comments
CREATE POLICY "Anyone can view comments"
ON "PostComment"
FOR SELECT
USING (true);

-- PostComment: Users can comment
CREATE POLICY "Users can create comments"
ON "PostComment"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- PostComment: Users can edit own comments
CREATE POLICY "Users can update own comments"
ON "PostComment"
FOR UPDATE
USING ((select auth.uid())::text = "userId");

-- PostComment: Users can delete own comments
CREATE POLICY "Users can delete own comments"
ON "PostComment"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- PostRepost: View all reposts
CREATE POLICY "Anyone can view reposts"
ON "PostRepost"
FOR SELECT
USING (true);

-- PostRepost: Users can repost
CREATE POLICY "Users can create reposts"
ON "PostRepost"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- PostRepost: Users can delete own reposts
CREATE POLICY "Users can delete own reposts"
ON "PostRepost"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 12: PRESENCE SYSTEM POLICIES
-- ============================================================================

-- user_presence: View own or connected users' presence
CREATE POLICY "Users can view presence"
ON "user_presence"
FOR SELECT
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

-- user_presence: Users can manage own
CREATE POLICY "Users can insert own presence"
ON "user_presence"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can update own presence"
ON "user_presence"
FOR UPDATE
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own presence"
ON "user_presence"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- device_sessions: Users can manage own
CREATE POLICY "Users can manage own device sessions"
ON "device_sessions"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- message_read_status: Users can view reads for messages they sent/received
CREATE POLICY "Users can view message read status"
ON "message_read_status"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "Message" m
    WHERE m."id" = "message_read_status"."messageId"
    AND (m."senderId" = (select auth.uid())::text OR m."recipientId" = (select auth.uid())::text)
  )
);

CREATE POLICY "Users can mark messages as read"
ON "message_read_status"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- typing_indicators: Users can manage own
CREATE POLICY "Users can manage own typing"
ON "typing_indicators"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- ============================================================================
-- SECTION 13: ADMIN & MODERATION POLICIES
-- ============================================================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AdminAuditLog: Admin only
CREATE POLICY "Admins can view audit logs"
ON "AdminAuditLog"
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert audit logs"
ON "AdminAuditLog"
FOR INSERT
WITH CHECK (is_admin());

-- Announcement: Public read active, admin write
CREATE POLICY "Users can view active announcements"
ON "Announcement"
FOR SELECT
USING (
  "status" = 'ACTIVE'
  OR is_admin()
);

CREATE POLICY "Admins can manage announcements"
ON "Announcement"
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- AnnouncementDismissal: Users manage own
CREATE POLICY "Users can manage own dismissals"
ON "AnnouncementDismissal"
FOR ALL
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- Report: Users can view own, create; admins can view all, update
CREATE POLICY "Users can view own reports"
ON "Report"
FOR SELECT
USING (
  (select auth.uid())::text = "reporterId"
  OR is_admin()
);

CREATE POLICY "Users can create reports"
ON "Report"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "reporterId");

CREATE POLICY "Admins can update reports"
ON "Report"
FOR UPDATE
USING (is_admin());

-- UserWarning: Users see own, admins manage
CREATE POLICY "Users can view own warnings"
ON "UserWarning"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR is_admin()
);

CREATE POLICY "Admins can manage warnings"
ON "UserWarning"
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- UserBan: Admin only
CREATE POLICY "Admins can view bans"
ON "UserBan"
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can manage bans"
ON "UserBan"
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- flagged_content: Admin only + system insert
CREATE POLICY "Admins can view flagged content"
ON "flagged_content"
FOR SELECT
USING (is_admin());

CREATE POLICY "System can insert flagged content"
ON "flagged_content"
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update flagged content"
ON "flagged_content"
FOR UPDATE
USING (is_admin());

-- Feedback: Users create/view own, admins view/update all
CREATE POLICY "Users can view own feedback"
ON "Feedback"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR is_admin()
);

CREATE POLICY "Users can create feedback"
ON "Feedback"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Admins can update feedback"
ON "Feedback"
FOR UPDATE
USING (is_admin());

-- ============================================================================
-- SECTION 14: PERFORMANCE INDEXES
-- ============================================================================

-- User indexes (additional to Prisma)
CREATE INDEX IF NOT EXISTS idx_user_created_at ON "User" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_user_last_login ON "User" ("lastLoginAt");
CREATE INDEX IF NOT EXISTS idx_user_subscription ON "User" ("subscriptionStatus");

-- Profile indexes for search/matching
CREATE INDEX IF NOT EXISTS idx_profile_skill_level ON "Profile" ("skillLevel");
CREATE INDEX IF NOT EXISTS idx_profile_study_style ON "Profile" ("studyStyle");
CREATE INDEX IF NOT EXISTS idx_profile_looking_for_partner ON "Profile" ("isLookingForPartner");
CREATE INDEX IF NOT EXISTS idx_profile_location_country ON "Profile" ("location_country");

-- Match indexes for connection queries
CREATE INDEX IF NOT EXISTS idx_match_created_at ON "Match" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_match_status_created ON "Match" ("status", "createdAt");

-- Message indexes for chat performance
CREATE INDEX IF NOT EXISTS idx_message_dm_unread ON "Message" ("recipientId", "isRead", "isDeleted") WHERE "groupId" IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_group_unread ON "Message" ("groupId", "isRead", "isDeleted") WHERE "groupId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_recent ON "Message" ("createdAt" DESC) WHERE "isDeleted" = false;

-- Group indexes
CREATE INDEX IF NOT EXISTS idx_group_created_at ON "Group" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_group_name_search ON "Group" USING gin (to_tsvector('english', "name"));

-- GroupMember indexes
CREATE INDEX IF NOT EXISTS idx_group_member_role ON "GroupMember" ("role");

-- StudySession indexes
CREATE INDEX IF NOT EXISTS idx_session_waiting ON "StudySession" ("status", "waitingExpiresAt") WHERE "status" = 'WAITING';
CREATE INDEX IF NOT EXISTS idx_session_active ON "StudySession" ("status", "startedAt") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_session_subject ON "StudySession" ("subject");

-- SessionParticipant indexes
CREATE INDEX IF NOT EXISTS idx_participant_joined ON "SessionParticipant" ("joinedAt");

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_type ON "Notification" ("type");
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON "Notification" ("userId", "isRead") WHERE "isRead" = false;

-- Post indexes for feed performance
CREATE INDEX IF NOT EXISTS idx_post_feed ON "Post" ("createdAt" DESC, "isDeleted") WHERE "isDeleted" = false;
CREATE INDEX IF NOT EXISTS idx_post_user_recent ON "Post" ("userId", "createdAt" DESC) WHERE "isDeleted" = false;

-- PostLike/Comment indexes
CREATE INDEX IF NOT EXISTS idx_postlike_created ON "PostLike" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_postcomment_recent ON "PostComment" ("postId", "createdAt" DESC);

-- Presence indexes
CREATE INDEX IF NOT EXISTS idx_presence_status ON "user_presence" ("status");
CREATE INDEX IF NOT EXISTS idx_presence_last_activity ON "user_presence" ("lastActivityAt");
CREATE INDEX IF NOT EXISTS idx_device_session_heartbeat ON "device_sessions" ("lastHeartbeatAt");

-- Admin indexes
CREATE INDEX IF NOT EXISTS idx_report_pending ON "Report" ("status", "createdAt") WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_flagged_pending ON "flagged_content" ("status", "flaggedAt") WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_announcement_active ON "Announcement" ("status", "startsAt", "expiresAt") WHERE "status" = 'ACTIVE';

-- Flashcard spaced repetition index
CREATE INDEX IF NOT EXISTS idx_flashcard_review_due ON "SessionFlashcard" ("userId", "nextReviewDate") WHERE "nextReviewDate" IS NOT NULL;

-- Blocked users index for quick lookups
CREATE INDEX IF NOT EXISTS idx_blocked_lookup ON "BlockedUser" ("userId", "blockedUserId");

-- ============================================================================
-- SECTION 15: ENABLE REALTIME FOR KEY TABLES
-- ============================================================================

-- Enable Supabase Realtime for live updates
DO $$
BEGIN
  -- Check if tables are already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Message'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Message";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Notification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Match'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Match";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "user_presence";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'GroupMember'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "GroupMember";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "typing_indicators";
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm)
-- ============================================================================

-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Check all policies:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check indexes:
-- SELECT tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- Check realtime tables:
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
-- ORDER BY tablename;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
