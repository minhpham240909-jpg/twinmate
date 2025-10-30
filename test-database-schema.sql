-- Check actual Profile table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Profile'
ORDER BY ordinal_position;

-- Check actual User table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'User'
ORDER BY ordinal_position;

-- Test 1: Count users
SELECT COUNT(*) as total_users FROM "User";

-- Test 2: List users with their names
SELECT
  id,
  name,
  email,
  "createdAt"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Test 3: List profiles with user names (JOIN)
SELECT
  p.id as profile_id,
  p."userId",
  u.name,
  u.email,
  p.subjects,
  p.interests
FROM "Profile" p
JOIN "User" u ON p."userId" = u.id
ORDER BY u."createdAt" DESC
LIMIT 10;

-- Test 4: Search for a specific user by name
SELECT
  u.id,
  u.name,
  u.email,
  p.subjects,
  p.interests,
  p."studyStyle"
FROM "User" u
LEFT JOIN "Profile" p ON u.id = p."userId"
WHERE u.name ILIKE '%Gia%' OR u.name ILIKE '%Khang%'
ORDER BY u."createdAt" DESC;
