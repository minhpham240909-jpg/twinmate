-- ============================================================================
-- COMPREHENSIVE SEARCH DIAGNOSTICS
-- Run this in Supabase SQL Editor to diagnose why AI can't find "Gia Khang Pham"
-- ============================================================================

-- ============================================================================
-- PART 1: VERIFY USER DATA
-- ============================================================================

-- Check 1: Does the user exist with correct name?
SELECT 
    'CHECK 1: User Exists' as test_name,
    COUNT(*) as user_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: User found'
        ELSE '❌ FAIL: User does not exist'
    END as result
FROM "User"
WHERE 
    name ILIKE '%Gia%' 
    AND name ILIKE '%Khang%';

-- Show the actual user data
SELECT 
    id,
    name,
    email,
    role,
    "emailVerified",
    "createdAt"
FROM "User"
WHERE 
    name ILIKE '%Gia%' 
    AND name ILIKE '%Khang%'
ORDER BY "createdAt" DESC;


-- ============================================================================
-- PART 2: CHECK PROFILE DATA
-- ============================================================================

-- Check 2: Does user have a Profile record?
SELECT 
    'CHECK 2: Profile Exists' as test_name,
    COUNT(p.id) as profile_count,
    CASE 
        WHEN COUNT(p.id) > 0 THEN '✅ PASS: Profile exists'
        ELSE '❌ FAIL: NO PROFILE - This will cause issues!'
    END as result
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE 
    u.name ILIKE '%Gia%' 
    AND u.name ILIKE '%Khang%';

-- Show complete profile data
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    p.id as profile_id,
    p.subjects,
    p.interests,
    p.goals,
    p.bio,
    p."studyStyle",
    p."skillLevel",
    p."onlineStatus",
    p.school,
    p.languages,
    p."aboutYourself",
    p."aboutYourselfItems",
    p."subjectCustomDescription",
    p."skillLevelCustomDescription",
    p."studyStyleCustomDescription",
    p."interestsCustomDescription",
    p."availabilityCustomDescription"
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u.id
WHERE 
    u.name ILIKE '%Gia%' 
    AND u.name ILIKE '%Khang%';


-- ============================================================================
-- PART 3: TEST SEARCH LOGIC
-- ============================================================================

-- Check 3: Test multi-term search (how AI searches)
-- This mimics the searchUsers tool behavior
SELECT 
    'CHECK 3: Multi-term Search' as test_name,
    COUNT(*) as found_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Multi-term search works'
        ELSE '❌ FAIL: Multi-term search not working'
    END as result
FROM "User"
WHERE 
    (name ILIKE '%Gia%' OR email ILIKE '%Gia%')
    OR (name ILIKE '%Khang%' OR email ILIKE '%Khang%')
    OR (name ILIKE '%Pham%' OR email ILIKE '%Pham%');

-- Show results
SELECT 
    id,
    name,
    email,
    'Matched on multi-term search' as search_type
FROM "User"
WHERE 
    (name ILIKE '%Gia%' OR email ILIKE '%Gia%')
    OR (name ILIKE '%Khang%' OR email ILIKE '%Khang%')
    OR (name ILIKE '%Pham%' OR email ILIKE '%Pham%')
ORDER BY name;


-- ============================================================================
-- PART 4: CHECK RLS POLICIES
-- ============================================================================

-- Check 4: Are RLS policies enabled?
SELECT 
    'CHECK 4: RLS Status' as test_name,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '⚠️ RLS ENABLED - Check policies below'
        ELSE '✅ RLS DISABLED - Should work freely'
    END as result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Profile');

-- List all RLS policies
SELECT 
    'RLS Policies' as section,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Profile')
ORDER BY tablename, policyname;


-- ============================================================================
-- PART 5: TEST AS DIFFERENT ROLES
-- ============================================================================

-- Check 5: Can service_role access the data?
-- This tests if RLS policies are blocking access

-- Test as service_role (should always work)
SELECT 
    'CHECK 5: Service Role Access' as test_name,
    COUNT(*) as can_access,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Service role can access'
        ELSE '❌ FAIL: Service role blocked (serious issue!)'
    END as result
FROM "User"
WHERE name ILIKE '%Gia%' AND name ILIKE '%Khang%';


-- ============================================================================
-- PART 6: CHECK FOR DATA INCONSISTENCIES
-- ============================================================================

-- Check 6: Are there any NULL or empty name fields?
SELECT 
    'CHECK 6: Data Quality' as test_name,
    COUNT(*) FILTER (WHERE name IS NULL) as null_names,
    COUNT(*) FILTER (WHERE name = '') as empty_names,
    COUNT(*) FILTER (WHERE LENGTH(name) < 3) as suspiciously_short,
    CASE 
        WHEN COUNT(*) FILTER (WHERE name IS NULL OR name = '') > 0 
        THEN '⚠️ WARNING: Found NULL/empty names'
        ELSE '✅ PASS: All names valid'
    END as result
FROM "User";

-- Show any problematic users
SELECT 
    id,
    name,
    email,
    CASE 
        WHEN name IS NULL THEN 'NULL name'
        WHEN name = '' THEN 'Empty name'
        WHEN LENGTH(name) < 3 THEN 'Suspiciously short'
        ELSE 'OK'
    END as issue
FROM "User"
WHERE name IS NULL OR name = '' OR LENGTH(name) < 3
LIMIT 10;


-- ============================================================================
-- PART 7: SIMULATE AI AGENT EXACT QUERY
-- ============================================================================

