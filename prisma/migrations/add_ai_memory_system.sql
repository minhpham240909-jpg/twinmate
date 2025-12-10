-- AI Memory System Migration
-- Run this SQL to add AI memory capabilities
-- Safe to run multiple times (uses IF NOT EXISTS and DROP POLICY IF EXISTS)
-- Optimized for Supabase RLS performance (uses select auth.uid())

-- ==========================================
-- AI Memory Category Enum
-- ==========================================
DO $$ BEGIN
    CREATE TYPE "AIMemoryCategory" AS ENUM (
        'PREFERENCE',
        'ACADEMIC',
        'PERSONAL_FACT',
        'STUDY_HABIT',
        'ACHIEVEMENT',
        'STRUGGLE',
        'GOAL',
        'FEEDBACK',
        'CONVERSATION_TOPIC'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- AI User Memory Table
-- Long-term storage of user preferences and context
-- ==========================================
CREATE TABLE IF NOT EXISTS "ai_user_memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    -- Basic User Preferences
    "preferredName" TEXT,
    "preferredLearningStyle" TEXT,
    "preferredDifficulty" TEXT,
    "preferredPace" TEXT,
    "timezone" TEXT,

    -- Academic Context
    "currentSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "masteredTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strugglingTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "upcomingExams" JSONB,
    "academicGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Personality & Communication
    "communicationStyle" TEXT,
    "motivationalNeeds" TEXT,
    "humorPreference" TEXT,

    -- Study Habits
    "bestStudyTime" TEXT,
    "avgSessionLength" INTEGER,
    "breakPreference" TEXT,

    -- Interaction History Summary
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalStudyMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastSessionDate" TIMESTAMP(3),
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,

    -- Important Facts
    "importantFacts" JSONB,

    -- Session Continuity
    "lastTopicDiscussed" TEXT,
    "pendingQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- AI Behavior Customization
    "customInstructions" TEXT,

    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_user_memory_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on userId (one memory per user)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_user_memory_userId_key" ON "ai_user_memory"("userId");

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS "ai_user_memory_userId_idx" ON "ai_user_memory"("userId");

-- ==========================================
-- AI Memory Entries Table
-- Individual memory items for retrieval
-- ==========================================
CREATE TABLE IF NOT EXISTS "ai_memory_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    -- Memory classification
    "category" "AIMemoryCategory" NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,

    -- Content
    "content" TEXT NOT NULL,
    "context" TEXT,

    -- Source tracking
    "sessionId" TEXT,
    "messageId" TEXT,

    -- Retrieval metadata
    "lastAccessed" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,

    -- Validity
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),

    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memory_entries_pkey" PRIMARY KEY ("id")
);

-- Indexes for ai_memory_entries
CREATE INDEX IF NOT EXISTS "ai_memory_entries_userId_idx" ON "ai_memory_entries"("userId");
CREATE INDEX IF NOT EXISTS "ai_memory_entries_category_idx" ON "ai_memory_entries"("category");
CREATE INDEX IF NOT EXISTS "ai_memory_entries_importance_idx" ON "ai_memory_entries"("importance");
CREATE INDEX IF NOT EXISTS "ai_memory_entries_userId_category_idx" ON "ai_memory_entries"("userId", "category");
CREATE INDEX IF NOT EXISTS "ai_memory_entries_userId_isActive_idx" ON "ai_memory_entries"("userId", "isActive");

-- ==========================================
-- FUNCTIONS: Auto-update updatedAt timestamp
-- ==========================================
CREATE OR REPLACE FUNCTION update_ai_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS trigger_ai_user_memory_updated_at ON "ai_user_memory";
CREATE TRIGGER trigger_ai_user_memory_updated_at
    BEFORE UPDATE ON "ai_user_memory"
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_memory_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_memory_entries_updated_at ON "ai_memory_entries";
CREATE TRIGGER trigger_ai_memory_entries_updated_at
    BEFORE UPDATE ON "ai_memory_entries"
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_memory_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on memory tables
ALTER TABLE "ai_user_memory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_memory_entries" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AI User Memory Policies
-- Using (select auth.uid()) for performance optimization
-- Single consolidated policy per action to avoid multiple permissive policies
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view own memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Users can insert own memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Users can update own memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Service role can manage user memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "Admins can view all user memory" ON "ai_user_memory";
DROP POLICY IF EXISTS "ai_user_memory_select_policy" ON "ai_user_memory";
DROP POLICY IF EXISTS "ai_user_memory_insert_policy" ON "ai_user_memory";
DROP POLICY IF EXISTS "ai_user_memory_update_policy" ON "ai_user_memory";

-- Consolidated SELECT policy: Users see own data, admins see all
CREATE POLICY "ai_user_memory_select_policy"
  ON "ai_user_memory" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- INSERT policy: Users can only insert their own memory
CREATE POLICY "ai_user_memory_insert_policy"
  ON "ai_user_memory" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- UPDATE policy: Users can only update their own memory
CREATE POLICY "ai_user_memory_update_policy"
  ON "ai_user_memory" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- AI Memory Entries Policies
-- Using (select auth.uid()) for performance optimization
-- Single consolidated policy per action to avoid multiple permissive policies
-- ==========================================

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Users can insert own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Users can update own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Users can delete own memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Service role can manage memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "Admins can view all memory entries" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_select_policy" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_insert_policy" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_update_policy" ON "ai_memory_entries";
DROP POLICY IF EXISTS "ai_memory_entries_delete_policy" ON "ai_memory_entries";

-- Consolidated SELECT policy: Users see own data, admins see all
CREATE POLICY "ai_memory_entries_select_policy"
  ON "ai_memory_entries" FOR SELECT
  USING (
    (select auth.uid())::text = "userId"
    OR
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = (select auth.uid())::text
      AND "User"."isAdmin" = true
    )
  );

-- INSERT policy: Users can only insert their own memory entries
CREATE POLICY "ai_memory_entries_insert_policy"
  ON "ai_memory_entries" FOR INSERT
  WITH CHECK ((select auth.uid())::text = "userId");

-- UPDATE policy: Users can only update their own memory entries
CREATE POLICY "ai_memory_entries_update_policy"
  ON "ai_memory_entries" FOR UPDATE
  USING ((select auth.uid())::text = "userId");

-- DELETE policy: Users can only delete their own memory entries
CREATE POLICY "ai_memory_entries_delete_policy"
  ON "ai_memory_entries" FOR DELETE
  USING ((select auth.uid())::text = "userId");

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

-- Grant full access to service_role for server-side operations (bypasses RLS)
GRANT ALL ON "ai_user_memory" TO service_role;
GRANT ALL ON "ai_memory_entries" TO service_role;

-- Grant select/insert/update to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE ON "ai_user_memory" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_memory_entries" TO authenticated;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================
COMMENT ON TABLE "ai_user_memory" IS 'Long-term storage of user preferences and context for AI personalization';
COMMENT ON TABLE "ai_memory_entries" IS 'Individual memory items extracted from conversations for retrieval';
COMMENT ON COLUMN "ai_user_memory"."preferredName" IS 'How the user prefers to be called';
COMMENT ON COLUMN "ai_user_memory"."streakDays" IS 'Current study streak in days';
COMMENT ON COLUMN "ai_memory_entries"."importance" IS 'Memory importance on 1-10 scale';
COMMENT ON COLUMN "ai_memory_entries"."isActive" IS 'Whether memory is active (false = cleaned up)';
