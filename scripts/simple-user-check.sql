-- ============================================================================
-- SIMPLE USER SEARCH DIAGNOSTIC
-- Run each query ONE AT A TIME in Supabase SQL Editor
-- ============================================================================

-- QUERY 1: Does user "Gia Khang Pham" exist?
-- Copy and run this first:

SELECT 
    id,
    name,
    email,
    role,
    "createdAt"
FROM "User"
WHERE name ILIKE '%Gia%' 
  AND name ILIKE '%Khang%';

-- Expected: Should show at least 1 row
-- If NO ROWS: User doesn't exist in database


-- ============================================================================
-- QUERY 2: Does this user have a Profile?
-- Copy and run this second:

SELECT 
    u.id as user_id,
    u.name,
    u.email,
    p.id as profile_id,
    p.subjects,
    p.interests,
    p.bio,
    p."studyStyle",
    p."skillLevel"
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE u.name ILIKE '%Gia%' 
  AND u.name ILIKE '%Khang%';

-- Expected: Should show profile_id (not NULL)
-- If profile_id is NULL: User has NO PROFILE - THIS IS THE ISSUE!


-- ============================================================================
-- QUERY 3: Test multi-term search (how AI searches)
-- Copy and run this third:

SELECT 
    id,
    name,
    email
FROM "User"
WHERE 
    (name ILIKE '%Gia%' OR email ILIKE '%Gia%')
    OR (name ILIKE '%Khang%' OR email ILIKE '%Khang%')
    OR (name ILIKE '%Pham%' OR email ILIKE '%Pham%');

-- Expected: Should find users matching ANY of these terms


-- ============================================================================
-- QUERY 4: Check ALL users (to see what names exist)
-- Copy and run this fourth:

SELECT 
    id,
    name,
    email,
    "createdAt"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 20;

-- This shows you all recent users - check the exact spelling


-- ============================================================================
-- QUERY 5: Check RLS status
-- Copy and run this fifth:

SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Profile');

-- Expected: Both should show rls_enabled = true


-- ============================================================================
-- FIX: If Query 2 shows profile_id is NULL, run this to create Profile:

/*
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
)
SELECT 
    gen_random_uuid()::text,
    u.id,
    ARRAY['Math', 'Computer Science']::text[],
    ARRAY['Learning', 'Technology']::text[],
    ARRAY['Improve skills']::text[],
    'VISUAL',
    'INTERMEDIATE',
    'OFFLINE',
    NOW(),
    NOW()
FROM "User" u
WHERE u.name ILIKE '%Gia%' 
  AND u.name ILIKE '%Khang%'
  AND NOT EXISTS (
      SELECT 1 FROM "Profile" WHERE "userId" = u.id
  );
*/

-- Remove the /* */ comments to run the fix


-- ============================================================================
-- RESULTS GUIDE:
-- ============================================================================

/*
QUERY 1 - NO ROWS:
  → User doesn't exist. Create user first.

QUERY 2 - profile_id is NULL:
  → User exists but NO PROFILE. Run the FIX query above.

QUERY 2 - profile_id shows a UUID:
  → ✅ User has profile. Issue is elsewhere.

QUERY 3 - NO ROWS:
  → Multi-term search broken. Check table structure.

QUERY 5 - rls_enabled = false:
  → RLS disabled. Should be OK.

QUERY 5 - rls_enabled = true:
  → Check if service_role policy exists.
*/