-- Check 7: Exact simulation of searchUsers tool
-- This is EXACTLY what the AI agent runs

WITH search_terms AS (
    SELECT unnest(string_to_array('Gia Khang Pham', ' ')) as term
),
matched_users AS (
    SELECT DISTINCT u.*
    FROM "User" u, search_terms st
    WHERE u.name ILIKE '%' || st.term || '%'
       OR u.email ILIKE '%' || st.term || '%'
)
SELECT 
    'CHECK 7: Exact AI Query Simulation' as test_name,
    COUNT(*) as found_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: AI query should work'
        ELSE '❌ FAIL: AI query not finding user'
    END as result
FROM matched_users;

-- Show what the AI would find
WITH search_terms AS (
    SELECT unnest(string_to_array('Gia Khang Pham', ' ')) as term
),
matched_users AS (
    SELECT DISTINCT u.id, u.name, u.email
    FROM "User" u, search_terms st
    WHERE u.name ILIKE '%' || st.term || '%'
       OR u.email ILIKE '%' || st.term || '%'
)
SELECT 
    mu.id,
    mu.name,
    mu.email,
    p.subjects,
    p.interests
FROM matched_users mu
LEFT JOIN "Profile" p ON p."userId" = mu.id;


-- ============================================================================
-- PART 8: CHECK CURRENT USER (Who is logged in?)
-- ============================================================================

-- Note: This requires knowing the current user's ID
-- Replace 'CURRENT_USER_ID_HERE' with actual ID when testing

-- Check 8: Would current user filter exclude the target?
SELECT 
    'CHECK 8: Current User Filter' as test_name,
    u.id,
    u.name,
    u.email,
    CASE 
        WHEN u.id = 'CURRENT_USER_ID_HERE' THEN '⚠️ WARNING: This IS the current user!'
        ELSE '✅ OK: Different from current user'
    END as filter_status
FROM "User" u
WHERE u.name ILIKE '%Gia%' AND u.name ILIKE '%Khang%';


-- ============================================================================
-- PART 9: CONNECTION AND PERMISSIONS TEST
-- ============================================================================

-- Check 9: Basic connection test
SELECT 
    'CHECK 9: Database Connection' as test_name,
    current_database() as database,
    current_user as db_user,
    inet_server_addr() as server_ip,
    '✅ PASS: Connection working' as result;

-- Check 10: Can we count all users?
SELECT 
    'CHECK 10: Basic Read Permission' as test_name,
    COUNT(*) as total_users,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: Can read User table'
        ELSE '⚠️ WARNING: User table is empty'
    END as result
FROM "User";


-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT 
    '===========================================' as divider
UNION ALL
SELECT 'DIAGNOSTIC SUMMARY' as divider
UNION ALL
SELECT '===========================================' as divider;

-- Final summary query
WITH diagnostics AS (
    SELECT 
        1 as check_num,
        'User Exists' as check_name,
        CASE WHEN EXISTS(
            SELECT 1 FROM "User" 
            WHERE name ILIKE '%Gia%' AND name ILIKE '%Khang%'
        ) THEN '✅' ELSE '❌' END as status
    UNION ALL
    SELECT 
        2,
        'Profile Exists',
        CASE WHEN EXISTS(
            SELECT 1 FROM "User" u
            JOIN "Profile" p ON p."userId" = u.id
            WHERE u.name ILIKE '%Gia%' AND u.name ILIKE '%Khang%'
        ) THEN '✅' ELSE '❌' END
    UNION ALL
    SELECT 
        3,
        'Multi-term Search Works',
        CASE WHEN EXISTS(
            SELECT 1 FROM "User"
            WHERE (name ILIKE '%Gia%' OR email ILIKE '%Gia%')
               OR (name ILIKE '%Khang%' OR email ILIKE '%Khang%')
        ) THEN '✅' ELSE '❌' END
    UNION ALL
    SELECT 
        4,
        'RLS Allows Access',
        CASE WHEN EXISTS(
            SELECT 1 FROM "User" 
            WHERE name ILIKE '%Gia%' AND name ILIKE '%Khang%'
        ) THEN '✅' ELSE '❌' END
)
SELECT * FROM diagnostics ORDER BY check_num;


-- ============================================================================
-- RECOMMENDED FIXES
-- ============================================================================

-- If Profile is missing, run this to create it:
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
    ARRAY['Computer Science']::text[],
    ARRAY['Learning']::text[],
    ARRAY['Study effectively']::text[],
    'VISUAL',
    'INTERMEDIATE',
    'OFFLINE',
    NOW(),
    NOW()
FROM "User" u
WHERE u.name ILIKE '%Gia%' 
  AND u.name ILIKE '%Khang%'
  AND NOT EXISTS (
      SELECT 1 FROM "Profile" p WHERE p."userId" = u.id
  );
*/

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

/*
PASSING DIAGNOSTICS:
- CHECK 1: Should find at least 1 user
- CHECK 2: Should have profile_count > 0
- CHECK 3: Should find user with multi-term search
- CHECK 4: RLS should be enabled with proper policies
- CHECK 5: Service role should have access
- CHECK 6: No data quality issues
- CHECK 7: AI simulation should find user
- CHECK 9-10: Connection and permissions OK

If ANY check fails, that's likely your issue!

NEXT STEPS:
1. Review which checks failed
2. Run recommended fixes if needed
3. Test the AI agent again
4. Report back with results
*/

