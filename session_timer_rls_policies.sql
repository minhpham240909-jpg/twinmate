-- Add RLS to existing SessionTimer table (Type-safe version)
-- Created: 2025-10-08
-- Fixed: Added type casting for UUID/TEXT compatibility

-- Enable RLS on SessionTimer table
ALTER TABLE "SessionTimer" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid "already exists" errors)
DROP POLICY IF EXISTS "Users can view timer for their sessions" ON "SessionTimer";
DROP POLICY IF EXISTS "Hosts can create timer for their sessions" ON "SessionTimer";
DROP POLICY IF EXISTS "Participants can update timer for their sessions" ON "SessionTimer";
DROP POLICY IF EXISTS "Hosts can delete timer for their sessions" ON "SessionTimer";

-- Policy 1: Users can view timers for sessions they are participating in
CREATE POLICY "Users can view timer for their sessions"
  ON "SessionTimer"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionTimer"."sessionId"
        AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

-- Policy 2: Session hosts can create timers for their sessions
CREATE POLICY "Hosts can create timer for their sessions"
  ON "SessionTimer"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionTimer"."sessionId"
        AND "StudySession"."createdBy" = auth.uid()::text
    )
  );

-- Policy 3: Session participants can update timers (for controls)
CREATE POLICY "Participants can update timer for their sessions"
  ON "SessionTimer"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionTimer"."sessionId"
        AND "SessionParticipant"."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SessionParticipant"
      WHERE "SessionParticipant"."sessionId" = "SessionTimer"."sessionId"
        AND "SessionParticipant"."userId" = auth.uid()::text
    )
  );

-- Policy 4: Session hosts can delete timers
CREATE POLICY "Hosts can delete timer for their sessions"
  ON "SessionTimer"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "StudySession"
      WHERE "StudySession"."id" = "SessionTimer"."sessionId"
        AND "StudySession"."createdBy" = auth.uid()::text
    )
  );

-- Add SessionTimer to realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "SessionTimer";
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore error
END
$$;
