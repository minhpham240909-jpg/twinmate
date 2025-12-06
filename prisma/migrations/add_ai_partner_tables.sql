-- AI Partner Tables Migration
-- Run this in Supabase SQL Editor
-- Includes RLS security and performance optimizations

-- =====================================================
-- STEP 1: CREATE ENUMS
-- =====================================================

DO $$ BEGIN
    CREATE TYPE "PartnerType" AS ENUM ('HUMAN', 'AI', 'SCRIPTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AISessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AIMessageType" AS ENUM ('CHAT', 'QUIZ', 'FLASHCARD', 'SUMMARY', 'TIMER', 'TOPIC_CHANGE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add AI_PARTNER to SessionType enum if not exists
DO $$ BEGIN
    ALTER TYPE "SessionType" ADD VALUE IF NOT EXISTS 'AI_PARTNER';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

-- =====================================================
-- STEP 2: ADD COLUMNS TO StudySession TABLE
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'StudySession' AND column_name = 'partnerType'
    ) THEN
        ALTER TABLE "StudySession" ADD COLUMN "partnerType" "PartnerType";
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'StudySession' AND column_name = 'aiPersonaId'
    ) THEN
        ALTER TABLE "StudySession" ADD COLUMN "aiPersonaId" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'StudySession' AND column_name = 'isAISession'
    ) THEN
        ALTER TABLE "StudySession" ADD COLUMN "isAISession" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- STEP 3: CREATE AIPartnerPersona TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS "AIPartnerPersona" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 500,
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studyMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "avatarUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPartnerPersona_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- STEP 4: CREATE AIPartnerSession TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS "AIPartnerSession" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "personaId" TEXT,
    "subject" TEXT,
    "skillLevel" "SkillLevel",
    "studyGoal" TEXT,
    "status" "AISessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalDuration" INTEGER,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "quizCount" INTEGER NOT NULL DEFAULT 0,
    "flashcardCount" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "feedback" TEXT,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "wasSafetyBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPartnerSession_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- STEP 5: CREATE AIPartnerMessage TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS "AIPartnerMessage" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "AIMessageType" NOT NULL DEFAULT 'CHAT',
    "quizData" JSONB,
    "flashcardData" JSONB,
    "wasModerated" BOOLEAN NOT NULL DEFAULT false,
    "moderationResult" JSONB,
    "wasFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPartnerMessage_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- STEP 6: ADD FOREIGN KEYS
-- =====================================================

-- AIPartnerSession foreign keys
DO $$ BEGIN
    ALTER TABLE "AIPartnerSession" ADD CONSTRAINT "AIPartnerSession_studySessionId_fkey"
    FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AIPartnerSession" ADD CONSTRAINT "AIPartnerSession_personaId_fkey"
    FOREIGN KEY ("personaId") REFERENCES "AIPartnerPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AIPartnerMessage foreign keys
DO $$ BEGIN
    ALTER TABLE "AIPartnerMessage" ADD CONSTRAINT "AIPartnerMessage_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AIPartnerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AIPartnerMessage" ADD CONSTRAINT "AIPartnerMessage_studySessionId_fkey"
    FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- STEP 7: ADD UNIQUE CONSTRAINTS
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AIPartnerSession_studySessionId_key'
    ) THEN
        ALTER TABLE "AIPartnerSession" ADD CONSTRAINT "AIPartnerSession_studySessionId_key"
        UNIQUE ("studySessionId");
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- STEP 8: CREATE PERFORMANCE INDEXES
-- =====================================================

-- AIPartnerPersona indexes
CREATE INDEX IF NOT EXISTS "AIPartnerPersona_isDefault_idx" ON "AIPartnerPersona"("isDefault");
CREATE INDEX IF NOT EXISTS "AIPartnerPersona_isActive_idx" ON "AIPartnerPersona"("isActive");
CREATE INDEX IF NOT EXISTS "AIPartnerPersona_subjects_idx" ON "AIPartnerPersona" USING GIN ("subjects");

