-- Add deletedAt column to SessionMessage table
ALTER TABLE "SessionMessage" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Add deletedAt column to Message table
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "SessionMessage_deletedAt_idx" ON "SessionMessage"("deletedAt");
CREATE INDEX IF NOT EXISTS "Message_deletedAt_idx" ON "Message"("deletedAt");

-- ============================================
-- RLS (Row Level Security) Policies - FULLY OPTIMIZED
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE "SessionMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing UPDATE policies to avoid conflicts
DROP POLICY IF EXISTS "Users can soft delete their own session messages" ON "SessionMessage";
DROP POLICY IF EXISTS "Session hosts can soft delete any message" ON "SessionMessage";
DROP POLICY IF EXISTS "SessionMessage update policy" ON "SessionMessage";
DROP POLICY IF EXISTS "authenticated_sessionmessage_access" ON "SessionMessage";

DROP POLICY IF EXISTS "Users can soft delete their own messages" ON "Message";
DROP POLICY IF EXISTS "Group admins can soft delete group messages" ON "Message";
DROP POLICY IF EXISTS "Message update policy" ON "Message";
DROP POLICY IF EXISTS "authenticated_message_access" ON "Message";

-- ============================================
-- Helper function to cache auth.uid() - COMPLETELY eliminates re-evaluation
-- Created in public schema (we don't have permission for auth schema)
-- SECURITY DEFINER ensures it runs with elevated privileges to access auth.uid()
-- STABLE tells Postgres the result won't change within a single query
-- ============================================
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()::text;
$$;

-- ============================================
-- OPTIMIZED: SessionMessage - Single UPDATE policy
-- Uses helper function to cache auth.uid() ONCE per query
-- ============================================
CREATE POLICY "SessionMessage update policy"
ON "SessionMessage"
FOR UPDATE
TO authenticated
USING (
  "senderId" = public.get_current_user_id()
  OR
  EXISTS (
    SELECT 1 FROM "SessionParticipant"
    WHERE "SessionParticipant"."sessionId" = "SessionMessage"."sessionId"
    AND "SessionParticipant"."userId" = public.get_current_user_id()
    AND "SessionParticipant"."role" = 'HOST'
  )
);

-- ============================================
-- OPTIMIZED: Message - Single UPDATE policy
-- Uses helper function to cache auth.uid() ONCE per query
-- ============================================
CREATE POLICY "Message update policy"
ON "Message"
FOR UPDATE
TO authenticated
USING (
  "senderId" = public.get_current_user_id()
  OR
  (
    "groupId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "Message"."groupId"
      AND "GroupMember"."userId" = public.get_current_user_id()
      AND "GroupMember"."role" IN ('OWNER', 'ADMIN')
    )
  )
);
