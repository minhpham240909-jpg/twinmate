-- ============================================================================
-- DIAGNOSTIC SCRIPT: Why is the database returning 0 users?
-- Run this in Supabase SQL Editor to find the issue
-- ============================================================================

-- ============================================================================
-- TEST 1: Check if User table exists
-- ============================================================================
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_name = 'User'
) as user_table_exists;

-- Expected: true
-- If false: Table doesn't exist, need to run migrations


-- ============================================================================
-- TEST 2: Count total users in database
-- ============================================================================
SELECT COUNT(*) as total_users FROM "User";

-- Expected: > 0 (should show number of users)
-- If 0: Database is empty, need to create users


-- ============================================================================
-- TEST 3: List ALL users (to see what names exist)
-- ============================================================================
SELECT 
    id,
    name,
    email,
    role,
    "emailVerified",
    "createdAt"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 20;

-- Expected: Should show actual users
-- If empty: Database has no users


-- ============================================================================
-- TEST 4: Check Row Level Security (RLS) status
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'User';

-- If rls_enabled = true: Check policies below
-- If rls_enabled = false: RLS is disabled (good for testing)


-- ============================================================================
-- TEST 5: Check RLS policies on User table
-- ============================================================================
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'User';

-- Expected: Should show policies if RLS is enabled
-- If restrictive policies: They might be blocking access


-- ============================================================================
-- TEST 6: Try to select users WITHOUT RLS (as superuser)
-- ============================================================================
-- This bypasses RLS to see if users actually exist
SET ROLE postgres; -- or your superuser role
SELECT COUNT(*) as user_count_bypass_rls FROM "User";
RESET ROLE;

-- If this shows users but normal query doesn't: RLS is blocking


-- ============================================================================
-- TEST 7: Check authentication status
-- ============================================================================
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    auth.email() as current_email;

-- Expected: Should show current authenticated user
-- If NULL: Not authenticated (might affect RLS policies)


-- ============================================================================
-- TEST 8: Check if Profile table has data
-- ============================================================================
SELECT COUNT(*) as total_profiles FROM "Profile";

SELECT 
    "userId",
    subjects,
    interests,
    "studyStyle",
    "createdAt"
FROM "Profile"
LIMIT 10;

-- Profiles should match users (one profile per user)


-- ============================================================================
-- TEST 9: Check for any recent users
-- ============================================================================
SELECT 
    id,
    name,
    email,
    "createdAt",
    "updatedAt"
FROM "User"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
ORDER BY "createdAt" DESC;

-- Shows users created in last 30 days


-- ============================================================================
-- TEST 10: Search with the exact query the API uses
-- ============================================================================
-- This mimics what the searchUsers tool does

-- Example: Search for any name containing "a" (should find many)
SELECT 
    id,
    name,
    email
FROM "User"
WHERE 
    name ILIKE '%a%' 
    OR email ILIKE '%a%'
LIMIT 10;

-- If this returns results: API might have different issue
-- If this returns nothing: Database is truly empty


-- ============================================================================
-- SOLUTION 1: If database is empty, create test users
-- ============================================================================
-- ONLY RUN THIS if Tests 2-3 show 0 users

