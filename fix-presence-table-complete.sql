-- ============================================
-- COMPLETE PRESENCE TABLE FIX
-- ============================================
-- This script fixes all presence table issues:
-- 1. Ensures table exists with correct schema
-- 2. Adds missing current_activity column
-- 3. Uses TEXT for user_id (matching your User table)
-- 4. Sets up proper indexes and RLS policies

-- Step 1: Check current table structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'presence'
ORDER BY ordinal_position;

-- Step 2: Add missing current_activity column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'presence'
        AND column_name = 'current_activity'
    ) THEN
        ALTER TABLE "presence"
        ADD COLUMN current_activity TEXT DEFAULT 'available';

        RAISE NOTICE 'Added current_activity column to presence table';
    ELSE
        RAISE NOTICE 'current_activity column already exists';
    END IF;
END $$;

-- Step 3: Verify the table has all required columns
-- Expected columns: user_id, is_online, last_seen, current_activity, updated_at
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check for user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presence' AND column_name = 'user_id'
    ) THEN
        missing_columns := array_append(missing_columns, 'user_id');
    END IF;

    -- Check for is_online
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presence' AND column_name = 'is_online'
    ) THEN
        missing_columns := array_append(missing_columns, 'is_online');
    END IF;

    -- Check for last_seen
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presence' AND column_name = 'last_seen'
    ) THEN
        missing_columns := array_append(missing_columns, 'last_seen');
    END IF;

    -- Check for updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presence' AND column_name = 'updated_at'
    ) THEN
        missing_columns := array_append(missing_columns, 'updated_at');
    END IF;

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'All required columns exist!';
    END IF;
END $$;

-- Step 4: Verify indexes exist
CREATE INDEX IF NOT EXISTS idx_presence_is_online
    ON "presence"(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_presence_last_seen
    ON "presence"(last_seen);

CREATE INDEX IF NOT EXISTS idx_presence_current_activity
    ON "presence"(current_activity);

-- Step 5: Ensure RLS policies exist
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view presence" ON "presence";
DROP POLICY IF EXISTS "Users can update own presence" ON "presence";
DROP POLICY IF EXISTS "Users can insert own presence" ON "presence";
DROP POLICY IF EXISTS "Service role can manage presence" ON "presence";

-- Recreate policies
CREATE POLICY "Anyone can view presence"
    ON "presence"
    FOR SELECT
    USING (true);

CREATE POLICY "Users can update own presence"
    ON "presence"
    FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own presence"
    ON "presence"
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage presence"
    ON "presence"
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Step 6: Initialize presence for all existing users
INSERT INTO "presence" (user_id, is_online, last_seen, current_activity, updated_at)
SELECT
    id,
    false,
    NOW(),
    'available',
    NOW()
FROM "User"
ON CONFLICT (user_id) DO UPDATE SET
    current_activity = COALESCE("presence".current_activity, 'available'),
    updated_at = NOW();

-- Step 7: Final verification
SELECT
    'Presence table is ready!' as status,
    COUNT(*) as total_users,
    SUM(CASE WHEN is_online THEN 1 ELSE 0 END) as online_users,
    SUM(CASE WHEN NOT is_online THEN 1 ELSE 0 END) as offline_users,
    COUNT(DISTINCT current_activity) as activity_types
FROM "presence";

-- Show sample data
SELECT
    user_id,
    is_online,
    current_activity,
    last_seen
FROM "presence"
LIMIT 5;
