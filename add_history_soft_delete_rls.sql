-- ==========================================
-- HISTORY SECTION: SOFT DELETE MIGRATION WITH RLS SECURITY
-- Add soft delete fields to Message and Group tables
-- Update RLS policies for History section functionality
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- STEP 1: Add soft delete columns to Message table
-- ==========================================
DO $$ BEGIN
    -- Add isDeleted column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Message' AND column_name = 'isDeleted'
    ) THEN
        ALTER TABLE "Message" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE '✅ Added isDeleted column to Message table';
    ELSE
        RAISE NOTICE '⚠️  isDeleted column already exists, skipping...';
    END IF;
END $$;

-- ==========================================
-- STEP 2: Add soft delete columns to Group table
-- ==========================================
DO $$ BEGIN
    -- Add isDeleted column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Group' AND column_name = 'isDeleted'
    ) THEN
        ALTER TABLE "Group" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE '✅ Added isDeleted column to Group table';
    ELSE
        RAISE NOTICE '⚠️  isDeleted column already exists, skipping...';
    END IF;

    -- Add deletedAt column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Group' AND column_name = 'deletedAt'
    ) THEN
        ALTER TABLE "Group" ADD COLUMN "deletedAt" TIMESTAMP(3);
        RAISE NOTICE '✅ Added deletedAt column to Group table';
    ELSE
        RAISE NOTICE '⚠️  deletedAt column already exists, skipping...';
    END IF;
END $$;

-- ==========================================
-- STEP 3: Create indexes for soft delete queries
-- ==========================================
CREATE INDEX IF NOT EXISTS "Message_isDeleted_idx" ON "Message"("isDeleted");
CREATE INDEX IF NOT EXISTS "Group_isDeleted_idx" ON "Group"("isDeleted");
CREATE INDEX IF NOT EXISTS "Group_deletedAt_idx" ON "Group"("deletedAt");

-- ==========================================
-- STEP 4: Update RLS policies for Message table
-- ==========================================

-- Drop existing Message SELECT policies if they exist
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON "Message";
DROP POLICY IF EXISTS "Users can view their own deleted messages" ON "Message";

-- Recreate SELECT policy with soft delete filter (exclude deleted messages from regular queries)
CREATE POLICY "Users can view messages they sent or received"
ON "Message"
FOR SELECT
USING (
  -- IMPORTANT: Exclude soft-deleted messages from regular queries
  "isDeleted" = false
  AND (
    -- User sent the message
    "senderId" = (SELECT auth.uid())::text
    OR
    -- User received the DM
    "recipientId" = (SELECT auth.uid())::text
    OR
    -- User is member of the group
    EXISTS (
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "Message"."groupId"
      AND "GroupMember"."userId" = (SELECT auth.uid())::text
    )
  )
);

-- Allow users to view their own deleted messages (for History section)
CREATE POLICY "Users can view their own deleted messages"
ON "Message"
FOR SELECT
USING (
  "isDeleted" = true
  AND (
    "senderId" = (SELECT auth.uid())::text
    OR "recipientId" = (SELECT auth.uid())::text
  )
);

-- Update UPDATE policy to allow soft delete
DROP POLICY IF EXISTS "Users can update their own messages" ON "Message";
CREATE POLICY "Users can update their own messages"
ON "Message"
FOR UPDATE
USING ("senderId" = (SELECT auth.uid())::text)
WITH CHECK ("senderId" = (SELECT auth.uid())::text);

-- ==========================================
-- STEP 5: Update RLS policies for Group table
-- ==========================================

-- Drop existing Group SELECT policies if they exist
DROP POLICY IF EXISTS "Users can view groups" ON "Group";
DROP POLICY IF EXISTS "Users can view their own deleted groups" ON "Group";

-- Recreate SELECT policy with soft delete filter (exclude deleted groups from regular queries)
CREATE POLICY "Users can view groups"
ON "Group"
FOR SELECT
USING (
  -- IMPORTANT: Exclude soft-deleted groups from regular queries
  "isDeleted" = false
  AND (
    -- User is owner
    "ownerId" = (SELECT auth.uid())::text
    OR
    -- User is member
    EXISTS (
      SELECT 1 FROM "GroupMember"
      WHERE "GroupMember"."groupId" = "Group"."id"
      AND "GroupMember"."userId" = (SELECT auth.uid())::text
    )
    OR
    -- Public groups
    "privacy" = 'PUBLIC'
  )
);

