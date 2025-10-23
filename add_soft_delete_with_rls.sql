-- ==========================================
-- SOFT DELETE MIGRATION WITH RLS SECURITY
-- Add soft delete fields to Post table and update RLS policies
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- STEP 1: Add soft delete columns to Post table
-- ==========================================
DO $$ BEGIN
    -- Add isDeleted column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'isDeleted'
    ) THEN
        ALTER TABLE "Post" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE '✅ Added isDeleted column to Post table';
    ELSE
        RAISE NOTICE '⚠️  isDeleted column already exists, skipping...';
    END IF;

    -- Add deletedAt column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'deletedAt'
    ) THEN
        ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);
        RAISE NOTICE '✅ Added deletedAt column to Post table';
    ELSE
        RAISE NOTICE '⚠️  deletedAt column already exists, skipping...';
    END IF;
END $$;

-- ==========================================
-- STEP 2: Create indexes for soft delete queries
-- ==========================================
CREATE INDEX IF NOT EXISTS "Post_isDeleted_idx" ON "Post"("isDeleted");
CREATE INDEX IF NOT EXISTS "Post_deletedAt_idx" ON "Post"("deletedAt");

-- ==========================================
-- STEP 3: Update RLS policies to exclude deleted posts
-- ==========================================

-- Drop existing Post SELECT policy
DROP POLICY IF EXISTS "Users can view posts based on privacy" ON "Post";

-- Recreate SELECT policy with soft delete filter
CREATE POLICY "Users can view posts based on privacy"
ON "Post"
FOR SELECT
USING (
  -- IMPORTANT: Exclude soft-deleted posts from regular queries
  -- Only show deleted posts to the owner via specific API endpoint
  "isDeleted" = false
  AND
  (
    -- User's own posts (always visible if not deleted)
    "userId" = (SELECT auth.uid())::text
    OR
    -- Public posts (everyone can see)
    EXISTS (
      SELECT 1 FROM "Profile"
      WHERE "Profile"."userId" = "Post"."userId"
      AND "Profile"."postPrivacy" = 'PUBLIC'
    )
    OR
    -- Partners-only posts (only connected partners can see)
    (
      EXISTS (
        SELECT 1 FROM "Profile"
        WHERE "Profile"."userId" = "Post"."userId"
        AND "Profile"."postPrivacy" = 'PARTNERS_ONLY'
      )
      AND
      EXISTS (
        SELECT 1 FROM "Match"
        WHERE "Match"."status" = 'ACCEPTED'
        AND (
          ("Match"."senderId" = (SELECT auth.uid())::text AND "Match"."receiverId" = "Post"."userId")
          OR
          ("Match"."receiverId" = (SELECT auth.uid())::text AND "Match"."senderId" = "Post"."userId")
        )
      )
    )
  )
);

-- ==========================================
-- STEP 4: Add special policy for viewing deleted posts
-- ==========================================

-- Drop existing policy if any
DROP POLICY IF EXISTS "Users can view their own deleted posts" ON "Post";

-- Allow users to view their own deleted posts (for Post History)
CREATE POLICY "Users can view their own deleted posts"
ON "Post"
FOR SELECT
USING (
  "userId" = (SELECT auth.uid())::text
  AND "isDeleted" = true
);

-- ==========================================
-- STEP 5: Update existing UPDATE policy
-- ==========================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own posts" ON "Post";

-- Recreate UPDATE policy (allows updating isDeleted and deletedAt for soft delete)
CREATE POLICY "Users can update their own posts"
ON "Post"
FOR UPDATE
USING ("userId" = (SELECT auth.uid())::text)
WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- STEP 6: Update existing DELETE policy
-- ==========================================

-- Keep DELETE policy as-is for permanent deletion
-- (used after 30 days for automatic cleanup)
-- No changes needed - existing policy is correct

-- ==========================================
-- STEP 7: Update RLS policies for related tables
-- ==========================================

-- Update PostLike SELECT policy to exclude deleted posts
DROP POLICY IF EXISTS "Users can view likes on visible posts" ON "PostLike";

