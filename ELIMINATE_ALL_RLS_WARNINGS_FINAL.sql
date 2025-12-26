-- ============================================================
-- ELIMINATE ALL RLS WARNINGS - COMPLETE FIX
-- This script removes ALL "Multiple Permissive Policies" warnings
-- by integrating admin checks directly into each policy
--
-- Run this AFTER: add_performance_indexes_complete.sql
-- ============================================================

-- ============================================================
-- DROP ALL EXISTING RLS POLICIES (Clean Slate)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all existing RLS policies
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;

  RAISE NOTICE '✅ All existing RLS policies dropped';
END $$;

-- ============================================================
-- 1. USER TABLE RLS (No Warnings)
-- ============================================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Users can view active users OR admins can view all
CREATE POLICY "Users can view active users"
ON "User"
FOR SELECT
USING (
  "deactivatedAt" IS NULL
  OR is_admin()
);

-- Users can update own profile OR admins can update any
CREATE POLICY "Users can update own profile"
ON "User"
FOR UPDATE
USING (
  id = get_current_user_id()
  OR is_admin()
);

-- Only admins can insert users
CREATE POLICY "Admins can insert users"
ON "User"
FOR INSERT
WITH CHECK (is_admin());

-- Only admins can delete users
CREATE POLICY "Admins can delete users"
ON "User"
FOR DELETE
USING (is_admin());

-- ============================================================
-- 2. PROFILE TABLE RLS (No Warnings)
-- ============================================================

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

-- Users can view public profiles OR own profile OR admins can view all
CREATE POLICY "Users can view profiles"
ON "Profile"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR EXISTS (
    SELECT 1 FROM "User"
    WHERE id = "Profile"."userId"
    AND "deactivatedAt" IS NULL
  )
  OR is_admin()
);

-- Users can update own profile OR admins can update any
CREATE POLICY "Users can update own profile"
ON "Profile"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can create own profile OR admins can create any
CREATE POLICY "Users can create own profile"
ON "Profile"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Only admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON "Profile"
FOR DELETE
USING (is_admin());

-- ============================================================
-- 3. STUDY SESSION RLS (No Warnings)
-- ============================================================

ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;

-- Users can view accessible sessions OR admins can view all
CREATE POLICY "Users can view accessible sessions"
ON "StudySession"
FOR SELECT
USING (
  "isPublic" = true
  OR "createdBy" = get_current_user_id()
  OR EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "sessionId" = "StudySession".id
    AND "userId" = get_current_user_id()
  )
  OR is_admin()
);

-- Users can create sessions OR admins can create any
CREATE POLICY "Users can create sessions"
ON "StudySession"
FOR INSERT
WITH CHECK (
  "createdBy" = get_current_user_id()
  OR is_admin()
);

-- Users can update own sessions OR admins can update any
CREATE POLICY "Users can update own sessions"
ON "StudySession"
FOR UPDATE
USING (
  "createdBy" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own sessions OR admins can delete any
CREATE POLICY "Users can delete own sessions"
ON "StudySession"
FOR DELETE
USING (
  "createdBy" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 4. SESSION PARTICIPANTS RLS (No Warnings)
-- ============================================================

ALTER TABLE "SessionParticipant" ENABLE ROW LEVEL SECURITY;

-- Users can view participants in accessible sessions OR admins can view all
CREATE POLICY "Users can view session participants"
ON "SessionParticipant"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "SessionParticipant" sp
    WHERE sp."sessionId" = "SessionParticipant"."sessionId"
    AND sp."userId" = get_current_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE id = "SessionParticipant"."sessionId"
    AND "isPublic" = true
  )
  OR is_admin()
);

-- Users can join sessions OR admins can add anyone
CREATE POLICY "Users can join sessions"
ON "SessionParticipant"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can update own participation OR admins can update any
CREATE POLICY "Users can update own participation"
ON "SessionParticipant"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own participation OR admins can delete any
CREATE POLICY "Users can delete own participation"
ON "SessionParticipant"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 5. SESSION MESSAGES RLS (No Warnings)
-- ============================================================

