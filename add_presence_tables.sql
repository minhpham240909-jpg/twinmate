-- ============================================
-- PRESENCE SYSTEM MIGRATION
-- ============================================

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
-- RLS POLICIES
-- ============================================

-- Enable RLS on all presence tables
ALTER TABLE "user_presence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_read_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "typing_indicators" ENABLE ROW LEVEL SECURITY;

-- user_presence RLS: Users can only view/update their own presence
CREATE POLICY "Users can view their own presence"
  ON "user_presence" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert their own presence"
  ON "user_presence" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update their own presence"
  ON "user_presence" FOR UPDATE
  USING ("userId" = auth.uid()::text);

-- Users can view presence of their connected partners
CREATE POLICY "Users can view partner presence"
  ON "user_presence" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Match"
      WHERE ("Match"."senderId" = auth.uid()::text AND "Match"."receiverId" = "user_presence"."userId" AND "Match"."status" = 'ACCEPTED')
         OR ("Match"."receiverId" = auth.uid()::text AND "Match"."senderId" = "user_presence"."userId" AND "Match"."status" = 'ACCEPTED')
    )
  );

-- device_sessions RLS: Users can only manage their own device sessions
CREATE POLICY "Users can view their own device sessions"
  ON "device_sessions" FOR SELECT
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert their own device sessions"
  ON "device_sessions" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update their own device sessions"
  ON "device_sessions" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete their own device sessions"
  ON "device_sessions" FOR DELETE
  USING ("userId" = auth.uid()::text);

-- message_read_status RLS: Users can view read status for messages they sent or received
CREATE POLICY "Users can view read status for their messages"
  ON "message_read_status" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Message"
      WHERE "Message"."id" = "message_read_status"."messageId"
        AND ("Message"."senderId" = auth.uid()::text OR "Message"."recipientId" = auth.uid()::text)
    )
  );

CREATE POLICY "Users can insert read status for messages they received"
  ON "message_read_status" FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Message"
      WHERE "Message"."id" = "message_read_status"."messageId"
        AND "Message"."recipientId" = auth.uid()::text
    )
  );

-- typing_indicators RLS: Users can view/insert typing indicators for conversations they're part of
CREATE POLICY "Users can view typing indicators for their conversations"
  ON "typing_indicators" FOR SELECT
  USING (
    -- For DM conversations (conversationId is userId)
    "conversationId" = auth.uid()::text
    OR "userId" = auth.uid()::text
    OR EXISTS (
      -- For group conversations (conversationId is groupId)
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "typing_indicators"."conversationId"
        AND "GroupMember"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert their own typing indicators"
  ON "typing_indicators" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update their own typing indicators"
  ON "typing_indicators" FOR UPDATE
  USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete their own typing indicators"
  ON "typing_indicators" FOR DELETE
  USING ("userId" = auth.uid()::text);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
