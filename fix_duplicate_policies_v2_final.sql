-- ==========================================
-- FIX MULTIPLE PERMISSIVE POLICIES (Version 2 - FINAL)
-- This completely eliminates duplicate policies for 100% clean linter
-- Run this AFTER fix_rls_performance_v3_final.sql
-- ==========================================

-- IMPORTANT: This script is SAFE and NON-BREAKING
-- Strategy: Combine overlapping policies into single policies with OR logic
-- Security rules remain EXACTLY the same
-- Performance improves - only ONE policy check per query instead of TWO

BEGIN;

-- ==========================================
-- FIX 1: Session table - Remove redundant SELECT policy
-- ==========================================
-- Problem: "Users can manage their own sessions" (FOR ALL) already handles SELECT
-- Solution: Just remove the duplicate SELECT-only policy

DROP POLICY IF EXISTS "Users can view their own sessions" ON "Session";

-- Keep only: "Users can manage their own sessions" (FOR ALL)
-- Already created in v3_final.sql - no changes needed

-- ==========================================
-- FIX 2: SessionGoal table - Remove redundant SELECT policy
-- ==========================================
-- Problem: "Session participants can manage goals" (FOR ALL) already handles SELECT
-- Solution: Just remove the duplicate SELECT-only policy

DROP POLICY IF EXISTS "Users can view goals in their sessions" ON "SessionGoal";

-- Keep only: "Session participants can manage goals" (FOR ALL)
-- Already created in v3_final.sql - no changes needed

-- ==========================================
-- FIX 3: SessionParticipant table - Consolidate into ONE policy per action
-- ==========================================
-- Problem: Two SELECT policies exist (creators + participants)
-- Solution: Combine into single SELECT policy with OR logic, separate INSERT/UPDATE/DELETE

DROP POLICY IF EXISTS "Users can view participants in their sessions" ON "SessionParticipant";
DROP POLICY IF EXISTS "Session creators can manage participants" ON "SessionParticipant";
DROP POLICY IF EXISTS "Participants can view session members" ON "SessionParticipant";

-- Single SELECT policy: Covers both creators AND participants
CREATE POLICY "Users can view session participants"
ON "SessionParticipant"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND (
      -- Condition 1: User is the session creator
      "StudySession"."createdBy" = (SELECT auth.uid())::text
      OR
      -- Condition 2: User is a joined participant in this session
      EXISTS (
        SELECT 1 FROM "SessionParticipant" sp
        WHERE sp."sessionId" = "StudySession"."id"
        AND sp."userId" = (SELECT auth.uid())::text
        AND sp."status" = 'JOINED'
      )
    )
  )
);

-- Separate INSERT/UPDATE/DELETE policy: Only creators
CREATE POLICY "Session creators can modify participants"
ON "SessionParticipant"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND "StudySession"."createdBy" = (SELECT auth.uid())::text
  )
);

CREATE POLICY "Session creators can update participants"
ON "SessionParticipant"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND "StudySession"."createdBy" = (SELECT auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND "StudySession"."createdBy" = (SELECT auth.uid())::text
  )
);

CREATE POLICY "Session creators can delete participants"
ON "SessionParticipant"
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "StudySession"
    WHERE "StudySession"."id" = "SessionParticipant"."sessionId"
    AND "StudySession"."createdBy" = (SELECT auth.uid())::text
  )
);

-- ==========================================
-- FIX 4: GroupMember table - Consolidate into ONE policy per action
-- ==========================================
-- Problem: Two SELECT policies exist (admins + members)
-- Solution: Combine into single SELECT policy with OR logic, separate INSERT/UPDATE/DELETE

DROP POLICY IF EXISTS "Users can view group members" ON "GroupMember";
DROP POLICY IF EXISTS "Group owners and admins can manage members" ON "GroupMember";
DROP POLICY IF EXISTS "Group members can view members" ON "GroupMember";

-- Single SELECT policy: Covers admins, members, AND public viewers
CREATE POLICY "Users can view group members"
ON "GroupMember"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      -- Condition 1: Group is public (anyone can view)
      "Group"."privacy" = 'PUBLIC'
      OR
      -- Condition 2: User is the group owner
      "Group"."ownerId" = (SELECT auth.uid())::text
      OR
      -- Condition 3: User is a member of this group (any role)
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
      )
    )
  )
);

-- Separate INSERT/UPDATE/DELETE policy: Only owners and admins
CREATE POLICY "Group admins can add members"
ON "GroupMember"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      "Group"."ownerId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
        AND gm."role" IN ('OWNER', 'ADMIN')
      )
    )
  )
);

CREATE POLICY "Group admins can update members"
ON "GroupMember"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      "Group"."ownerId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
        AND gm."role" IN ('OWNER', 'ADMIN')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      "Group"."ownerId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
        AND gm."role" IN ('OWNER', 'ADMIN')
      )
    )
  )
);

CREATE POLICY "Group admins can remove members"
ON "GroupMember"
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND (
      "Group"."ownerId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "Group"."id"
        AND gm."userId" = (SELECT auth.uid())::text
        AND gm."role" IN ('OWNER', 'ADMIN')
      )
    )
  )
);

COMMIT;

-- ==========================================
-- VERIFICATION QUERY
-- Run this to confirm ZERO duplicate policies
-- ==========================================
-- SELECT
--   tablename,
--   policyname,
--   cmd,
--   permissive
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('Session', 'SessionGoal', 'SessionParticipant', 'GroupMember')
-- ORDER BY tablename, cmd, policyname;
--
-- Expected result: Exactly ONE policy per (table, action) combination
-- Example: SessionParticipant should have:
--   - 1 SELECT policy
--   - 1 INSERT policy
--   - 1 UPDATE policy
--   - 1 DELETE policy
-- Total: 4 policies (not 2 overlapping SELECT policies)
