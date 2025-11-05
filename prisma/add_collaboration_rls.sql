-- ====================================================================================
-- CLERVA 2.0 - ROW LEVEL SECURITY POLICIES FOR COLLABORATION FEATURES
-- ====================================================================================
-- This file contains RLS policies for:
-- - SessionWhiteboard
-- - SessionWhiteboardVersion
-- - SessionNote
-- - SessionFlashcard
--
-- Run this after: npx prisma migrate dev --name add_collaboration_features
-- ====================================================================================

-- Enable RLS on all collaboration tables
ALTER TABLE "SessionWhiteboard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionWhiteboardVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionFlashcard" ENABLE ROW LEVEL SECURITY;

-- ====================================================================================
-- SESSION WHITEBOARD RLS
-- Users can only access whiteboards for sessions they're participants in
-- ====================================================================================

CREATE POLICY "Users can view whiteboards for their sessions"
  ON "SessionWhiteboard" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
      AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update whiteboards for their sessions"
  ON "SessionWhiteboard" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionWhiteboard"."sessionId"
      AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Session hosts can insert whiteboards"
  ON "SessionWhiteboard" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
      AND "StudySession"."createdBy" = auth.uid()::text
    )
  );

CREATE POLICY "Session hosts can delete whiteboards"
  ON "SessionWhiteboard" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionWhiteboard"."sessionId"
      AND "StudySession"."createdBy" = auth.uid()::text
    )
  );

-- ====================================================================================
-- SESSION WHITEBOARD VERSION RLS
-- Users can access versions for whiteboards they have access to
-- ====================================================================================

CREATE POLICY "Users can view whiteboard versions for their sessions"
  ON "SessionWhiteboardVersion" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "SessionWhiteboard" wb
      INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
      WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
      AND sp."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can create whiteboard versions for their sessions"
  ON "SessionWhiteboardVersion" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SessionWhiteboard" wb
      INNER JOIN "SessionParticipant" sp ON wb."sessionId" = sp."sessionId"
      WHERE wb."id" = "SessionWhiteboardVersion"."whiteboardId"
      AND sp."userId" = auth.uid()::text
    )
  );

-- ====================================================================================
-- SESSION NOTE RLS
-- Similar to whiteboard - users can access notes for sessions they're in
-- ====================================================================================

CREATE POLICY "Users can view notes for their sessions"
  ON "SessionNote" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
      AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update notes for their sessions"
  ON "SessionNote" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionNote"."sessionId"
      AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Session hosts can insert notes"
  ON "SessionNote" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionNote"."sessionId"
      AND "StudySession"."createdBy" = auth.uid()::text
    )
  );

CREATE POLICY "Session hosts can delete notes"
  ON "SessionNote" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionNote"."sessionId"
      AND "StudySession"."createdBy" = auth.uid()::text
    )
  );

-- ====================================================================================
-- SESSION FLASHCARD RLS
-- Per-user flashcards - users can only access their own
-- ====================================================================================

CREATE POLICY "Users can view their own flashcards"
  ON "SessionFlashcard" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert their own flashcards"
  ON "SessionFlashcard" FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionFlashcard"."sessionId"
      AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update their own flashcards"
  ON "SessionFlashcard" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete their own flashcards"
  ON "SessionFlashcard" FOR DELETE
  USING ("userId" = auth.uid()::text);

-- ====================================================================================
-- VERIFICATION QUERIES (Run these to verify RLS is working)
-- ====================================================================================

-- Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Session%';

-- List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('SessionWhiteboard', 'SessionWhiteboardVersion', 'SessionNote', 'SessionFlashcard');
