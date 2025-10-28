-- ============================================
-- Add LearningProfile Table with RLS Security
-- ============================================

-- Create the LearningProfile table
CREATE TABLE IF NOT EXISTS "LearningProfile" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,

  -- Strengths and Weaknesses for Partner Matching
  "strengths" TEXT[] NOT NULL DEFAULT '{}',
  "weaknesses" TEXT[] NOT NULL DEFAULT '{}',
  "recommendedFocus" TEXT[] NOT NULL DEFAULT '{}',

  -- Analytics
  "analytics" JSONB,
  "lastComputedAt" TIMESTAMP(3),

  -- Learning Metrics
  "learningVelocity" DOUBLE PRECISION DEFAULT 1.0,
  "retentionRate" DOUBLE PRECISION DEFAULT 0.7,
  "preferredDifficulty" TEXT,

  -- Timestamps
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LearningProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "LearningProfile_userId_idx" ON "LearningProfile"("userId");
CREATE INDEX IF NOT EXISTS "LearningProfile_strengths_idx" ON "LearningProfile" USING GIN("strengths");
CREATE INDEX IF NOT EXISTS "LearningProfile_weaknesses_idx" ON "LearningProfile" USING GIN("weaknesses");

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on LearningProfile table
ALTER TABLE "LearningProfile" ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own learning profile
CREATE POLICY "Users can view own learning profile"
  ON "LearningProfile"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Policy 2: Users can view others' learning profiles (needed for partner matching)
-- The matchCandidates and matchInsight tools need to compare users
CREATE POLICY "Users can view others' learning profiles for matching"
  ON "LearningProfile"
  FOR SELECT
  USING (true); -- All authenticated users can read (required for AI matching)

-- Policy 3: Users can insert their own learning profile
CREATE POLICY "Users can insert own learning profile"
  ON "LearningProfile"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- Policy 4: Users can update their own learning profile
CREATE POLICY "Users can update own learning profile"
  ON "LearningProfile"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

-- Policy 5: Users can delete their own learning profile
CREATE POLICY "Users can delete own learning profile"
  ON "LearningProfile"
  FOR DELETE
  USING (auth.uid()::text = "userId");

-- Policy 6: Service role (AI agent backend) can manage all profiles
-- This allows buildLearningProfile tool to work via service role key
CREATE POLICY "Service role can manage all learning profiles"
  ON "LearningProfile"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Success Message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ LearningProfile table created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Policies Applied:';
  RAISE NOTICE '  ✓ Users can view their own profile';
  RAISE NOTICE '  ✓ Users can view others for partner matching';
  RAISE NOTICE '  ✓ Users can only modify their own profile';
  RAISE NOTICE '  ✓ Service role has full access for AI tools';
  RAISE NOTICE '';
  RAISE NOTICE 'Partner matching is now ready to use!';
END $$;