-- AIPartnerSession indexes
CREATE INDEX IF NOT EXISTS "AIPartnerSession_userId_idx" ON "AIPartnerSession"("userId");
CREATE INDEX IF NOT EXISTS "AIPartnerSession_status_idx" ON "AIPartnerSession"("status");
CREATE INDEX IF NOT EXISTS "AIPartnerSession_startedAt_idx" ON "AIPartnerSession"("startedAt" DESC);
CREATE INDEX IF NOT EXISTS "AIPartnerSession_personaId_idx" ON "AIPartnerSession"("personaId");
CREATE INDEX IF NOT EXISTS "AIPartnerSession_userId_status_idx" ON "AIPartnerSession"("userId", "status");

-- AIPartnerMessage indexes
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_sessionId_idx" ON "AIPartnerMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_studySessionId_idx" ON "AIPartnerMessage"("studySessionId");
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_role_idx" ON "AIPartnerMessage"("role");
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_createdAt_idx" ON "AIPartnerMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_wasFlagged_idx" ON "AIPartnerMessage"("wasFlagged");
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_sessionId_createdAt_idx" ON "AIPartnerMessage"("sessionId", "createdAt");

-- StudySession new indexes
CREATE INDEX IF NOT EXISTS "StudySession_isAISession_idx" ON "StudySession"("isAISession");
CREATE INDEX IF NOT EXISTS "StudySession_partnerType_idx" ON "StudySession"("partnerType");

-- =====================================================
-- STEP 9: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE "AIPartnerPersona" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIPartnerSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIPartnerMessage" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 10: DROP EXISTING POLICIES (clean slate)
-- =====================================================

DROP POLICY IF EXISTS "persona_select_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_insert_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_update_policy" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "persona_delete_policy" ON "AIPartnerPersona";

DROP POLICY IF EXISTS "ai_session_select_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_insert_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_update_policy" ON "AIPartnerSession";
DROP POLICY IF EXISTS "ai_session_delete_policy" ON "AIPartnerSession";

DROP POLICY IF EXISTS "ai_message_select_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_insert_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_update_policy" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "ai_message_delete_policy" ON "AIPartnerMessage";

-- =====================================================
-- STEP 11: CREATE RLS POLICIES FOR AIPartnerPersona
-- Using (select auth.uid()) for performance optimization
-- =====================================================

