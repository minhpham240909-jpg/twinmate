-- ============================================
-- PRESENCE SYSTEM MIGRATION (OPTIMIZED)
-- ============================================
-- This version fixes Supabase RLS performance warnings by:
-- 1. Using (SELECT auth.uid()) instead of auth.uid() to prevent re-evaluation
-- 2. Combining multiple permissive policies into single policies using OR

-- 1. Create user_presence table (aggregate status)
CREATE TABLE IF NOT EXISTS "user_presence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Create device_sessions table (multiple per user)
CREATE TABLE IF NOT EXISTS "device_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "device_sessions_userId_deviceId_key" UNIQUE ("userId", "deviceId")
);

-- 3. Create message_read_status table (read receipts)
CREATE TABLE IF NOT EXISTS "message_read_status" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_read_status_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_read_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_read_status_messageId_userId_key" UNIQUE ("messageId", "userId")
);

-- 4. Create typing_indicators table (short-lived)
CREATE TABLE IF NOT EXISTS "typing_indicators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "isTyping" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "typing_indicators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "typing_indicators_userId_conversationId_key" UNIQUE ("userId", "conversationId")
);

-- ============================================
-- INDEXES
-- ============================================

-- user_presence indexes
CREATE INDEX IF NOT EXISTS "user_presence_userId_idx" ON "user_presence"("userId");
CREATE INDEX IF NOT EXISTS "user_presence_status_idx" ON "user_presence"("status");

-- device_sessions indexes
CREATE INDEX IF NOT EXISTS "device_sessions_userId_isActive_idx" ON "device_sessions"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "device_sessions_lastHeartbeatAt_idx" ON "device_sessions"("lastHeartbeatAt");

-- message_read_status indexes
CREATE INDEX IF NOT EXISTS "message_read_status_messageId_idx" ON "message_read_status"("messageId");
CREATE INDEX IF NOT EXISTS "message_read_status_userId_idx" ON "message_read_status"("userId");

-- typing_indicators indexes
CREATE INDEX IF NOT EXISTS "typing_indicators_conversationId_expiresAt_idx" ON "typing_indicators"("conversationId", "expiresAt");

-- ============================================
-- RLS POLICIES (OPTIMIZED)
-- ============================================

-- Enable RLS on all presence tables
ALTER TABLE "user_presence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_read_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "typing_indicators" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- OPTIMIZED user_presence RLS
-- ============================================

-- COMBINED SELECT policy: View own presence OR partner presence (fixes multiple permissive policies warning)
CREATE POLICY "Users can view presence"
  ON "user_presence" FOR SELECT
  USING (
    -- User can view their own presence
    "userId" = (SELECT auth.uid())::text
    OR
    -- User can view presence of connected partners
    EXISTS (
      SELECT 1 FROM "Match"
      WHERE (
        ("Match"."senderId" = (SELECT auth.uid())::text AND "Match"."receiverId" = "user_presence"."userId" AND "Match"."status" = 'ACCEPTED')
        OR
        ("Match"."receiverId" = (SELECT auth.uid())::text AND "Match"."senderId" = "user_presence"."userId" AND "Match"."status" = 'ACCEPTED')
      )
    )
  );

CREATE POLICY "Users can insert their own presence"
  ON "user_presence" FOR INSERT
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own presence"
  ON "user_presence" FOR UPDATE
  USING ("userId" = (SELECT auth.uid())::text);

-- ============================================
-- OPTIMIZED device_sessions RLS
-- ============================================

CREATE POLICY "Users can view their own device sessions"
  ON "device_sessions" FOR SELECT
  USING ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can insert their own device sessions"
  ON "device_sessions" FOR INSERT
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own device sessions"
  ON "device_sessions" FOR UPDATE
  USING ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can delete their own device sessions"
  ON "device_sessions" FOR DELETE
  USING ("userId" = (SELECT auth.uid())::text);

-- ============================================
-- OPTIMIZED message_read_status RLS
-- ============================================

CREATE POLICY "Users can view read status for their messages"
  ON "message_read_status" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Message"
      WHERE "Message"."id" = "message_read_status"."messageId"
        AND (
          "Message"."senderId" = (SELECT auth.uid())::text 
          OR 
          "Message"."recipientId" = (SELECT auth.uid())::text
        )
    )
  );

CREATE POLICY "Users can insert read status for messages they received"
  ON "message_read_status" FOR INSERT
  WITH CHECK (
    "userId" = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM "Message"
      WHERE "Message"."id" = "message_read_status"."messageId"
        AND "Message"."recipientId" = (SELECT auth.uid())::text
    )
  );

-- ============================================
-- OPTIMIZED typing_indicators RLS
-- ============================================

CREATE POLICY "Users can view typing indicators for their conversations"
  ON "typing_indicators" FOR SELECT
  USING (
    -- For DM conversations (conversationId is userId)
    "conversationId" = (SELECT auth.uid())::text
    OR "userId" = (SELECT auth.uid())::text
    OR EXISTS (
      -- For group conversations (conversationId is groupId)
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "typing_indicators"."conversationId"
        AND "GroupMember"."userId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "Users can insert their own typing indicators"
  ON "typing_indicators" FOR INSERT
  WITH CHECK ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own typing indicators"
  ON "typing_indicators" FOR UPDATE
  USING ("userId" = (SELECT auth.uid())::text);

CREATE POLICY "Users can delete their own typing indicators"
  ON "typing_indicators" FOR DELETE
  USING ("userId" = (SELECT auth.uid())::text);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Performance optimizations applied:
-- ✅ All auth.uid() calls wrapped in (SELECT auth.uid())
-- ✅ Multiple permissive policies combined into single policies with OR
-- ✅ Indexes maintained for optimal query performance
