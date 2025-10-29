-- FIXED: Using correct snake_case column names
-- Run this in Supabase Dashboard → SQL Editor

-- Test 1: How many users exist?
SELECT COUNT(*) as total_users FROM "Profile";

-- Test 2: List ALL users (see what names exist)
SELECT
  user_id,
  first_name,
  last_name,
  email,
  subjects,
  created_at
FROM "Profile"
ORDER BY created_at DESC
LIMIT 10;

-- Test 3: Search for "Gia Khang" (exact match)
SELECT
  first_name,
  last_name,
  email,
  subjects,
  interests
FROM "Profile"
WHERE
  first_name ILIKE '%Gia%'
  OR first_name ILIKE '%Khang%'
  OR last_name ILIKE '%Gia%'
  OR last_name ILIKE '%Khang%'
  OR last_name ILIKE '%Phạm%'
  OR last_name ILIKE '%Pham%';

-- Test 4: Create a test user if none exist
-- ONLY RUN THIS if Test 1 shows 0 users
/*
INSERT INTO "Profile" (
  user_id,
  first_name,
  last_name,
  email,
  subjects,
  interests,
  study_style,
  created_at,
  updated_at
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
  first_name,
  last_name,
  email,
  subjects
FROM "Profile"
WHERE first_name ILIKE '%Gia%';