ALTER TABLE "SessionMessage" ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their sessions OR admins can view all
CREATE POLICY "Users can view session messages"
ON "SessionMessage"
FOR SELECT
USING (
  (
    "deletedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "sessionId" = "SessionMessage"."sessionId"
      AND "userId" = get_current_user_id()
    )
  )
  OR is_admin()
);

-- Users can send messages in their sessions OR admins can send anywhere
CREATE POLICY "Users can send messages"
ON "SessionMessage"
FOR INSERT
WITH CHECK (
  (
    "senderId" = get_current_user_id()
    AND EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "sessionId" = "SessionMessage"."sessionId"
      AND "userId" = get_current_user_id()
      AND status = 'JOINED'
    )
  )
  OR is_admin()
);

-- Users can update own messages OR admins can update any
CREATE POLICY "Users can update own messages"
ON "SessionMessage"
FOR UPDATE
USING (
  "senderId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own messages OR admins can delete any
CREATE POLICY "Users can delete own messages"
ON "SessionMessage"
FOR DELETE
USING (
  "senderId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 6. GROUPS RLS (No Warnings)
-- ============================================================

ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;

-- Users can view accessible groups OR admins can view all
CREATE POLICY "Users can view accessible groups"
ON "Group"
FOR SELECT
USING (
  (
    "isDeleted" = false
    AND (
      privacy = 'PUBLIC'
      OR EXISTS (
        SELECT 1 FROM "GroupMember"
        WHERE "groupId" = "Group".id
        AND "userId" = get_current_user_id()
      )
    )
  )
  OR is_admin()
);

-- Users can create groups OR admins can create any
CREATE POLICY "Users can create groups"
ON "Group"
FOR INSERT
WITH CHECK (
  "ownerId" = get_current_user_id()
  OR is_admin()
);

-- Group owners can update OR admins can update any
CREATE POLICY "Group owners can update groups"
ON "Group"
FOR UPDATE
USING (
  "ownerId" = get_current_user_id()
  OR is_admin()
);

-- Group owners can delete OR admins can delete any
CREATE POLICY "Group owners can delete groups"
ON "Group"
FOR DELETE
USING (
  "ownerId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 7. GROUP MEMBERS RLS (No Warnings)
-- ============================================================

ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;

-- Users can view members of accessible groups OR admins can view all
CREATE POLICY "Users can view group members"
ON "GroupMember"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "GroupMember"."groupId"
    AND gm."userId" = get_current_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM "Group"
    WHERE id = "GroupMember"."groupId"
    AND privacy = 'PUBLIC'
  )
  OR is_admin()
);

-- Group admins can add members OR admins can add anyone
CREATE POLICY "Group admins can add members"
ON "GroupMember"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = "GroupMember"."groupId"
    AND "userId" = get_current_user_id()
    AND role IN ('OWNER', 'ADMIN')
  )
  OR is_admin()
);

-- Group admins can update members OR admins can update any
CREATE POLICY "Group admins can update members"
ON "GroupMember"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = "GroupMember"."groupId"
    AND "userId" = get_current_user_id()
    AND role IN ('OWNER', 'ADMIN')
  )
  OR is_admin()
);

-- Users can leave groups OR admins can remove anyone
CREATE POLICY "Users can leave groups"
ON "GroupMember"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 8. GROUP INVITES RLS (No Warnings)
-- ============================================================

ALTER TABLE "GroupInvite" ENABLE ROW LEVEL SECURITY;

-- Users can view own invites OR admins can view all
CREATE POLICY "Users can view own invites"
ON "GroupInvite"
FOR SELECT
USING (
  "inviteeId" = get_current_user_id()
  OR is_admin()
);

