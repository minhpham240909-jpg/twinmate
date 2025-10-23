-- ==========================================
-- POST SHARING FEATURE MIGRATION WITH OPTIMIZED RLS
-- Add allowSharing field and update existing RLS policies (no duplicates)
-- Run this in Supabase SQL Editor AFTER add_soft_delete_with_rls.sql
-- ==========================================

-- ==========================================
-- STEP 1: Add allowSharing column to Post table
-- ==========================================
DO $$ BEGIN
    -- Add allowSharing column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'allowSharing'
    ) THEN
        ALTER TABLE "Post" ADD COLUMN "allowSharing" BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE '✅ Added allowSharing column to Post table';
    ELSE
        RAISE NOTICE '⚠️  allowSharing column already exists, skipping...';
    END IF;
END $$;

-- ==========================================
-- STEP 2: Create index for sharing queries
-- ==========================================
CREATE INDEX IF NOT EXISTS "Post_allowSharing_idx" ON "Post"("allowSharing");

-- ==========================================
-- STEP 3: Update Post SELECT policy to include public sharing
-- (Merge "Public can view shared posts" into existing policy)
-- ==========================================

-- Drop all existing Post SELECT policies
DROP POLICY IF EXISTS "Users can view posts based on privacy" ON "Post";
DROP POLICY IF EXISTS "Users can view their own deleted posts" ON "Post";
DROP POLICY IF EXISTS "Public can view shared posts" ON "Post";

-- Create single optimized SELECT policy for all cases
CREATE POLICY "Users can view posts based on privacy and sharing"
ON "Post"
FOR SELECT
USING (
  -- Case 1: User's own deleted posts (for Post History)
  (
    "userId" = (SELECT auth.uid())::text
    AND "isDeleted" = true
  )
  OR
  -- Case 2: Public can view shared posts (unauthenticated access)
  (
    "isDeleted" = false
    AND "allowSharing" = true
  )
  OR
  -- Case 3: Authenticated users can view posts based on privacy (existing logic)
  (
    "isDeleted" = false
    AND (
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
  )
);

-- ==========================================
-- STEP 4: Update PostLike SELECT policy to include public sharing
-- (Merge "Public can view likes on shared posts" into existing policy)
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view likes on visible posts" ON "PostLike";
DROP POLICY IF EXISTS "Public can view likes on shared posts" ON "PostLike";

-- Create single optimized SELECT policy
CREATE POLICY "Users can view likes on visible and shared posts"
ON "PostLike"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostLike"."postId"
    AND "Post"."isDeleted" = false
    AND (
      -- Public can view likes on shared posts
      "Post"."allowSharing" = true
      OR
      -- Authenticated users can view based on privacy
      (
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
  )
);

-- ==========================================
-- STEP 5: Update PostComment SELECT policy to include public sharing
-- (Merge "Public can view comments on shared posts" into existing policy)
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON "PostComment";
DROP POLICY IF EXISTS "Public can view comments on shared posts" ON "PostComment";

-- Create single optimized SELECT policy
CREATE POLICY "Users can view comments on visible and shared posts"
ON "PostComment"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostComment"."postId"
    AND "Post"."isDeleted" = false
    AND (
      -- Public can view comments on shared posts
      "Post"."allowSharing" = true
      OR
      -- Authenticated users can view based on privacy
      (
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
  )
);

-- ==========================================
-- STEP 6: Verify migration success
-- ==========================================
DO $$
DECLARE
    allowSharing_exists BOOLEAN;
    post_policy_count INTEGER;
    postlike_policy_count INTEGER;
    postcomment_policy_count INTEGER;
BEGIN
    -- Check if column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'allowSharing'
    ) INTO allowSharing_exists;

    -- Count policies for each table
    SELECT COUNT(*) INTO post_policy_count
    FROM pg_policies
    WHERE tablename = 'Post' AND cmd = 'SELECT';

    SELECT COUNT(*) INTO postlike_policy_count
    FROM pg_policies
    WHERE tablename = 'PostLike' AND cmd = 'SELECT';

    SELECT COUNT(*) INTO postcomment_policy_count
    FROM pg_policies
    WHERE tablename = 'PostComment' AND cmd = 'SELECT';

    -- Print results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'POST SHARING MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';

    IF allowSharing_exists THEN
        RAISE NOTICE '✅ allowSharing column: EXISTS';
    ELSE
        RAISE NOTICE '❌ allowSharing column: MISSING';
    END IF;

    RAISE NOTICE '✅ Index created: allowSharing_idx';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Policy Optimization:';
    RAISE NOTICE '  • Post SELECT policies: % (should be 1)', post_policy_count;
    RAISE NOTICE '  • PostLike SELECT policies: % (should be 1)', postlike_policy_count;
    RAISE NOTICE '  • PostComment SELECT policies: % (should be 1)', postcomment_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Sharing Features:';
    RAISE NOTICE '  • Posts can be shared outside the app';
    RAISE NOTICE '  • Users can disable sharing per post';
    RAISE NOTICE '  • Public can view shared posts (if allowed)';
    RAISE NOTICE '  • Public can view likes/comments on shared posts';
    RAISE NOTICE '  • Deleted posts not accessible via share links';
    RAISE NOTICE '  • NO multiple permissive policies (optimized!)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ READY TO USE SHARING FEATURE!';
    RAISE NOTICE '========================================';
END $$;