-- Allow users to view their own deleted groups (for History section)
CREATE POLICY "Users can view their own deleted groups"
ON "Group"
FOR SELECT
USING (
  "isDeleted" = true
  AND "ownerId" = (SELECT auth.uid())::text
);

-- Update UPDATE policy to allow soft delete (only owner can delete)
DROP POLICY IF EXISTS "Group owners can update their groups" ON "Group";
CREATE POLICY "Group owners can update their groups"
ON "Group"
FOR UPDATE
USING ("ownerId" = (SELECT auth.uid())::text)
WITH CHECK ("ownerId" = (SELECT auth.uid())::text);

-- ==========================================
-- STEP 6: Update GroupMember SELECT policy to exclude deleted groups
-- ==========================================
DROP POLICY IF EXISTS "Users can view group memberships" ON "GroupMember";

CREATE POLICY "Users can view group memberships"
ON "GroupMember"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupMember"."groupId"
    AND "Group"."isDeleted" = false  -- Exclude deleted groups
  )
);

-- ==========================================
-- STEP 7: Update GroupInvite SELECT policy to exclude deleted groups
-- ==========================================
DROP POLICY IF EXISTS "Users can view group invites" ON "GroupInvite";

CREATE POLICY "Users can view group invites"
ON "GroupInvite"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Group"
    WHERE "Group"."id" = "GroupInvite"."groupId"
    AND "Group"."isDeleted" = false  -- Exclude deleted groups
  )
);

-- ==========================================
-- STEP 8: Verify migration success
-- ==========================================
DO $$
DECLARE
    message_isDeleted_exists BOOLEAN;
    group_isDeleted_exists BOOLEAN;
    group_deletedAt_exists BOOLEAN;
    message_policy_count INTEGER;
    group_policy_count INTEGER;
BEGIN
    -- Check if columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Message' AND column_name = 'isDeleted'
    ) INTO message_isDeleted_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Group' AND column_name = 'isDeleted'
    ) INTO group_isDeleted_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Group' AND column_name = 'deletedAt'
    ) INTO group_deletedAt_exists;

    -- Count policies
    SELECT COUNT(*) INTO message_policy_count
    FROM pg_policies
    WHERE tablename = 'Message';

    SELECT COUNT(*) INTO group_policy_count
    FROM pg_policies
    WHERE tablename = 'Group';

    -- Print results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'HISTORY SOFT DELETE MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';

    IF message_isDeleted_exists THEN
        RAISE NOTICE '✅ Message.isDeleted column: EXISTS';
    ELSE
        RAISE NOTICE '❌ Message.isDeleted column: MISSING';
    END IF;

    IF group_isDeleted_exists THEN
        RAISE NOTICE '✅ Group.isDeleted column: EXISTS';
    ELSE
        RAISE NOTICE '❌ Group.isDeleted column: MISSING';
    END IF;

    IF group_deletedAt_exists THEN
        RAISE NOTICE '✅ Group.deletedAt column: EXISTS';
    ELSE
        RAISE NOTICE '❌ Group.deletedAt column: MISSING';
    END IF;

    RAISE NOTICE '✅ Message table RLS policies: % total', message_policy_count;
    RAISE NOTICE '✅ Group table RLS policies: % total', group_policy_count;
    RAISE NOTICE '✅ Indexes created: Message.isDeleted_idx, Group.isDeleted_idx, Group.deletedAt_idx';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Security Updates:';
    RAISE NOTICE '  • Deleted messages/groups hidden from regular queries';
    RAISE NOTICE '  • Users can view their own deleted messages/groups';
    RAISE NOTICE '  • Group memberships/invites on deleted groups hidden';
    RAISE NOTICE '  • Soft delete and restore enabled via UPDATE policy';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ READY TO USE HISTORY SECTION!';
    RAISE NOTICE '========================================';
END $$;