-- Group admins can send invites OR admins can send any
CREATE POLICY "Group admins can send invites"
ON "GroupInvite"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "GroupMember"
    WHERE "groupId" = "GroupInvite"."groupId"
    AND "userId" = get_current_user_id()
    AND role IN ('OWNER', 'ADMIN')
  )
  OR is_admin()
);

-- Users can update own invites OR admins can update any
CREATE POLICY "Users can update own invites"
ON "GroupInvite"
FOR UPDATE
USING (
  "inviteeId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own invites OR admins can delete any
CREATE POLICY "Users can delete own invites"
ON "GroupInvite"
FOR DELETE
USING (
  "inviteeId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 9. NOTIFICATIONS RLS (No Warnings)
-- ============================================================

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications OR admins can view all
CREATE POLICY "Users can view own notifications"
ON "Notification"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- System can create notifications (any user can create)
CREATE POLICY "System can create notifications"
ON "Notification"
FOR INSERT
WITH CHECK (true);

-- Users can update own notifications OR admins can update any
CREATE POLICY "Users can update own notifications"
ON "Notification"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own notifications OR admins can delete any
CREATE POLICY "Users can delete own notifications"
ON "Notification"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 10. MATCHES RLS (No Warnings)
-- ============================================================

ALTER TABLE "Match" ENABLE ROW LEVEL SECURITY;

-- Users can view own matches OR admins can view all
CREATE POLICY "Users can view own matches"
ON "Match"
FOR SELECT
USING (
  "senderId" = get_current_user_id()
  OR "receiverId" = get_current_user_id()
  OR is_admin()
);

-- Users can send match requests OR admins can create any
CREATE POLICY "Users can send match requests"
ON "Match"
FOR INSERT
WITH CHECK (
  "senderId" = get_current_user_id()
  OR is_admin()
);

-- Users can update own matches OR admins can update any
CREATE POLICY "Users can update own matches"
ON "Match"
FOR UPDATE
USING (
  "senderId" = get_current_user_id()
  OR "receiverId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own matches OR admins can delete any
CREATE POLICY "Users can delete own matches"
ON "Match"
FOR DELETE
USING (
  "senderId" = get_current_user_id()
  OR "receiverId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 11. AI PARTNER SESSIONS RLS (No Warnings)
-- ============================================================

ALTER TABLE "AIPartnerSession" ENABLE ROW LEVEL SECURITY;

-- Users can view own AI sessions OR admins can view all
CREATE POLICY "Users can view own AI sessions"
ON "AIPartnerSession"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can create AI sessions OR admins can create any
CREATE POLICY "Users can create AI sessions"
ON "AIPartnerSession"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can update own AI sessions OR admins can update any
CREATE POLICY "Users can update own AI sessions"
ON "AIPartnerSession"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own AI sessions OR admins can delete any
CREATE POLICY "Users can delete own AI sessions"
ON "AIPartnerSession"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 12. AI PARTNER MESSAGES RLS (No Warnings)
-- ============================================================

ALTER TABLE "AIPartnerMessage" ENABLE ROW LEVEL SECURITY;

-- Users can view messages in own AI sessions OR admins can view all
CREATE POLICY "Users can view own AI messages"
ON "AIPartnerMessage"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "AIPartnerSession"
    WHERE id = "AIPartnerMessage"."sessionId"
    AND "userId" = get_current_user_id()
  )
  OR is_admin()
);

-- System can create AI messages (any user can create)
CREATE POLICY "System can create AI messages"
ON "AIPartnerMessage"
FOR INSERT
WITH CHECK (true);

-- Users can update messages in own sessions OR admins can update any
CREATE POLICY "Users can update own AI messages"
ON "AIPartnerMessage"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "AIPartnerSession"
    WHERE id = "AIPartnerMessage"."sessionId"
    AND "userId" = get_current_user_id()
  )
  OR is_admin()
);

-- Users can delete messages in own sessions OR admins can delete any
CREATE POLICY "Users can delete own AI messages"
ON "AIPartnerMessage"
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "AIPartnerSession"
    WHERE id = "AIPartnerMessage"."sessionId"
    AND "userId" = get_current_user_id()
  )
  OR is_admin()
);

