-- ============================================================================
-- Supabase Realtime RLS Security Migration
-- 
-- This migration ensures Row Level Security (RLS) is properly configured
-- for tables that use Supabase Realtime subscriptions.
-- 
-- IMPORTANT: Supabase Realtime respects RLS policies automatically.
-- These policies ensure users can only subscribe to their own data.
-- ============================================================================

-- ============================================================================
-- 1. NOTIFICATION TABLE RLS
-- ============================================================================

-- Enable RLS on Notification table
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can only access own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only insert own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only update own notifications" ON "Notification";
DROP POLICY IF EXISTS "Users can only delete own notifications" ON "Notification";

-- Policy: Users can only SELECT their own notifications
-- This is critical for Realtime subscriptions
CREATE POLICY "Users can only access own notifications"
ON "Notification"
FOR SELECT
USING (auth.uid()::text = "userId");

-- Policy: System can insert notifications for any user (for triggers/functions)
-- Users cannot insert notifications for others
CREATE POLICY "Users can only insert own notifications"
ON "Notification"
FOR INSERT
WITH CHECK (auth.uid()::text = "userId");

-- Policy: Users can only update their own notifications (mark as read)
CREATE POLICY "Users can only update own notifications"
ON "Notification"
FOR UPDATE
USING (auth.uid()::text = "userId");

-- Policy: Users can only delete their own notifications
CREATE POLICY "Users can only delete own notifications"
ON "Notification"
FOR DELETE
USING (auth.uid()::text = "userId");

-- ============================================================================
-- 2. MESSAGE TABLE RLS (for Realtime chat)
-- ============================================================================

-- Enable RLS on Message table
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access messages in their conversations" ON "Message";
DROP POLICY IF EXISTS "Users can send messages" ON "Message";
DROP POLICY IF EXISTS "Users can update own messages" ON "Message";
DROP POLICY IF EXISTS "Users can delete own messages" ON "Message";

-- Policy: Users can only see messages they sent, received (DM), or in their groups
CREATE POLICY "Users can access messages in their conversations"
ON "Message"
FOR SELECT
USING (
  -- User is the sender
  auth.uid()::text = "senderId" 
  -- User is the recipient (for DMs)
  OR auth.uid()::text = "recipientId"
  -- User is a member of the group (for group messages)
  OR EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."groupId" = "Message"."groupId"
    AND gm."userId" = auth.uid()::text
  )
);

-- Policy: Users can only send messages as themselves
CREATE POLICY "Users can send messages"
ON "Message"
FOR INSERT
WITH CHECK (auth.uid()::text = "senderId");

-- Policy: Users can only update their own messages (e.g., soft delete)
CREATE POLICY "Users can update own messages"
ON "Message"
FOR UPDATE
USING (auth.uid()::text = "senderId");

-- Policy: Users can only delete their own messages
CREATE POLICY "Users can delete own messages"
ON "Message"
FOR DELETE
USING (auth.uid()::text = "senderId");

-- ============================================================================
-- 3. GROUP MEMBER TABLE RLS (for group membership checks)
-- Note: Group messages are part of the Message table with groupId field
-- ============================================================================

-- Enable RLS on GroupMember table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'GroupMember') THEN
    ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies for GroupMember if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'GroupMember') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view their group memberships" ON "GroupMember";
    DROP POLICY IF EXISTS "Group members can view other members" ON "GroupMember";
    
    -- Policy: Users can see their own memberships
    EXECUTE 'CREATE POLICY "Users can view their group memberships"
    ON "GroupMember"
    FOR SELECT
    USING (auth.uid()::text = "userId")';
    
    -- Policy: Group members can see other members in their groups
    EXECUTE 'CREATE POLICY "Group members can view other members"
    ON "GroupMember"
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM "GroupMember" gm
        WHERE gm."groupId" = "GroupMember"."groupId"
        AND gm."userId" = auth.uid()::text
      )
    )';
  END IF;
END $$;

