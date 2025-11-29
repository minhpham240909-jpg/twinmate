-- ============================================================================
-- Fix Remaining RLS Issues
--
-- This migration:
-- 1. Enables RLS on admin/moderation tables (ERROR fixes)
-- 2. Fixes duplicate user_presence SELECT policies (WARN fix)
-- ============================================================================

-- ============================================================================
-- 1. FIX USER_PRESENCE DUPLICATE POLICIES
-- The "Users can manage own presence" (FOR ALL) already covers SELECT
-- So we need to drop "Users can view presence - consolidated" and keep
-- a single consolidated policy
-- ============================================================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can view presence - consolidated" ON "user_presence";
DROP POLICY IF EXISTS "Users can manage own presence" ON "user_presence";

-- Create single consolidated policy for SELECT (viewing others' presence)
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

-- Create separate policies for INSERT/UPDATE/DELETE (own presence only)
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

-- ============================================================================
-- 2. ENABLE RLS ON ADMIN/MODERATION TABLES
-- These tables should only be accessible by admins
-- ============================================================================

-- AdminAuditLog - Admin only
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
ON "AdminAuditLog"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

CREATE POLICY "Only admins can insert audit logs"
ON "AdminAuditLog"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- Announcement - Public read (active status), admin write
-- Note: Uses "status" enum (DRAFT, ACTIVE, ARCHIVED) instead of isActive boolean
-- ============================================================================

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;

-- Anyone can read active announcements
CREATE POLICY "Anyone can view active announcements"
ON "Announcement"
FOR SELECT
USING (
  "status" = 'ACTIVE'
  OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- Only admins can create/update/delete
CREATE POLICY "Only admins can manage announcements"
ON "Announcement"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- AnnouncementDismissal - Users can manage their own dismissals
-- ============================================================================

ALTER TABLE "AnnouncementDismissal" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
ON "AnnouncementDismissal"
FOR SELECT
USING ((select auth.uid())::text = "userId");

CREATE POLICY "Users can dismiss announcements"
ON "AnnouncementDismissal"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "Users can delete own dismissals"
ON "AnnouncementDismissal"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- ============================================================================
-- Report - Users can create, admins can view all
-- ============================================================================

ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports, admins can view all
CREATE POLICY "Users can view own reports or admins view all"
ON "Report"
FOR SELECT
USING (
  (select auth.uid())::text = "reporterId"
  OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- Users can create reports
CREATE POLICY "Users can create reports"
ON "Report"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "reporterId");

-- Only admins can update reports (to change status, add notes)
CREATE POLICY "Only admins can update reports"
ON "Report"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- UserWarning - Admin only
-- ============================================================================

ALTER TABLE "UserWarning" ENABLE ROW LEVEL SECURITY;

-- Users can see their own warnings, admins can see all
CREATE POLICY "Users can view own warnings or admins view all"
ON "UserWarning"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- Only admins can create/update/delete warnings
CREATE POLICY "Only admins can manage warnings"
ON "UserWarning"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- UserBan - Admin only (users should NOT see their own ban details)
-- ============================================================================

ALTER TABLE "UserBan" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view bans"
ON "UserBan"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

CREATE POLICY "Only admins can manage bans"
ON "UserBan"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- flagged_content - Admin only
-- ============================================================================

ALTER TABLE "flagged_content" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view flagged content"
ON "flagged_content"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

CREATE POLICY "System can insert flagged content"
ON "flagged_content"
FOR INSERT
WITH CHECK (true); -- Allow system/triggers to insert

CREATE POLICY "Only admins can update flagged content"
ON "flagged_content"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- Feedback - Users can create, admins can view all
-- ============================================================================

ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback, admins can view all
CREATE POLICY "Users can view own feedback or admins view all"
ON "Feedback"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- Users can create feedback
CREATE POLICY "Users can create feedback"
ON "Feedback"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- Only admins can update feedback (to mark as reviewed, add response)
CREATE POLICY "Only admins can update feedback"
ON "Feedback"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = (select auth.uid())::text
    AND u."isAdmin" = true
  )
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('AdminAuditLog', 'Announcement', 'AnnouncementDismissal', 'Report', 'UserWarning', 'UserBan', 'flagged_content', 'Feedback', 'user_presence');

-- Check policies:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('AdminAuditLog', 'Announcement', 'AnnouncementDismissal', 'Report', 'UserWarning', 'UserBan', 'flagged_content', 'Feedback', 'user_presence')
-- ORDER BY tablename, policyname;