-- SELECT: Everyone can see active personas, admins see all
CREATE POLICY "persona_select_policy" ON "AIPartnerPersona"
FOR SELECT USING (
    "isActive" = true
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Only admins can create personas
CREATE POLICY "persona_insert_policy" ON "AIPartnerPersona"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- UPDATE: Only admins can update personas
CREATE POLICY "persona_update_policy" ON "AIPartnerPersona"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- DELETE: Only admins can delete personas
CREATE POLICY "persona_delete_policy" ON "AIPartnerPersona"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- STEP 12: CREATE RLS POLICIES FOR AIPartnerSession
-- Using (select auth.uid()) for performance optimization
-- =====================================================

-- SELECT: Users see own sessions, admins see all
CREATE POLICY "ai_session_select_policy" ON "AIPartnerSession"
FOR SELECT USING (
    "userId" = (select auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Users can create their own sessions
CREATE POLICY "ai_session_insert_policy" ON "AIPartnerSession"
FOR INSERT WITH CHECK (
    "userId" = (select auth.uid())::text
);

-- UPDATE: Users can update own sessions, admins can update any
CREATE POLICY "ai_session_update_policy" ON "AIPartnerSession"
FOR UPDATE USING (
    "userId" = (select auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- DELETE: Users can delete own sessions, admins can delete any
CREATE POLICY "ai_session_delete_policy" ON "AIPartnerSession"
FOR DELETE USING (
    "userId" = (select auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- STEP 13: CREATE RLS POLICIES FOR AIPartnerMessage
-- Using (select auth.uid()) for performance optimization
-- =====================================================

-- SELECT: Users see messages from their sessions, admins see all
CREATE POLICY "ai_message_select_policy" ON "AIPartnerMessage"
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "AIPartnerSession"
        WHERE "AIPartnerSession"."id" = "AIPartnerMessage"."sessionId"
        AND "AIPartnerSession"."userId" = (select auth.uid())::text
    )
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Users can add messages to their sessions
CREATE POLICY "ai_message_insert_policy" ON "AIPartnerMessage"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "AIPartnerSession"
        WHERE "AIPartnerSession"."id" = "AIPartnerMessage"."sessionId"
        AND "AIPartnerSession"."userId" = (select auth.uid())::text
    )
);

-- UPDATE: Admins only (for moderation updates)
CREATE POLICY "ai_message_update_policy" ON "AIPartnerMessage"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- DELETE: Admins only
CREATE POLICY "ai_message_delete_policy" ON "AIPartnerMessage"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- STEP 14: CREATE TRIGGER FOR updatedAt
-- =====================================================

CREATE OR REPLACE FUNCTION update_ai_partner_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

DROP TRIGGER IF EXISTS ai_partner_persona_updated_at_trigger ON "AIPartnerPersona";
CREATE TRIGGER ai_partner_persona_updated_at_trigger
    BEFORE UPDATE ON "AIPartnerPersona"
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_partner_updated_at();

DROP TRIGGER IF EXISTS ai_partner_session_updated_at_trigger ON "AIPartnerSession";
CREATE TRIGGER ai_partner_session_updated_at_trigger
    BEFORE UPDATE ON "AIPartnerSession"
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_partner_updated_at();

-- =====================================================
-- STEP 15: CREATE DEFAULT PERSONA
-- =====================================================

INSERT INTO "AIPartnerPersona" (
    "id",
    "name",
    "description",
    "systemPrompt",
    "temperature",
    "maxTokens",
    "subjects",
    "studyMethods",
    "tone",
    "isDefault",
    "isActive"
) VALUES (
    'default-study-buddy',
    'Study Buddy',
    'A friendly and encouraging AI study partner that helps you learn effectively.',
    'You are a friendly, focused AI STUDY PARTNER named "Clerva AI" helping a student with their studies.

IMPORTANT RULES - YOU MUST FOLLOW THESE:
1. Stay strictly on-topic to study tasks. NO flirting, romance, or personal relationships.
2. If the user tries to go off-topic or asks inappropriate questions, politely redirect to studying.
3. Never pretend to be a real human. You are an AI study assistant.
4. Keep responses concise and helpful. Use short paragraphs and bullet points.
5. Be encouraging but honest about areas that need improvement.
6. If you don''t know something, admit it and suggest resources.

YOUR CAPABILITIES:
- Explain concepts clearly at the appropriate level
- Generate quiz questions to test understanding
- Create flashcard content for memorization
- Suggest study techniques (pomodoro, spaced repetition, etc.)
- Help break down complex problems step by step
- Provide practice problems and check answers
- Summarize topics and key points

Start by greeting the student warmly (1 sentence) and asking what they''d like to focus on today. Keep it brief and friendly.',
    0.7,
    500,
    ARRAY[]::TEXT[],
    ARRAY['explanation', 'quiz', 'flashcards', 'pomodoro']::TEXT[],
    'friendly',
    true,
    true
)
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "systemPrompt" = EXCLUDED."systemPrompt",
    "isDefault" = true,
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

-- =====================================================
-- DONE! Verify setup
-- =====================================================
SELECT 'SUCCESS: AI Partner tables created with RLS and performance optimizations!' as result;

-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('AIPartnerPersona', 'AIPartnerSession', 'AIPartnerMessage');

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('AIPartnerPersona', 'AIPartnerSession', 'AIPartnerMessage');

-- Verify policies exist
SELECT policyname, tablename FROM pg_policies
WHERE tablename IN ('AIPartnerPersona', 'AIPartnerSession', 'AIPartnerMessage')
ORDER BY tablename;
