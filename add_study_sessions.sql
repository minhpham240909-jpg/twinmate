-- Add Study Sessions Module to Clerva 2.0
-- This migration extends the existing StudySession table and adds supporting tables

-- Add new enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionStatus') THEN
        CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionRole') THEN
        CREATE TYPE "SessionRole" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParticipantStatus') THEN
        CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT', 'REMOVED');
    END IF;
END $$;

-- Extend existing StudySession table
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "status" "SessionStatus" DEFAULT 'SCHEDULED';
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER DEFAULT 10;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT false;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "agoraChannel" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT now();

-- Add foreign key if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudySession_createdBy_fkey'
    ) THEN
        ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Add unique constraint on agoraChannel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudySession_agoraChannel_key'
    ) THEN
        ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_agoraChannel_key" UNIQUE ("agoraChannel");
    END IF;
END $$;

-- Create SessionParticipant table
CREATE TABLE IF NOT EXISTS "SessionParticipant" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "SessionRole" DEFAULT 'PARTICIPANT',
  "status" "ParticipantStatus" DEFAULT 'INVITED',
  "joinedAt" TIMESTAMP,
  "leftAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT now(),
  CONSTRAINT "SessionParticipant_sessionId_userId_key" UNIQUE ("sessionId", "userId"),
  CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE,
  CONSTRAINT "SessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create SessionGoal table
CREATE TABLE IF NOT EXISTS "SessionGoal" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isCompleted" BOOLEAN DEFAULT false,
  "completedAt" TIMESTAMP,
  "order" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  CONSTRAINT "SessionGoal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE
);

-- Create SessionMessage table (chat within session)
CREATE TABLE IF NOT EXISTS "SessionMessage" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" "MessageType" DEFAULT 'TEXT',
  "createdAt" TIMESTAMP DEFAULT now(),
  CONSTRAINT "SessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE,
  CONSTRAINT "SessionMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "SessionParticipant_userId_idx" ON "SessionParticipant"("userId");
CREATE INDEX IF NOT EXISTS "SessionParticipant_sessionId_idx" ON "SessionParticipant"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionParticipant_status_idx" ON "SessionParticipant"("status");
CREATE INDEX IF NOT EXISTS "SessionGoal_sessionId_idx" ON "SessionGoal"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionMessage_sessionId_idx" ON "SessionMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionMessage_senderId_idx" ON "SessionMessage"("senderId");
CREATE INDEX IF NOT EXISTS "SessionMessage_createdAt_idx" ON "SessionMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "StudySession_createdBy_idx" ON "StudySession"("createdBy");
CREATE INDEX IF NOT EXISTS "StudySession_status_idx" ON "StudySession"("status");
CREATE INDEX IF NOT EXISTS "StudySession_type_idx" ON "StudySession"("type");
CREATE INDEX IF NOT EXISTS "StudySession_agoraChannel_idx" ON "StudySession"("agoraChannel");