/*
-- Create first test user: Gia Khang Pham
DO $$
DECLARE
    user1_id TEXT;
BEGIN
    -- Insert user
    INSERT INTO "User" (
        id,
        email,
        name,
        role,
        "emailVerified",
        "createdAt",
        "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        'giakhang.pham@example.com',
        'Gia Khang Pham',
        'FREE',
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO user1_id;
    
    -- Insert profile for user
    INSERT INTO "Profile" (
        id,
        "userId",
        subjects,
        interests,
        goals,
        "studyStyle",
        "skillLevel",
        "onlineStatus",
        "createdAt",
        "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        user1_id,
        ARRAY['Computer Science', 'Mathematics', 'Physics'],
        ARRAY['Gaming', 'Coding', 'AI'],
        ARRAY['Improve programming skills', 'Learn machine learning'],
        'VISUAL',
        'INTERMEDIATE',
        'OFFLINE',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created user: % with ID: %', 'Gia Khang Pham', user1_id;
END $$;

-- Create second test user: John Smith
DO $$
DECLARE
    user2_id TEXT;
BEGIN
    INSERT INTO "User" (
        id,
        email,
        name,
        role,
        "emailVerified",
        "createdAt",
        "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        'john.smith@example.com',
        'John Smith',
        'FREE',
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO user2_id;
    
    INSERT INTO "Profile" (
        id,
        "userId",
        subjects,
        interests,
        goals,
        "studyStyle",
        "skillLevel",
        "onlineStatus",
        "createdAt",
        "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        user2_id,
        ARRAY['Biology', 'Chemistry'],
        ARRAY['Sports', 'Reading'],
        ARRAY['Prepare for exams'],
        'AUDITORY',
        'BEGINNER',
        'OFFLINE',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created user: % with ID: %', 'John Smith', user2_id;
END $$;

-- Create third test user: Maria Garcia
DO $$
DECLARE
    user3_id TEXT;
BEGIN
    INSERT INTO "User" (
        id,
        email,
        name,
        role,
        "emailVerified",
        "createdAt",
        "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        'maria.garcia@example.com',
        'Maria Garcia',
        'FREE',
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO user3_id;
    
    INSERT INTO "Profile" (
        id,
        "userId",
        subjects,
        interests,
        goals,
        "studyStyle",
        "skillLevel",
        "onlineStatus",
        "createdAt",
        "updatedAt"
    ) VALUES (
        gen_random_uuid()::text,
        user3_id,
        ARRAY['History', 'Literature', 'Art'],
        ARRAY['Music', 'Travel', 'Photography'],
        ARRAY['Learn new languages', 'Cultural studies'],
        'VISUAL',
        'ADVANCED',
        'ONLINE',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created user: % with ID: %', 'Maria Garcia', user3_id;
END $$;

-- Verify users were created
SELECT 
    id,
    name,
    email,
    role,
    "createdAt"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 10;
*/


-- ============================================================================
-- SOLUTION 2: If RLS is blocking, temporarily disable it for testing
-- ============================================================================
-- WARNING: Only do this in development/testing, NOT in production!

/*
-- Disable RLS on User table (for testing only)
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS when done testing
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
*/


-- ============================================================================
-- SOLUTION 3: Add policy to allow reading users
-- ============================================================================
-- If RLS is enabled and blocking reads, add this policy

/*
-- Allow authenticated users to read all users
CREATE POLICY "Allow authenticated users to read all users"
ON "User"
FOR SELECT
TO authenticated
USING (true);

-- Allow anonymous access for testing (remove in production)
CREATE POLICY "Allow public read for testing"
ON "User"
FOR SELECT
TO anon
USING (true);
*/


-- ============================================================================
-- SOLUTION 4: Grant permissions to service role
-- ============================================================================
-- If using service role (bypasses RLS)

/*
GRANT ALL ON "User" TO service_role;
GRANT ALL ON "Profile" TO service_role;
*/


-- ============================================================================
-- VERIFICATION: After applying solutions
-- ============================================================================

-- Should now return users
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN "createdAt" > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_users
FROM "User";

-- Test the search query
SELECT 
    id,
    name,
    email
FROM "User"
WHERE 
    name ILIKE '%Gia%'
    OR name ILIKE '%Khang%'
    OR name ILIKE '%John%'
    OR name ILIKE '%Maria%';


-- ============================================================================
-- RESULTS INTERPRETATION
-- ============================================================================

/*
SCENARIO 1: Tests 2-3 show 0 users
→ Database is empty
→ Solution: Run SOLUTION 1 to create test users

SCENARIO 2: Test 6 shows users, but Test 2 shows 0
→ RLS is blocking access
→ Solution: Run SOLUTION 2 or SOLUTION 3

SCENARIO 3: Test 1 returns false
→ User table doesn't exist
→ Solution: Run database migrations

SCENARIO 4: Tests pass but API still returns 0
→ API is querying wrong database/table
→ Check DATABASE_URL environment variable
*/

