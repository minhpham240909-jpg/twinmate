-- ====================================================================================
-- CREATE COLLABORATION TABLES FOR CLERVA 2.0
-- ====================================================================================
-- This SQL creates the 4 collaboration feature tables:
-- - SessionWhiteboard
-- - SessionWhiteboardVersion
-- - SessionNote
-- - SessionFlashcard
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Create a new query
-- 3. Copy and paste this ENTIRE file
-- 4. Click "Run" to execute
-- 5. After this completes, run add_collaboration_rls.sql for security policies
-- ====================================================================================

-- Create SessionWhiteboard table
CREATE TABLE IF NOT EXISTS "SessionWhiteboard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
    "description" TEXT,
    "snapshotUrl" TEXT,
    "thumbnailUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEditedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionWhiteboard_pkey" PRIMARY KEY ("id")
);

-- Create SessionWhiteboardVersion table
CREATE TABLE IF NOT EXISTS "SessionWhiteboardVersion" (
    "id" TEXT NOT NULL,
    "whiteboardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotUrl" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionWhiteboardVersion_pkey" PRIMARY KEY ("id")
);

-- Create SessionNote table
CREATE TABLE IF NOT EXISTS "SessionNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Note',
    "content" TEXT,
    "contentUrl" TEXT,
    "lastEditedBy" TEXT,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- Create SessionFlashcard table
CREATE TABLE IF NOT EXISTS "SessionFlashcard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 0,
    "lastReviewed" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" TIMESTAMP(3),
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionFlashcard_pkey" PRIMARY KEY ("id")
);

-- ====================================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ====================================================================================

-- SessionWhiteboard indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SessionWhiteboard_sessionId_key" ON "SessionWhiteboard"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionWhiteboard_sessionId_idx" ON "SessionWhiteboard"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionWhiteboard_lastSyncedAt_idx" ON "SessionWhiteboard"("lastSyncedAt");

-- SessionWhiteboardVersion indexes
CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_whiteboardId_idx" ON "SessionWhiteboardVersion"("whiteboardId");
CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_whiteboardId_version_idx" ON "SessionWhiteboardVersion"("whiteboardId", "version");
CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_createdAt_idx" ON "SessionWhiteboardVersion"("createdAt");

-- SessionNote indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SessionNote_sessionId_key" ON "SessionNote"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionNote_sessionId_idx" ON "SessionNote"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionNote_lastEditedAt_idx" ON "SessionNote"("lastEditedAt");

-- SessionFlashcard indexes
CREATE INDEX IF NOT EXISTS "SessionFlashcard_sessionId_userId_idx" ON "SessionFlashcard"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "SessionFlashcard_userId_nextReviewDate_idx" ON "SessionFlashcard"("userId", "nextReviewDate");
CREATE INDEX IF NOT EXISTS "SessionFlashcard_createdAt_idx" ON "SessionFlashcard"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SessionFlashcard_sessionId_userId_id_key" ON "SessionFlashcard"("sessionId", "userId", "id");

-- ====================================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ====================================================================================

-- SessionWhiteboard → StudySession
ALTER TABLE "SessionWhiteboard"
DROP CONSTRAINT IF EXISTS "SessionWhiteboard_sessionId_fkey";

ALTER TABLE "SessionWhiteboard"
ADD CONSTRAINT "SessionWhiteboard_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SessionWhiteboardVersion → SessionWhiteboard
ALTER TABLE "SessionWhiteboardVersion"
DROP CONSTRAINT IF EXISTS "SessionWhiteboardVersion_whiteboardId_fkey";

ALTER TABLE "SessionWhiteboardVersion"
ADD CONSTRAINT "SessionWhiteboardVersion_whiteboardId_fkey"
FOREIGN KEY ("whiteboardId") REFERENCES "SessionWhiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SessionNote → StudySession
ALTER TABLE "SessionNote"
DROP CONSTRAINT IF EXISTS "SessionNote_sessionId_fkey";

ALTER TABLE "SessionNote"
ADD CONSTRAINT "SessionNote_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SessionFlashcard → StudySession
ALTER TABLE "SessionFlashcard"
DROP CONSTRAINT IF EXISTS "SessionFlashcard_sessionId_fkey";

ALTER TABLE "SessionFlashcard"
ADD CONSTRAINT "SessionFlashcard_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SessionFlashcard → User
ALTER TABLE "SessionFlashcard"
DROP CONSTRAINT IF EXISTS "SessionFlashcard_userId_fkey";

ALTER TABLE "SessionFlashcard"
ADD CONSTRAINT "SessionFlashcard_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ====================================================================================
-- DONE!
-- ====================================================================================
-- ✅ Tables created successfully!
--
-- NEXT STEP: Run add_collaboration_rls.sql to add Row Level Security policies
-- ====================================================================================