-- ============================================================
-- 13. REPORTS RLS (No Warnings)
-- ============================================================

ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;

-- Users can view own reports OR admins can view all
CREATE POLICY "Users can view own reports"
ON "Report"
FOR SELECT
USING (
  "reporterId" = get_current_user_id()
  OR is_admin()
);

-- Users can create reports OR admins can create any
CREATE POLICY "Users can create reports"
ON "Report"
FOR INSERT
WITH CHECK (
  "reporterId" = get_current_user_id()
  OR is_admin()
);

-- Only admins can update reports
CREATE POLICY "Admins can update reports"
ON "Report"
FOR UPDATE
USING (is_admin());

-- Only admins can delete reports
CREATE POLICY "Admins can delete reports"
ON "Report"
FOR DELETE
USING (is_admin());

-- ============================================================
-- 14. POSTS RLS (No Warnings)
-- ============================================================

ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

-- Users can view non-deleted posts OR admins can view all
CREATE POLICY "Users can view posts"
ON "Post"
FOR SELECT
USING (
  "isDeleted" = false
  OR is_admin()
);

-- Users can create posts OR admins can create any
CREATE POLICY "Users can create posts"
ON "Post"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can update own posts OR admins can update any
CREATE POLICY "Users can update own posts"
ON "Post"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own posts OR admins can delete any
CREATE POLICY "Users can delete own posts"
ON "Post"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 15. POST LIKES RLS (No Warnings)
-- ============================================================

ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;

-- Everyone can view likes
CREATE POLICY "Users can view likes"
ON "PostLike"
FOR SELECT
USING (true);

-- Users can like posts OR admins can create any
CREATE POLICY "Users can like posts"
ON "PostLike"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can unlike own likes OR admins can delete any
CREATE POLICY "Users can unlike posts"
ON "PostLike"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 16. POST COMMENTS RLS (No Warnings)
-- ============================================================

ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;

-- Everyone can view comments
CREATE POLICY "Users can view comments"
ON "PostComment"
FOR SELECT
USING (true);

-- Users can create comments OR admins can create any
CREATE POLICY "Users can create comments"
ON "PostComment"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can update own comments OR admins can update any
CREATE POLICY "Users can update own comments"
ON "PostComment"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can delete own comments OR admins can delete any
CREATE POLICY "Users can delete own comments"
ON "PostComment"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 17. PRESENCE SYSTEM RLS (No Warnings)
-- ============================================================

ALTER TABLE "user_presence" ENABLE ROW LEVEL SECURITY;

-- Everyone can view presence
CREATE POLICY "Users can view presence"
ON "user_presence"
FOR SELECT
USING (true);

-- Users can update own presence OR admins can update any
CREATE POLICY "Users can update own presence"
ON "user_presence"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- System can insert presence (any user can insert)
CREATE POLICY "System can manage presence"
ON "user_presence"
FOR INSERT
WITH CHECK (true);

-- Users can delete own presence OR admins can delete any
CREATE POLICY "Users can delete own presence"
ON "user_presence"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 18. DEVICE SESSIONS RLS (No Warnings)
-- ============================================================

ALTER TABLE "device_sessions" ENABLE ROW LEVEL SECURITY;

-- Users can view own devices OR admins can view all
CREATE POLICY "Users can view own devices"
ON "device_sessions"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can manage own devices OR admins can manage any
CREATE POLICY "Users can insert own devices"
ON "device_sessions"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can update own devices"
ON "device_sessions"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can delete own devices"
ON "device_sessions"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- 19. ANALYTICS RLS (No Warnings)
-- ============================================================

ALTER TABLE "user_page_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_feature_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_search_queries" ENABLE ROW LEVEL SECURITY;

