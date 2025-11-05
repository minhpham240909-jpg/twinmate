-- Create Collaboration Tables for Study Sessions

-- SessionWhiteboard Table
CREATE TABLE IF NOT EXISTS "SessionWhiteboard" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sessionId" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
    "description" TEXT,
    "snapshotUrl" TEXT,
    "thumbnailUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEditedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionWhiteboard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SessionWhiteboard_sessionId_idx" ON "SessionWhiteboard"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionWhiteboard_lastSyncedAt_idx" ON "SessionWhiteboard"("lastSyncedAt");

-- SessionWhiteboardVersion Table
CREATE TABLE IF NOT EXISTS "SessionWhiteboardVersion" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "whiteboardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotUrl" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionWhiteboardVersion_whiteboardId_fkey" FOREIGN KEY ("whiteboardId") REFERENCES "SessionWhiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_whiteboardId_idx" ON "SessionWhiteboardVersion"("whiteboardId");
CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_whiteboardId_version_idx" ON "SessionWhiteboardVersion"("whiteboardId", "version");
CREATE INDEX IF NOT EXISTS "SessionWhiteboardVersion_createdAt_idx" ON "SessionWhiteboardVersion"("createdAt");

-- SessionNote Table
CREATE TABLE IF NOT EXISTS "SessionNote" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sessionId" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL DEFAULT 'Untitled Note',
    "content" TEXT,
    "contentUrl" TEXT,
    "lastEditedBy" TEXT,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SessionNote_sessionId_idx" ON "SessionNote"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionNote_lastEditedAt_idx" ON "SessionNote"("lastEditedAt");

-- SessionFlashcard Table
CREATE TABLE IF NOT EXISTS "SessionFlashcard" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionFlashcard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionFlashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionFlashcard_sessionId_userId_id_key" UNIQUE("sessionId", "userId", "id")
);

CREATE INDEX IF NOT EXISTS "SessionFlashcard_sessionId_userId_idx" ON "SessionFlashcard"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "SessionFlashcard_userId_nextReviewDate_idx" ON "SessionFlashcard"("userId", "nextReviewDate");
CREATE INDEX IF NOT EXISTS "SessionFlashcard_createdAt_idx" ON "SessionFlashcard"("createdAt");
