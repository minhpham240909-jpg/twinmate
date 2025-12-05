-- ============================================================================
-- CLEANUP ALL DUPLICATE RLS POLICIES
-- Run this FIRST to remove all duplicate policies, then re-run fix_rls_performance.sql
-- ============================================================================

-- ==========================================
-- BLOCKED USER - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can manage own blocks" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can view own blocked users" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can block other users" ON "BlockedUser";
DROP POLICY IF EXISTS "Users can unblock users" ON "BlockedUser";
DROP POLICY IF EXISTS "BlockedUser_all" ON "BlockedUser";

-- Create single unified policy for BlockedUser
CREATE POLICY "BlockedUser_all" ON "BlockedUser"
  FOR ALL TO authenticated
  USING ("userId" = (SELECT auth.uid())::text)
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- PROFILE - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can view all profiles" ON "Profile";
DROP POLICY IF EXISTS "Users can update their own profile" ON "Profile";
DROP POLICY IF EXISTS "profile_select" ON "Profile";
DROP POLICY IF EXISTS "profile_update" ON "Profile";
DROP POLICY IF EXISTS "Profile_select" ON "Profile";
DROP POLICY IF EXISTS "Profile_update" ON "Profile";

-- Create single policies for Profile
CREATE POLICY "Profile_select" ON "Profile"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Profile_update" ON "Profile"
  FOR UPDATE TO authenticated
  USING ("userId" = (SELECT auth.uid())::text)
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- SESSION FLASHCARD - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can manage own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can view their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can update their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "SessionFlashcard_all" ON "SessionFlashcard";

-- Create single unified policy for SessionFlashcard
CREATE POLICY "SessionFlashcard_all" ON "SessionFlashcard"
  FOR ALL TO authenticated
  USING ("userId" = (SELECT auth.uid())::text)
  WITH CHECK (
    "userId" = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionFlashcard"."sessionId"
      AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
    )
  );

-- ==========================================
-- SESSION NOTE - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Participants can access notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can view notes for their sessions" ON "SessionNote";
DROP POLICY IF EXISTS "Users can update notes for their sessions" ON "SessionNote";
DROP POLICY IF EXISTS "Session hosts can insert notes" ON "SessionNote";
DROP POLICY IF EXISTS "Session hosts can delete notes" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_all" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_select" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_insert" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_update" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_delete" ON "SessionNote";

-- Create single unified policy for SessionNote
CREATE POLICY "SessionNote_select" ON "SessionNote"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
      AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionNote_insert" ON "SessionNote"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionNote"."sessionId"
      AND "StudySession"."createdBy" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionNote_update" ON "SessionNote"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
      AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionNote_delete" ON "SessionNote"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionNote"."sessionId"
      AND "StudySession"."createdBy" = (SELECT auth.uid())::text
    )
  );

-- ==========================================
-- SESSION WHITEBOARD - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Participants can access whiteboards" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Users can view whiteboards for their sessions" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Users can update whiteboards for their sessions" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Session hosts can insert whiteboards" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "Session hosts can delete whiteboards" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "SessionWhiteboard_all" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "SessionWhiteboard_select" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "SessionWhiteboard_insert" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "SessionWhiteboard_update" ON "SessionWhiteboard";
DROP POLICY IF EXISTS "SessionWhiteboard_delete" ON "SessionWhiteboard";

-- Create single policies for SessionWhiteboard
CREATE POLICY "SessionWhiteboard_select" ON "SessionWhiteboard"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
      AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionWhiteboard_insert" ON "SessionWhiteboard"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
      AND "StudySession"."createdBy" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionWhiteboard_update" ON "SessionWhiteboard"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
      AND "SessionParticipant"."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionWhiteboard_delete" ON "SessionWhiteboard"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
      AND "StudySession"."createdBy" = (SELECT auth.uid())::text
    )
  );

-- ==========================================
-- SESSION WHITEBOARD VERSION - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Participants can access whiteboard versions" ON "SessionWhiteboardVersion";
DROP POLICY IF EXISTS "Users can view whiteboard versions for their sessions" ON "SessionWhiteboardVersion";
DROP POLICY IF EXISTS "Users can create whiteboard versions for their sessions" ON "SessionWhiteboardVersion";
DROP POLICY IF EXISTS "SessionWhiteboardVersion_all" ON "SessionWhiteboardVersion";
DROP POLICY IF EXISTS "SessionWhiteboardVersion_select" ON "SessionWhiteboardVersion";
DROP POLICY IF EXISTS "SessionWhiteboardVersion_insert" ON "SessionWhiteboardVersion";

-- Create single policies
CREATE POLICY "SessionWhiteboardVersion_select" ON "SessionWhiteboardVersion"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SessionWhiteboard" wb
      INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
      WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
      AND sp."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "SessionWhiteboardVersion_insert" ON "SessionWhiteboardVersion"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SessionWhiteboard" wb
      INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
      WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
      AND sp."userId" = (SELECT auth.uid())::text
    )
  );

-- ==========================================
-- USER SETTINGS - Drop ALL existing policies
-- ==========================================
DROP POLICY IF EXISTS "Users can view own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can insert own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can update own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can delete own settings" ON "UserSettings";
DROP POLICY IF EXISTS "Users can manage own settings" ON "UserSettings";
DROP POLICY IF EXISTS "UserSettings_all" ON "UserSettings";

-- Create single unified policy
CREATE POLICY "UserSettings_all" ON "UserSettings"
  FOR ALL TO authenticated
  USING ("userId" = (SELECT auth.uid())::text)
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- VALIDATION
-- ==========================================
DO $$
BEGIN
  RAISE NOTICE 'Duplicate policy cleanup completed!';
  RAISE NOTICE 'All tables now have single optimized policies per action.';
END $$;
