-- Quick Test: Check if Profile table has users
-- Run this in Supabase Dashboard → SQL Editor

-- Test 1: How many users exist?
SELECT COUNT(*) as total_users FROM "Profile";

-- Test 2: List ALL users (see what names exist)
SELECT
  "userId",
  "firstName",
  "lastName",
  email,
  subjects,
  "createdAt"
FROM "Profile"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Test 3: Search for "Gia Khang" (exact match)
SELECT
  "firstName",
  "lastName",
  email,
  subjects,
  interests
FROM "Profile"
WHERE
  "firstName" ILIKE '%Gia%'
  OR "firstName" ILIKE '%Khang%'
  OR "lastName" ILIKE '%Gia%'
  OR "lastName" ILIKE '%Khang%'
  OR "lastName" ILIKE '%Phạm%'
  OR "lastName" ILIKE '%Pham%';

-- Test 4: Create a test user if none exist
-- ONLY RUN THIS if Test 1 shows 0 users
/*
INSERT INTO "Profile" (
  "userId",
  "firstName",
  "lastName",
  email,
  subjects,
  interests,
  "studyStyle",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Gia Khang',
  'Phạm',
  'giakhang.pham@example.com',
  ARRAY['Computer Science', 'Mathematics', 'Physics'],
  ARRAY['Gaming', 'Coding', 'AI'],
  'Visual',
  NOW(),
  NOW()
);
*/

-- Test 5: After creating user, verify it exists
SELECT
  "firstName",
  "lastName",
  email,
  subjects
FROM "Profile"
WHERE "firstName" ILIKE '%Gia%';
