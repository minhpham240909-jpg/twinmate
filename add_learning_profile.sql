-- Add LearningProfile table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS "LearningProfile_userId_idx" ON "LearningProfile"("userId");
CREATE INDEX IF NOT EXISTS "LearningProfile_strengths_idx" ON "LearningProfile" USING GIN("strengths");
CREATE INDEX IF NOT EXISTS "LearningProfile_weaknesses_idx" ON "LearningProfile" USING GIN("weaknesses");

-- Add success message
DO $$
BEGIN
  RAISE NOTICE 'LearningProfile table created successfully!';
END $$;
