-- ============================================
-- CREATE TEST USERS FOR CLERVA
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- This will create 5 test users including "Gia Khang Phạm"

-- USER 1: Gia Khang Phạm (Computer Science student)
DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Insert User
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Gia Khang Phạm',
    'giakhang.pham@example.com',
    '$2a$10$dummyHashForTestingOnly1234567890',  -- Dummy password hash
    true,
    'FREE',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  -- Insert Profile
  INSERT INTO "Profile" (
    id, "userId", bio, subjects, interests, goals,
    "studyStyle", "skillLevel", "onlineStatus",
    "isLookingForPartner", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Computer Science student passionate about AI and machine learning. Love coding and gaming!',
    ARRAY['Computer Science', 'Mathematics', 'Physics', 'Python Programming'],
    ARRAY['Artificial Intelligence', 'Machine Learning', 'Gaming', 'Coding'],
    ARRAY['Master algorithms', 'Build AI projects', 'Contribute to open source'],
    'VISUAL',
    'INTERMEDIATE',
    'ONLINE',
    true,
    NOW(),
    NOW()
  );
END $$;

-- USER 2: Sarah Johnson (Biology major)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Sarah Johnson',
    'sarah.johnson@example.com',
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
    "isLookingForPartner", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Biology major interested in genetics and research. Looking for study partners!',
    ARRAY['Biology', 'Chemistry', 'Genetics', 'Research Methods'],
    ARRAY['Science', 'Research', 'Nature', 'Reading'],
    ARRAY['Get into med school', 'Research internship', 'Publish paper'],
    'READING_WRITING',
    'ADVANCED',
    'ONLINE',
    true,
    NOW(),
    NOW()
  );
END $$;

-- USER 3: Alex Chen (Math wizard)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Alex Chen',
    'alex.chen@example.com',
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
    "isLookingForPartner", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Mathematics enthusiast. Love solving complex problems and helping others learn.',
    ARRAY['Mathematics', 'Calculus', 'Linear Algebra', 'Statistics'],
    ARRAY['Problem Solving', 'Tutoring', 'Chess', 'Math Competitions'],
    ARRAY['Prepare for math olympiad', 'Help peers understand math', 'Perfect SAT math'],
    'COLLABORATIVE',
    'EXPERT',
    'ONLINE',
    true,
    NOW(),
    NOW()
  );
END $$;

-- USER 4: Emily Rodriguez (Language learner)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Emily Rodriguez',
    'emily.rodriguez@example.com',
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
    "isLookingForPartner", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Learning Spanish and French. Love languages, travel, and cultural exchange!',
    ARRAY['Spanish', 'French', 'Literature', 'World History'],
    ARRAY['Languages', 'Travel', 'Culture', 'Music'],
    ARRAY['Become fluent in Spanish', 'Study abroad', 'Make international friends'],
    'AUDITORY',
    'INTERMEDIATE',
    'OFFLINE',
    true,
    NOW(),
    NOW()
  );
END $$;

-- USER 5: Michael Kim (Physics & Engineering)
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO "User" (id, name, email, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'Michael Kim',
    'michael.kim@example.com',
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
    "isLookingForPartner", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    user_id,
    'Engineering student passionate about robotics and physics. Building things is my jam!',
    ARRAY['Physics', 'Engineering', 'Robotics', 'Electronics'],
    ARRAY['Robotics', 'Building', 'Innovation', 'STEM'],
    ARRAY['Build a robot', 'Win hackathon', 'Engineering internship'],
    'KINESTHETIC',
    'ADVANCED',
    'BUSY',
    false,
    NOW(),
    NOW()
  );
END $$;

-- ============================================
-- VERIFY USERS WERE CREATED
-- ============================================

SELECT
  u.name,
  u.email,
  u.role,
  p.subjects,
  p.interests,
  p."onlineStatus"
FROM "User" u
LEFT JOIN "Profile" p ON u.id = p."userId"
ORDER BY u."createdAt" DESC;

-- You should see 5 users now!
