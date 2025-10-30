-- ============================================
-- Phase 3 Testing: Create Complete Test Users
-- ============================================
-- This creates 5 test users with profiles, presence, and availability
-- for comprehensive AI agent testing

-- USER 1: Test Admin (You) - Computer Science
DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Create User
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Test Admin',
    'testadmin@clerva.test',
    '$2a$10$dummyHashForTestingOnly1234567890',
    true,
    'PREMIUM',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  -- Create Profile
  INSERT INTO "Profile" (
    id, "userId", bio, subjects, interests, goals,
    "studyStyle", "skillLevel", "onlineStatus",
    "isLookingForPartner", "availableDays", "availableHours",
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Test admin account for AI agent testing',
    ARRAY['Computer Science', 'Artificial Intelligence', 'Machine Learning'],
    ARRAY['AI', 'Testing', 'Automation'],
    ARRAY['Test all AI features', 'Verify functionality'],
    'VISUAL',
    'ADVANCED',
    'ONLINE',
    true,
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    ARRAY['09:00-12:00', '14:00-17:00'],
    NOW(),
    NOW()
  );

  -- Set Online
  INSERT INTO "presence" (user_id, is_online, last_seen)
  VALUES (user_id, true, NOW())
  ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = NOW();

  RAISE NOTICE 'Created Test Admin: %', user_id;
END $$;

-- USER 2: Sarah Johnson - Biology (ONLINE)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Sarah Johnson',
    'sarah.johnson@clerva.test',
    '$2a$10$dummyHashForTestingOnly1234567890',
    true,
    'FREE',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  INSERT INTO "Profile" (
    id, "userId", bio, subjects, interests, goals,
    "studyStyle", "skillLevel", "onlineStatus",
    "isLookingForPartner", "availableDays", "availableHours",
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Biology major interested in genetics and research',
    ARRAY['Biology', 'Chemistry', 'Genetics', 'Computer Science'],
    ARRAY['Science', 'Research', 'Nature', 'Reading'],
    ARRAY['Get into med school', 'Research internship'],
    'READING_WRITING',
    'ADVANCED',
    'ONLINE',
    true,
    ARRAY['Monday', 'Wednesday', 'Friday'],
    ARRAY['10:00-12:00', '14:00-16:00'],
    NOW(),
    NOW()
  );

  -- Set ONLINE for testing "Start Now" feature
  INSERT INTO "presence" (user_id, is_online, last_seen)
  VALUES (user_id, true, NOW())
  ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = NOW();

  RAISE NOTICE 'Created Sarah Johnson (ONLINE): %', user_id;
END $$;

-- USER 3: Alex Chen - Math (ONLINE)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Alex Chen',
    'alex.chen@clerva.test',
    '$2a$10$dummyHashForTestingOnly1234567890',
    true,
    'PREMIUM',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  INSERT INTO "Profile" (
    id, "userId", bio, subjects, interests, goals,
    "studyStyle", "skillLevel", "onlineStatus",
    "isLookingForPartner", "availableDays", "availableHours",
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Mathematics expert and tutor',
    ARRAY['Mathematics', 'Calculus', 'Linear Algebra', 'Computer Science'],
    ARRAY['Problem Solving', 'Tutoring', 'Math Competitions'],
    ARRAY['Prepare for math olympiad', 'Help peers'],
    'COLLABORATIVE',
    'EXPERT',
    'ONLINE',
    true,
    ARRAY['Tuesday', 'Thursday', 'Saturday'],
    ARRAY['15:00-18:00', '19:00-21:00'],
    NOW(),
    NOW()
  );

  -- Set ONLINE
  INSERT INTO "presence" (user_id, is_online, last_seen)
  VALUES (user_id, true, NOW())
  ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = NOW();

  RAISE NOTICE 'Created Alex Chen (ONLINE): %', user_id;
END $$;

-- USER 4: Emily Rodriguez - Languages (OFFLINE)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Emily Rodriguez',
    'emily.rodriguez@clerva.test',
    '$2a$10$dummyHashForTestingOnly1234567890',
    true,
    'FREE',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  INSERT INTO "Profile" (
    id, "userId", bio, subjects, interests, goals,
    "studyStyle", "skillLevel", "onlineStatus",
    "isLookingForPartner", "availableDays", "availableHours",
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Learning Spanish and French',
    ARRAY['Spanish', 'French', 'Literature', 'History'],
    ARRAY['Languages', 'Travel', 'Culture', 'Music'],
    ARRAY['Become fluent in Spanish', 'Study abroad'],
    'AUDITORY',
    'INTERMEDIATE',
    'OFFLINE',
    true,
    ARRAY['Monday', 'Wednesday', 'Friday'],
    ARRAY['16:00-18:00'],
    NOW(),
    NOW()
  );

  -- Set OFFLINE for testing "Schedule Later" feature
  INSERT INTO "presence" (user_id, is_online, last_seen)
  VALUES (user_id, false, NOW() - INTERVAL '2 hours')
  ON CONFLICT (user_id) DO UPDATE SET is_online = false, last_seen = NOW() - INTERVAL '2 hours';

  RAISE NOTICE 'Created Emily Rodriguez (OFFLINE): %', user_id;
END $$;

-- USER 5: Michael Kim - Engineering (BUSY)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Michael Kim',
    'michael.kim@clerva.test',
    '$2a$10$dummyHashForTestingOnly1234567890',
    true,
    'FREE',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  INSERT INTO "Profile" (
    id, "userId", bio, subjects, interests, goals,
    "studyStyle", "skillLevel", "onlineStatus",
    "isLookingForPartner", "availableDays", "availableHours",
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Engineering student passionate about robotics',
    ARRAY['Engineering', 'Physics', 'Robotics', 'Computer Science'],
    ARRAY['Robotics', 'Building', 'Innovation'],
    ARRAY['Build a robot', 'Win hackathon'],
    'KINESTHETIC',
    'ADVANCED',
    'BUSY',
    false,
    ARRAY['Thursday', 'Friday'],
    ARRAY['13:00-15:00'],
    NOW(),
    NOW()
  );

  -- Set BUSY (online but not available)
  INSERT INTO "presence" (user_id, is_online, last_seen)
  VALUES (user_id, true, NOW())
  ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = NOW();

  RAISE NOTICE 'Created Michael Kim (BUSY): %', user_id;
END $$;

-- ============================================
-- Verification: List All Test Users
-- ============================================

SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  p.subjects,
  p."onlineStatus",
  pr.is_online,
  p."availableDays",
  p."availableHours"
FROM "User" u
LEFT JOIN "Profile" p ON u.id = p."userId"
LEFT JOIN "presence" pr ON u.id = pr.user_id
WHERE u.email LIKE '%@clerva.test'
ORDER BY u."createdAt" DESC;

-- Expected: 5 users with complete profiles and presence
