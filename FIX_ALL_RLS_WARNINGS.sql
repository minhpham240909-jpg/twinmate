-- =====================================================
-- COMPLETE RLS FIX FOR ALL TABLES
-- =====================================================
-- This will enable RLS and create policies for all tables
-- that are currently showing RLS warnings
-- =====================================================

-- =====================================================
-- 1. GROUP TABLE
-- =====================================================

ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public groups" ON "Group";
DROP POLICY IF EXISTS "Users can view groups they're members of" ON "Group";
DROP POLICY IF EXISTS "Group owners can manage their groups" ON "Group";
DROP POLICY IF EXISTS "Users can create groups" ON "Group";
DROP POLICY IF EXISTS "Group owners can update their groups" ON "Group";
DROP POLICY IF EXISTS "Group owners can delete their groups" ON "Group";

-- View: Public groups or groups user is a member of
CREATE POLICY "Users can view public groups"
ON "Group"
FOR SELECT
USING (
  privacy = 'PUBLIC'
  OR
  (select auth.uid())::text = "ownerId"
  OR
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "GroupMember"
    WHERE "groupId" = "Group"."id"
  )
);

-- Insert: Users can create groups
CREATE POLICY "Users can create groups"
ON "Group"
FOR INSERT
WITH CHECK (
  (select auth.uid())::text = "ownerId"
);

-- Update: Only owners can update
CREATE POLICY "Group owners can update their groups"
ON "Group"
FOR UPDATE
USING (
  (select auth.uid())::text = "ownerId"
)
WITH CHECK (
  (select auth.uid())::text = "ownerId"
);

-- Delete: Only owners can delete
CREATE POLICY "Group owners can delete their groups"
ON "Group"
FOR DELETE
USING (
  (select auth.uid())::text = "ownerId"
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "Group" TO authenticated;

-- =====================================================
-- 2. GROUP MEMBER TABLE
-- =====================================================

ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group members" ON "GroupMember";
DROP POLICY IF EXISTS "Group owners and admins can manage members" ON "GroupMember";
DROP POLICY IF EXISTS "Users can leave groups" ON "GroupMember";

-- View: Members can see other members in their groups
CREATE POLICY "Users can view group members"
ON "GroupMember"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
  OR
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "GroupMember" AS gm
    WHERE gm."groupId" = "GroupMember"."groupId"
  )
  OR
  (select auth.uid())::text IN (
    SELECT "ownerId"
    FROM "Group"
    WHERE "id" = "GroupMember"."groupId"
  )
);

