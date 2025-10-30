-- ===============================================
-- TEST 1: Does "Gia Khang Phạm" exist in User table?
-- ===============================================
SELECT
  id,
  name,
  email,
  "createdAt"
FROM "User"
WHERE
  name ILIKE '%Gia%'
  OR name ILIKE '%Khang%'
  OR name ILIKE '%Phạm%'
  OR name ILIKE '%Pham%';

-- Expected: Should show at least one user


-- ===============================================
-- TEST 2: Get Profile data for this user (JOIN)
-- ===============================================
SELECT
  u.id,
  u.name,
  u.email,
  p."userId",
  p.subjects,
  p.interests,
  p.goals,
  p."studyStyle",
  p."skillLevel"
FROM "User" u
LEFT JOIN "Profile" p ON u.id = p."userId"
WHERE
  u.name ILIKE '%Gia%'
  OR u.name ILIKE '%Khang%'
LIMIT 5;

-- Expected: Should show user with their profile data


-- ===============================================
-- TEST 3: How many total users exist?
-- ===============================================
SELECT COUNT(*) as total_users FROM "User";

-- Expected: Should be > 0


-- ===============================================
-- TEST 4: List first 10 users
-- ===============================================
SELECT
  id,
  name,
  email
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Expected: Should show all users in system


-- ===============================================
-- TEST 5: Check if user has a Profile
-- ===============================================
SELECT
  u.id,
  u.name,
  CASE
    WHEN p."userId" IS NOT NULL THEN 'Has Profile'
    ELSE 'No Profile'
  END as profile_status
FROM "User" u
LEFT JOIN "Profile" p ON u.id = p."userId"
WHERE
  u.name ILIKE '%Gia%'
  OR u.name ILIKE '%Khang%';

-- Expected: Should show if user has profile or not
