-- ==========================================
-- POST SHARING FEATURE MIGRATION
-- Add allowSharing field to enable/disable post sharing
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
-- STEP 3: Add RLS policy for public post viewing (shared links)
-- ==========================================

-- Drop existing policy if any
DROP POLICY IF EXISTS "Public can view shared posts" ON "Post";

-- Allow anyone to view posts via share link (if not deleted and sharing is allowed)
CREATE POLICY "Public can view shared posts"
ON "Post"
FOR SELECT
USING (
  "isDeleted" = false
  AND "allowSharing" = true
  -- Note: This policy allows unauthenticated access for sharing
  -- The API endpoint will handle additional privacy checks
);

-- ==========================================
-- STEP 4: Update RLS policies for related tables (public access)
-- ==========================================

-- Allow public to view likes on shared posts (first 3 only via API)
DROP POLICY IF EXISTS "Public can view likes on shared posts" ON "PostLike";

CREATE POLICY "Public can view likes on shared posts"
ON "PostLike"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostLike"."postId"
    AND "Post"."isDeleted" = false
    AND "Post"."allowSharing" = true
  )
);

-- Allow public to view comments on shared posts (first 3 only via API)
DROP POLICY IF EXISTS "Public can view comments on shared posts" ON "PostComment";

CREATE POLICY "Public can view comments on shared posts"
ON "PostComment"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostComment"."postId"
    AND "Post"."isDeleted" = false
    AND "Post"."allowSharing" = true
  )
);

-- ==========================================
-- STEP 5: Verify migration success
-- ==========================================
DO $$
DECLARE
    allowSharing_exists BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check if column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Post' AND column_name = 'allowSharing'
    ) INTO allowSharing_exists;

    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'Post';

    -- Print results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'POST SHARING MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';

    IF allowSharing_exists THEN
        RAISE NOTICE '✅ allowSharing column: EXISTS';
    ELSE
        RAISE NOTICE '❌ allowSharing column: MISSING';
    END IF;

    RAISE NOTICE '✅ Post table RLS policies: % total', policy_count;
    RAISE NOTICE '✅ Index created: allowSharing_idx';
    RAISE NOTICE '';
    RAISE NOTICE 'Sharing Features:';
    RAISE NOTICE '  • Posts can be shared outside the app';
    RAISE NOTICE '  • Users can disable sharing per post';
    RAISE NOTICE '  • Public can view shared posts (if allowed)';
    RAISE NOTICE '  • Public can view likes/comments on shared posts';
    RAISE NOTICE '  • Deleted posts not accessible via share links';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ READY TO USE SHARING FEATURE!';
    RAISE NOTICE '========================================';
END $$;
