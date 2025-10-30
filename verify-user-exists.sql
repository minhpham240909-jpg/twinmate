-- Verification Script: Check if "Gia Khang Pham" exists in database
-- Run this in Supabase SQL Editor

-- ============================================================================
-- TEST 1: Check if user exists with any variation of the name
-- ============================================================================

SELECT 
    id,
    name,
    email,
    "emailVerified",
    role,
    "createdAt"
FROM "User"
WHERE 
    name ILIKE '%Gia%'
    OR name ILIKE '%Khang%'
    OR name ILIKE '%Pham%'
    OR name ILIKE '%Phạm%' -- With Vietnamese diacritic
ORDER BY "createdAt" DESC;

-- Expected: At least 1 row with a name containing "Gia", "Khang", or "Pham"


-- ============================================================================
-- TEST 2: List all users to see what names exist
-- ============================================================================

SELECT 
    id,
    name,
    email,
    role,
    "createdAt"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 20;

-- Use this to see all recent users and verify the exact spelling


-- ============================================================================
-- TEST 3: Check if user has a Profile (required for AI to show full info)
-- ============================================================================

SELECT 
    u.id,
    u.name,
    u.email,
    p.id as profile_id,
    p.subjects,
    p.interests,
    p.goals,
    p."studyStyle"
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE 
    u.name ILIKE '%Gia%'
    OR u.name ILIKE '%Khang%'
    OR u.name ILIKE '%Pham%';

-- Expected: User should have a corresponding Profile record


-- ============================================================================
-- TEST 4: Search exactly like the AI agent does (improved version)
-- ============================================================================

-- Search for "Gia Khang" using the new OR logic
SELECT 
    id,
    name,
    email
FROM "User"
WHERE 
    (name ILIKE '%Gia%' OR email ILIKE '%Gia%')
    OR (name ILIKE '%Khang%' OR email ILIKE '%Khang%');

-- This mimics the new searchUsers tool behavior


-- ============================================================================
-- TEST 5: If user doesn't exist, create a test user (OPTIONAL)
-- ============================================================================

-- ONLY RUN THIS if Tests 1-2 show the user doesn't exist
-- This creates a test user so you can test the search functionality

/*
-- Create user (uncomment to run)
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
) RETURNING id, name, email;

-- Note: Save the returned 'id' to create a Profile in the next step
*/

-- ============================================================================
-- TEST 6: Create Profile for the test user (OPTIONAL)
-- ============================================================================

-- ONLY RUN THIS after Test 5 if you created a test user
-- Replace 'USER_ID_HERE' with the actual ID from Test 5

/*
-- Create profile (uncomment to run)
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
    'USER_ID_HERE', -- Replace with actual user ID from Test 5
    ARRAY['Computer Science', 'Mathematics', 'Physics'],
    ARRAY['Gaming', 'Coding', 'AI'],
    ARRAY['Improve programming skills', 'Learn machine learning'],
    'VISUAL',
    'INTERMEDIATE',
    'OFFLINE',
    NOW(),
    NOW()
);
*/


-- ============================================================================
-- TEST 7: Verify the complete search (after potential user creation)
-- ============================================================================

SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    p.subjects,
    p.interests,
    p.goals,
    p."studyStyle",
    p."skillLevel",
    p."onlineStatus"
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE 
    u.name ILIKE '%Gia%'
    OR u.name ILIKE '%Khang%'
    OR u.name ILIKE '%Pham%'
ORDER BY u."createdAt" DESC;

-- Expected: Should show user with complete profile data


-- ============================================================================
-- TROUBLESHOOTING QUERIES
-- ============================================================================

-- If you're getting "permission denied" errors, check RLS policies:

-- Check if RLS is enabled on User table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'User';

-- List all policies on User table
SELECT * FROM pg_policies WHERE tablename = 'User';

-- If you need to temporarily disable RLS for testing (NOT recommended for production):
-- ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS:
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- EXPECTED RESULTS SUMMARY
-- ============================================================================

/*
TEST 1: Should return at least 1 user with name containing "Gia", "Khang", or "Pham"
TEST 2: Shows all recent users (helps verify exact spelling)
TEST 3: Shows user WITH profile data (hasProfile should be true)
TEST 4: Demonstrates the new search logic working
TEST 5 & 6: Only if user doesn't exist - creates test user
TEST 7: Final verification with complete data

If all tests pass, the AI agent WILL be able to find the user!
*/

