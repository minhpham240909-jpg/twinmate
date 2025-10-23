-- Add Community Feature Tables WITH RLS Security
-- Run this in Supabase SQL Editor

-- ==========================================
-- STEP 1: Create PostPrivacy enum
-- ==========================================
DO $$ BEGIN
    CREATE TYPE "PostPrivacy" AS ENUM ('PUBLIC', 'PARTNERS_ONLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- STEP 2: Add postPrivacy column to Profile table
-- ==========================================
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "postPrivacy" "PostPrivacy" DEFAULT 'PUBLIC' NOT NULL;

-- ==========================================
-- STEP 3: Create Post table
-- ==========================================
CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- STEP 4: Create PostLike table
-- ==========================================
CREATE TABLE IF NOT EXISTS "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- STEP 5: Create PostComment table
-- ==========================================
CREATE TABLE IF NOT EXISTS "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- STEP 6: Create PostRepost table
-- ==========================================
CREATE TABLE IF NOT EXISTS "PostRepost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostRepost_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- STEP 7: Create unique constraints
-- ==========================================
DO $$ BEGIN
    ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_userId_key" UNIQUE("postId", "userId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostRepost" ADD CONSTRAINT "PostRepost_postId_userId_key" UNIQUE("postId", "userId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- STEP 8: Create indexes for Post
-- ==========================================
CREATE INDEX IF NOT EXISTS "Post_userId_idx" ON "Post"("userId");
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt");

-- ==========================================
-- STEP 9: Create indexes for PostLike
-- ==========================================
CREATE INDEX IF NOT EXISTS "PostLike_postId_idx" ON "PostLike"("postId");
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike"("userId");

-- ==========================================
-- STEP 10: Create indexes for PostComment
-- ==========================================
CREATE INDEX IF NOT EXISTS "PostComment_postId_idx" ON "PostComment"("postId");
CREATE INDEX IF NOT EXISTS "PostComment_userId_idx" ON "PostComment"("userId");
CREATE INDEX IF NOT EXISTS "PostComment_createdAt_idx" ON "PostComment"("createdAt");

-- ==========================================
-- STEP 11: Create indexes for PostRepost
-- ==========================================
CREATE INDEX IF NOT EXISTS "PostRepost_postId_idx" ON "PostRepost"("postId");
CREATE INDEX IF NOT EXISTS "PostRepost_userId_idx" ON "PostRepost"("userId");
CREATE INDEX IF NOT EXISTS "PostRepost_createdAt_idx" ON "PostRepost"("createdAt");

-- ==========================================
-- STEP 12: Add foreign key constraints
-- ==========================================
DO $$ BEGIN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey"
        FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey"
        FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostRepost" ADD CONSTRAINT "PostRepost_postId_fkey"
        FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PostRepost" ADD CONSTRAINT "PostRepost_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- STEP 13: Enable RLS on all tables
-- ==========================================
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostRepost" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 14: RLS Policies for Post table
-- ==========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view posts based on privacy" ON "Post";
DROP POLICY IF EXISTS "Users can create their own posts" ON "Post";
DROP POLICY IF EXISTS "Users can update their own posts" ON "Post";
DROP POLICY IF EXISTS "Users can delete their own posts" ON "Post";

-- SELECT: View posts based on privacy settings
CREATE POLICY "Users can view posts based on privacy"
ON "Post"
FOR SELECT
USING (
  -- User's own posts (always visible)
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
);

-- INSERT: Users can create their own posts
CREATE POLICY "Users can create their own posts"
ON "Post"
FOR INSERT
WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- UPDATE: Users can update their own posts
CREATE POLICY "Users can update their own posts"
ON "Post"
FOR UPDATE
USING ("userId" = (SELECT auth.uid())::text)
WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- DELETE: Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON "Post"
FOR DELETE
USING ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- STEP 15: RLS Policies for PostLike table
-- ==========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view likes on visible posts" ON "PostLike";
DROP POLICY IF EXISTS "Users can create their own likes" ON "PostLike";
DROP POLICY IF EXISTS "Users can delete their own likes" ON "PostLike";

-- SELECT: View likes on posts user can see
CREATE POLICY "Users can view likes on visible posts"
ON "PostLike"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostLike"."postId"
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

-- INSERT: Users can like posts they can see
CREATE POLICY "Users can create their own likes"
ON "PostLike"
FOR INSERT
WITH CHECK (
  "userId" = (SELECT auth.uid())::text
  AND
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostLike"."postId"
  )
);

-- DELETE: Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
ON "PostLike"
FOR DELETE
USING ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- STEP 16: RLS Policies for PostComment table
-- ==========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON "PostComment";
DROP POLICY IF EXISTS "Users can create comments on visible posts" ON "PostComment";
DROP POLICY IF EXISTS "Users can update their own comments" ON "PostComment";
DROP POLICY IF EXISTS "Users can delete their own comments" ON "PostComment";

-- SELECT: View comments on posts user can see
CREATE POLICY "Users can view comments on visible posts"
ON "PostComment"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostComment"."postId"
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

-- INSERT: Users can comment on posts they can see
CREATE POLICY "Users can create comments on visible posts"
ON "PostComment"
FOR INSERT
WITH CHECK (
  "userId" = (SELECT auth.uid())::text
  AND
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostComment"."postId"
  )
);

-- UPDATE: Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON "PostComment"
FOR UPDATE
USING ("userId" = (SELECT auth.uid())::text)
WITH CHECK ("userId" = (SELECT auth.uid())::text);

-- DELETE: Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON "PostComment"
FOR DELETE
USING ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- STEP 17: RLS Policies for PostRepost table
-- ==========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view reposts of visible posts" ON "PostRepost";
DROP POLICY IF EXISTS "Users can create their own reposts" ON "PostRepost";
DROP POLICY IF EXISTS "Users can delete their own reposts" ON "PostRepost";

-- SELECT: View reposts of posts user can see
CREATE POLICY "Users can view reposts of visible posts"
ON "PostRepost"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostRepost"."postId"
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

-- INSERT: Users can repost posts they can see
CREATE POLICY "Users can create their own reposts"
ON "PostRepost"
FOR INSERT
WITH CHECK (
  "userId" = (SELECT auth.uid())::text
  AND
  EXISTS (
    SELECT 1 FROM "Post"
    WHERE "Post"."id" = "PostRepost"."postId"
  )
);

-- DELETE: Users can delete their own reposts
CREATE POLICY "Users can delete their own reposts"
ON "PostRepost"
FOR DELETE
USING ("userId" = (SELECT auth.uid())::text);

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$ BEGIN
    RAISE NOTICE 'Community tables created successfully with RLS security!';
    RAISE NOTICE '✅ Post table: 4 policies';
    RAISE NOTICE '✅ PostLike table: 3 policies';
    RAISE NOTICE '✅ PostComment table: 4 policies';
    RAISE NOTICE '✅ PostRepost table: 3 policies';
    RAISE NOTICE '✅ Total: 14 RLS policies created';
    RAISE NOTICE '✅ All policies optimized with (SELECT auth.uid())::text pattern';
END $$;