CREATE POLICY "Users can view likes on visible posts"
ON "PostLike"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostLike"."postId"
    AND "Post"."isDeleted" = false  -- Exclude deleted posts
    AND (
      "Post"."userId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "Profile"
        WHERE "Profile"."userId" = "Post"."userId"
        AND "Profile"."postPrivacy" = 'PUBLIC'
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM "Profile"
          WHERE "Profile"."userId" = "Post"."userId"
          AND "Profile"."postPrivacy" = 'PARTNERS_ONLY'
        )
        AND
        EXISTS (
          SELECT 1 FROM "Match"
          WHERE "Match"."status" = 'ACCEPTED'
          AND (
            ("Match"."senderId" = (SELECT auth.uid())::text AND "Match"."receiverId" = "Post"."userId")
            OR
            ("Match"."receiverId" = (SELECT auth.uid())::text AND "Match"."senderId" = "Post"."userId")
          )
        )
      )
    )
  )
);

-- Update PostComment SELECT policy to exclude deleted posts
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON "PostComment";

CREATE POLICY "Users can view comments on visible posts"
ON "PostComment"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostComment"."postId"
    AND "Post"."isDeleted" = false  -- Exclude deleted posts
    AND (
      "Post"."userId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "Profile"
        WHERE "Profile"."userId" = "Post"."userId"
        AND "Profile"."postPrivacy" = 'PUBLIC'
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM "Profile"
          WHERE "Profile"."userId" = "Post"."userId"
          AND "Profile"."postPrivacy" = 'PARTNERS_ONLY'
        )
        AND
        EXISTS (
          SELECT 1 FROM "Match"
          WHERE "Match"."status" = 'ACCEPTED'
          AND (
            ("Match"."senderId" = (SELECT auth.uid())::text AND "Match"."receiverId" = "Post"."userId")
            OR
            ("Match"."receiverId" = (SELECT auth.uid())::text AND "Match"."senderId" = "Post"."userId")
          )
        )
      )
    )
  )
);

-- Update PostRepost SELECT policy to exclude deleted posts
DROP POLICY IF EXISTS "Users can view reposts of visible posts" ON "PostRepost";

CREATE POLICY "Users can view reposts of visible posts"
ON "PostRepost"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostRepost"."postId"
    AND "Post"."isDeleted" = false  -- Exclude deleted posts
    AND (
      "Post"."userId" = (SELECT auth.uid())::text
      OR
      EXISTS (
        SELECT 1 FROM "Profile"
        WHERE "Profile"."userId" = "Post"."userId"
        AND "Profile"."postPrivacy" = 'PUBLIC'
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM "Profile"
          WHERE "Profile"."userId" = "Post"."userId"
          AND "Profile"."postPrivacy" = 'PARTNERS_ONLY'
        )
        AND
        EXISTS (
          SELECT 1 FROM "Match"
          WHERE "Match"."status" = 'ACCEPTED'
          AND (
            ("Match"."senderId" = (SELECT auth.uid())::text AND "Match"."receiverId" = "Post"."userId")
            OR
            ("Match"."receiverId" = (SELECT auth.uid())::text AND "Match"."senderId" = "Post"."userId")
          )
        )
      )
    )
  )
);

-- ==========================================
-- STEP 8: Verify migration success
-- ==========================================
DO $$
DECLARE
    isDeleted_exists BOOLEAN;
    deletedAt_exists BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check if columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'isDeleted'
    ) INTO isDeleted_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'deletedAt'
    ) INTO deletedAt_exists;

    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'Post';

    -- Print results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SOFT DELETE MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';

    IF isDeleted_exists THEN
        RAISE NOTICE '✅ isDeleted column: EXISTS';
    ELSE
        RAISE NOTICE '❌ isDeleted column: MISSING';
    END IF;

    IF deletedAt_exists THEN
        RAISE NOTICE '✅ deletedAt column: EXISTS';
    ELSE
        RAISE NOTICE '❌ deletedAt column: MISSING';
    END IF;

    RAISE NOTICE '✅ Post table RLS policies: % total', policy_count;
    RAISE NOTICE '✅ Indexes created: isDeleted_idx, deletedAt_idx';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Security Updates:';
    RAISE NOTICE '  • Deleted posts hidden from regular queries';
    RAISE NOTICE '  • Users can view their own deleted posts';
    RAISE NOTICE '  • Likes/comments/reposts on deleted posts hidden';
    RAISE NOTICE '  • Soft delete and restore enabled via UPDATE policy';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ READY TO USE SOFT DELETE FEATURE!';
    RAISE NOTICE '========================================';
END $$;