-- ============================================================================
-- 4. PRESENCE TABLE RLS (for online status Realtime)
-- Note: UserPresence model is mapped to "user_presence" table in DB
-- ============================================================================

-- Enable RLS on user_presence table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_presence') THEN
    ALTER TABLE "user_presence" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies for UserPresence if table exists (table name is user_presence in DB)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_presence') THEN
    DROP POLICY IF EXISTS "Users can view presence of connected users" ON "user_presence";
    DROP POLICY IF EXISTS "Users can update own presence" ON "user_presence";
    
    -- Policy: Users can see presence of their connections (for privacy)
    EXECUTE 'CREATE POLICY "Users can view presence of connected users"
    ON "user_presence"
    FOR SELECT
    USING (
      -- User can always see their own presence
      auth.uid()::text = "userId"
      OR
      -- Users can see presence of their study partners (accepted matches)
      EXISTS (
        SELECT 1 FROM "Match" m
        WHERE m."status" = ''ACCEPTED''
        AND (
          (m."senderId" = auth.uid()::text AND m."receiverId" = "user_presence"."userId")
          OR (m."receiverId" = auth.uid()::text AND m."senderId" = "user_presence"."userId")
        )
      )
    )';
    
    -- Policy: Users can only update their own presence
    EXECUTE 'CREATE POLICY "Users can update own presence"
    ON "user_presence"
    FOR ALL
    USING (auth.uid()::text = "userId")
    WITH CHECK (auth.uid()::text = "userId")';
  END IF;
END $$;

-- ============================================================================
-- 5. STUDY SESSION TABLE RLS (for session Realtime updates)
-- ============================================================================

-- Enable RLS on StudySession table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'StudySession') THEN
    ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies for StudySession if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'StudySession') THEN
    DROP POLICY IF EXISTS "Session participants can view sessions" ON "StudySession";
    DROP POLICY IF EXISTS "Users can create sessions" ON "StudySession";
    DROP POLICY IF EXISTS "Session hosts can update sessions" ON "StudySession";
    
    -- Policy: Creator or participants can view session details
    EXECUTE 'CREATE POLICY "Session participants can view sessions"
    ON "StudySession"
    FOR SELECT
    USING (
      -- User is the creator
      auth.uid()::text = "createdBy"
      -- Or user is the session owner (legacy field)
      OR auth.uid()::text = "userId"
      -- Or user is a participant
      OR EXISTS (
        SELECT 1 FROM "SessionParticipant" sp
        WHERE sp."sessionId" = "StudySession"."id"
        AND sp."userId" = auth.uid()::text
      )
    )';
    
    -- Policy: Authenticated users can create sessions
    EXECUTE 'CREATE POLICY "Users can create sessions"
    ON "StudySession"
    FOR INSERT
    WITH CHECK (auth.uid()::text = "createdBy")';
    
    -- Policy: Creator or session owner can update session
    EXECUTE 'CREATE POLICY "Session hosts can update sessions"
    ON "StudySession"
    FOR UPDATE
    USING (
      auth.uid()::text = "createdBy"
      OR auth.uid()::text = "userId"
    )';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify policies are applied)
-- ============================================================================

-- To verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename IN ('Notification', 'Message', 'GroupMember', 'user_presence', 'StudySession');

-- To list all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('Notification', 'Message', 'GroupMember', 'user_presence', 'StudySession');

-- ============================================================================
-- NOTE: After running this migration, test Realtime subscriptions to ensure
-- users can only receive updates for their own data.
-- 
-- SCHEMA REFERENCE:
-- - Message: uses "senderId", "recipientId" (for DMs), "groupId" (for groups)
-- - Match: uses "senderId", "receiverId", "status" (for connections)
-- - user_presence: mapped from UserPresence model, uses "userId"
-- - StudySession: uses "createdBy", "userId" (legacy)
-- - SessionParticipant: uses "sessionId", "userId"
-- ============================================================================