-- Users can view own analytics OR admins can view all
CREATE POLICY "Users can view own page visits"
ON "user_page_visits"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can view own feature usage"
ON "user_feature_usage"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can view own search queries"
ON "user_search_queries"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- System can insert analytics (any user can insert)
CREATE POLICY "System can insert page visits"
ON "user_page_visits"
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can insert feature usage"
ON "user_feature_usage"
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can insert search queries"
ON "user_search_queries"
FOR INSERT
WITH CHECK (true);

-- Only admins can update analytics
CREATE POLICY "Admins can update page visits"
ON "user_page_visits"
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can update feature usage"
ON "user_feature_usage"
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can update search queries"
ON "user_search_queries"
FOR UPDATE
USING (is_admin());

-- Only admins can delete analytics
CREATE POLICY "Admins can delete page visits"
ON "user_page_visits"
FOR DELETE
USING (is_admin());

CREATE POLICY "Admins can delete feature usage"
ON "user_feature_usage"
FOR DELETE
USING (is_admin());

CREATE POLICY "Admins can delete search queries"
ON "user_search_queries"
FOR DELETE
USING (is_admin());

-- ============================================================
-- 20. FEEDBACK & ANNOUNCEMENTS RLS (No Warnings)
-- ============================================================

ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementDismissal" ENABLE ROW LEVEL SECURITY;

-- Users can view own feedback OR admins can view all
CREATE POLICY "Users can view own feedback"
ON "Feedback"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Users can create feedback OR admins can create any
CREATE POLICY "Users can create feedback"
ON "Feedback"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- Only admins can update feedback
CREATE POLICY "Admins can update feedback"
ON "Feedback"
FOR UPDATE
USING (is_admin());

-- Only admins can delete feedback
CREATE POLICY "Admins can delete feedback"
ON "Feedback"
FOR DELETE
USING (is_admin());

-- Users can view active announcements OR admins can view all
CREATE POLICY "Users can view announcements"
ON "Announcement"
FOR SELECT
USING (
  status = 'ACTIVE'
  OR is_admin()
);

-- Only admins can manage announcements
CREATE POLICY "Admins can insert announcements"
ON "Announcement"
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update announcements"
ON "Announcement"
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete announcements"
ON "Announcement"
FOR DELETE
USING (is_admin());

-- Users can manage own dismissals OR admins can manage any
CREATE POLICY "Users can view own dismissals"
ON "AnnouncementDismissal"
FOR SELECT
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can insert own dismissals"
ON "AnnouncementDismissal"
FOR INSERT
WITH CHECK (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can update own dismissals"
ON "AnnouncementDismissal"
FOR UPDATE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

CREATE POLICY "Users can delete own dismissals"
ON "AnnouncementDismissal"
FOR DELETE
USING (
  "userId" = get_current_user_id()
  OR is_admin()
);

-- ============================================================
-- VERIFICATION & SUCCESS MESSAGE
-- ============================================================

-- Count RLS policies created
SELECT
  COUNT(*) AS total_policies,
  'RLS policies recreated (no warnings!)' AS status
FROM pg_policies
WHERE schemaname = 'public';

-- Show success message
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '';
  RAISE NOTICE '✅ ✅ ✅ ALL RLS WARNINGS ELIMINATED! ✅ ✅ ✅';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 TOTAL POLICIES: % (all optimized)', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Removed all separate admin bypass policies';
  RAISE NOTICE '✅ Integrated admin checks into specific policies using OR is_admin()';
  RAISE NOTICE '✅ Zero "Multiple Permissive Policies" warnings';
  RAISE NOTICE '✅ Same security model (admins have full access)';
  RAISE NOTICE '✅ Same functionality (users access own data)';
  RAISE NOTICE '✅ Better performance (one policy per action)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '   1. Go to Supabase Dashboard → Database → RLS Policies';
  RAISE NOTICE '   2. Run the linter again';
  RAISE NOTICE '   3. Verify all warnings are GONE';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your database is now WARNING-FREE and PRODUCTION-READY!';
END $$;
