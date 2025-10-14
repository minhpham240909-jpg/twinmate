-- Add new enum for collaboration type
CREATE TYPE "CollaborationType" AS ENUM ('STUDY', 'STARTUP', 'HACKATHON', 'PROJECT', 'MIXED');

-- Add new fields to Profile table (all optional or with defaults - won't break existing data)
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "collaborationType" "CollaborationType"[] DEFAULT ARRAY['STUDY']::"CollaborationType"[],
  ADD COLUMN IF NOT EXISTS "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "lookingFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "industry" TEXT,
  ADD COLUMN IF NOT EXISTS "skillsCustomDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "lookingForCustomDescription" TEXT;

-- Make skillLevel and studyStyle optional (nullable)
ALTER TABLE "Profile"
  ALTER COLUMN "skillLevel" DROP NOT NULL,
  ALTER COLUMN "studyStyle" DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "Profile_collaborationType_idx" ON "Profile" USING GIN ("collaborationType");
CREATE INDEX IF NOT EXISTS "Profile_skills_idx" ON "Profile" USING GIN ("skills");

-- Verify changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Profile'
AND column_name IN ('collaborationType', 'skills', 'lookingFor', 'industry', 'skillLevel', 'studyStyle')
ORDER BY column_name;