-- Insert/Update/Delete: Owners and admins can manage
CREATE POLICY "Group owners and admins can manage members"
ON "GroupMember"
FOR ALL
USING (
  (select auth.uid())::text IN (
    SELECT "ownerId"
    FROM "Group"
    WHERE "id" = "GroupMember"."groupId"
  )
  OR
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "GroupMember"
    WHERE "groupId" = "GroupMember"."groupId"
    AND role IN ('OWNER', 'ADMIN')
  )
)
WITH CHECK (
  (select auth.uid())::text IN (
    SELECT "ownerId"
    FROM "Group"
    WHERE "id" = "GroupMember"."groupId"
  )
  OR
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "GroupMember"
    WHERE "groupId" = "GroupMember"."groupId"
    AND role IN ('OWNER', 'ADMIN')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "GroupMember" TO authenticated;

-- =====================================================
-- 3. BADGE TABLE
-- =====================================================

ALTER TABLE "Badge" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view badges" ON "Badge";

-- Badges are read-only for all authenticated users
CREATE POLICY "Everyone can view badges"
ON "Badge"
FOR SELECT
USING (true); -- All authenticated users can view badges

-- Only service role can insert/update/delete badges (via backend)
GRANT SELECT ON "Badge" TO authenticated;

-- =====================================================
-- 4. USER BADGE TABLE
-- =====================================================

ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own badges" ON "UserBadge";
DROP POLICY IF EXISTS "Users can view others' badges" ON "UserBadge";
DROP POLICY IF EXISTS "Users can view all user badges" ON "UserBadge";

-- Users can view their own badges and others' badges
CREATE POLICY "Users can view all user badges"
ON "UserBadge"
FOR SELECT
USING (true); -- All authenticated users can see who has which badges

-- Only service role can insert badges (earned through backend)
GRANT SELECT ON "UserBadge" TO authenticated;

-- =====================================================
-- 5. SESSION TABLE (NextAuth sessions)
-- =====================================================

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON "Session";
DROP POLICY IF EXISTS "Users can manage their own sessions" ON "Session";

-- Users can only see and manage their own sessions
CREATE POLICY "Users can view their own sessions"
ON "Session"
FOR SELECT
USING (
  (select auth.uid())::text = "userId"
);

CREATE POLICY "Users can manage their own sessions"
ON "Session"
FOR ALL
USING (
  (select auth.uid())::text = "userId"
)
WITH CHECK (
  (select auth.uid())::text = "userId"
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "Session" TO authenticated;

-- =====================================================
-- 6. CONVERSATION ARCHIVE TABLE
-- =====================================================

ALTER TABLE "ConversationArchive" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own archives" ON "ConversationArchive";

-- Users can only see and manage their own conversation archives
CREATE POLICY "Users can manage their own archives"
ON "ConversationArchive"
FOR ALL
USING (
  (select auth.uid())::text = "userId"
)
WITH CHECK (
  (select auth.uid())::text = "userId"
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "ConversationArchive" TO authenticated;

-- =====================================================
-- 7. SESSION GOAL TABLE
-- =====================================================

ALTER TABLE "SessionGoal" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view goals in their sessions" ON "SessionGoal";
DROP POLICY IF EXISTS "Session participants can manage goals" ON "SessionGoal";

-- View: Users can see goals in sessions they're part of
CREATE POLICY "Users can view goals in their sessions"
ON "SessionGoal"
FOR SELECT
USING (
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "SessionParticipant"
    WHERE "sessionId" = "SessionGoal"."sessionId"
  )
  OR
  (select auth.uid())::text IN (
    SELECT "createdBy"
    FROM "StudySession"
    WHERE "id" = "SessionGoal"."sessionId"
  )
);

-- Insert/Update/Delete: All session participants can manage goals
CREATE POLICY "Session participants can manage goals"
ON "SessionGoal"
FOR ALL
USING (
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "SessionParticipant"
    WHERE "sessionId" = "SessionGoal"."sessionId"
  )
  OR
  (select auth.uid())::text IN (
    SELECT "createdBy"
    FROM "StudySession"
    WHERE "id" = "SessionGoal"."sessionId"
  )
)
WITH CHECK (
  (select auth.uid())::text IN (
    SELECT "userId"
    FROM "SessionParticipant"
    WHERE "sessionId" = "SessionGoal"."sessionId"
  )
  OR
  (select auth.uid())::text IN (
    SELECT "createdBy"
    FROM "StudySession"
    WHERE "id" = "SessionGoal"."sessionId"
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionGoal" TO authenticated;

-- =====================================================
-- PERFORMANCE INDEXES FOR RLS
-- =====================================================

-- Add indexes to improve RLS query performance
CREATE INDEX IF NOT EXISTS "Group_ownerId_idx" ON "Group"("ownerId");
CREATE INDEX IF NOT EXISTS "Group_privacy_idx" ON "Group"("privacy");
CREATE INDEX IF NOT EXISTS "GroupMember_groupId_userId_idx" ON "GroupMember"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "ConversationArchive_userId_idx" ON "ConversationArchive"("userId");
CREATE INDEX IF NOT EXISTS "SessionGoal_sessionId_idx" ON "SessionGoal"("sessionId");

-- =====================================================
-- ALL RLS POLICIES COMPLETE!
-- =====================================================
-- All tables now have proper row-level security
-- No more RLS warnings!
-- =====================================================
