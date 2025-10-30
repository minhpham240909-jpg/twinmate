-- ============================================
-- Phase 3 Testing: Create Test Data
-- ============================================
-- Creates study sessions, quizzes, flashcards, and study plans
-- for testing AI agent tools

-- NOTE: Run create-test-users-complete.sql FIRST!

-- ============================================
-- 1. Create Test Study Sessions
-- ============================================

-- Get Test Admin user ID
DO $$
DECLARE
  admin_id UUID;
  sarah_id UUID;
  session_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO admin_id FROM "User" WHERE email = 'testadmin@clerva.test';
  SELECT id INTO sarah_id FROM "User" WHERE email = 'sarah.johnson@clerva.test';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Test Admin not found! Run create-test-users-complete.sql first.';
  END IF;

  -- Create study session
  INSERT INTO "StudySession" (
    id, "userId", "creatorId", title, description,
    subject, "startTime", "endTime", status,
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    admin_id,
    admin_id,
    'Python Loops Study Session',
    'Discussed for loops, while loops, and list comprehensions. Covered common pitfalls and best practices.',
    'Computer Science',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour',
    'COMPLETED',
    NOW() - INTERVAL '2 hours',
    NOW()
  )
  RETURNING id INTO session_id;

  -- Add participants
  INSERT INTO "SessionParticipant" ("sessionId", "userId", status, "joinedAt", "leftAt")
  VALUES
    (session_id, admin_id, 'ATTENDED', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
    (session_id, sarah_id, 'ATTENDED', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour');

  RAISE NOTICE 'Created study session: %', session_id;
END $$;

-- ============================================
-- 2. Create Test Quiz
-- ============================================

DO $$
DECLARE
  admin_id UUID;
  quiz_id UUID;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE email = 'testadmin@clerva.test';

  -- Create quiz
  INSERT INTO "Quiz" (
    id, "userId", title, description, subject,
    difficulty, "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    admin_id,
    'JavaScript Basics Quiz',
    'Test your knowledge of JavaScript fundamentals',
    'Computer Science',
    'INTERMEDIATE',
    NOW(),
    NOW()
  )
  RETURNING id INTO quiz_id;

  -- Add questions
  INSERT INTO "QuizQuestion" (
    id, "quizId", question, "correctAnswer", options, explanation,
    points, "orderIndex", "createdAt", "updatedAt"
  )
  VALUES
    (
      gen_random_uuid(),
      quiz_id,
      'What is the output of: console.log(typeof null)?',
      'object',
      ARRAY['object', 'null', 'undefined', 'number'],
      'In JavaScript, typeof null returns "object" due to a historical bug in the language.',
      1,
      1,
      NOW(),
      NOW()
    ),
    (
      gen_random_uuid(),
      quiz_id,
      'Which method adds an element to the end of an array?',
      'push()',
      ARRAY['push()', 'pop()', 'shift()', 'unshift()'],
      'push() adds elements to the end, while unshift() adds to the beginning.',
      1,
      2,
      NOW(),
      NOW()
    ),
    (
      gen_random_uuid(),
      quiz_id,
      'What does === compare in JavaScript?',
      'Value and type',
      ARRAY['Value only', 'Type only', 'Value and type', 'Reference only'],
      'The strict equality operator (===) compares both value and type without type coercion.',
      1,
      3,
      NOW(),
      NOW()
    );

  RAISE NOTICE 'Created quiz with 3 questions: %', quiz_id;
END $$;

-- ============================================
-- 3. Create Test Flashcard Deck
-- ============================================

DO $$
DECLARE
  admin_id UUID;
  deck_id UUID;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE email = 'testadmin@clerva.test';

  -- Create deck
  INSERT INTO "FlashcardDeck" (
    id, "userId", name, description, subject,
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    admin_id,
    'Python Functions',
    'Key concepts about Python functions',
    'Computer Science',
    NOW(),
    NOW()
  )
  RETURNING id INTO deck_id;

  -- Add flashcards
  INSERT INTO "Flashcard" (
    id, "deckId", front, back, "orderIndex",
    "createdAt", "updatedAt"
  )
  VALUES
    (
      gen_random_uuid(),
      deck_id,
      'What is a lambda function in Python?',
      'A small anonymous function defined with the lambda keyword. Example: lambda x: x * 2',
      1,
      NOW(),
      NOW()
    ),
    (
      gen_random_uuid(),
      deck_id,
      'What does *args do in a function?',
      'Allows a function to accept any number of positional arguments as a tuple.',
      2,
      NOW(),
      NOW()
    ),
    (
      gen_random_uuid(),
      deck_id,
      'What does **kwargs do in a function?',
      'Allows a function to accept any number of keyword arguments as a dictionary.',
      3,
      NOW(),
      NOW()
    );

  RAISE NOTICE 'Created flashcard deck with 3 cards: %', deck_id;
END $$;

-- ============================================
-- 4. Create Test Study Plan
-- ============================================

DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE email = 'testadmin@clerva.test';

  INSERT INTO "study_plan" (
    id, "userId", title, description, subject,
    "startDate", "endDate", milestones,
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    admin_id,
    'Learn React in 2 Weeks',
    'Comprehensive plan to learn React fundamentals',
    'Computer Science',
    NOW(),
    NOW() + INTERVAL '14 days',
    jsonb_build_array(
      jsonb_build_object('day', 1, 'topic', 'JSX and Components', 'completed', true),
      jsonb_build_object('day', 3, 'topic', 'Props and State', 'completed', true),
      jsonb_build_object('day', 5, 'topic', 'Hooks (useState, useEffect)', 'completed', false),
      jsonb_build_object('day', 7, 'topic', 'Component Lifecycle', 'completed', false),
      jsonb_build_object('day', 10, 'topic', 'Context API', 'completed', false),
      jsonb_build_object('day', 14, 'topic', 'Build a Project', 'completed', false)
    ),
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Created study plan for React';
END $$;

-- ============================================
-- 5. Create Test Learning Profile
-- ============================================

DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE email = 'testadmin@clerva.test';

  INSERT INTO "LearningProfile" (
    id, "userId", strengths, weaknesses,
    "learningGoals", "studyHabits",
    "updatedAt", "createdAt"
  )
  VALUES (
    gen_random_uuid(),
    admin_id,
    ARRAY['JavaScript', 'React', 'Problem Solving'],
    ARRAY['CSS Styling', 'Testing', 'Algorithms'],
    ARRAY['Master full-stack development', 'Build production apps'],
    jsonb_build_object(
      'preferredTime', 'morning',
      'sessionLength', 60,
      'breaksFrequency', 15
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT ("userId") DO UPDATE
  SET strengths = EXCLUDED.strengths,
      weaknesses = EXCLUDED.weaknesses,
      "updatedAt" = NOW();

  RAISE NOTICE 'Created/Updated learning profile';
END $$;

-- ============================================
-- 6. Create Test Notifications
-- ============================================

DO $$
DECLARE
  admin_id UUID;
  sarah_id UUID;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE email = 'testadmin@clerva.test';
  SELECT id INTO sarah_id FROM "User" WHERE email = 'sarah.johnson@clerva.test';

  -- Notification for Sarah (nudge from admin)
  INSERT INTO "Notification" (
    id, "userId", type, title, message, read,
    "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    sarah_id,
    'nudge',
    'Study Session Reminder',
    'Test Admin is waiting for you to join the Python study session!',
    false,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Created test notification';
END $$;

-- ============================================
-- Verification: Show All Test Data
-- ============================================

-- Show study sessions
SELECT 'Study Sessions' as type, COUNT(*) as count
FROM "StudySession"
WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@clerva.test');

-- Show quizzes
SELECT 'Quizzes' as type, COUNT(*) as count
FROM "Quiz"
WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@clerva.test');

-- Show flashcard decks
SELECT 'Flashcard Decks' as type, COUNT(*) as count
FROM "FlashcardDeck"
WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@clerva.test');

-- Show study plans
SELECT 'Study Plans' as type, COUNT(*) as count
FROM "study_plan"
WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@clerva.test');

-- Show learning profiles
SELECT 'Learning Profiles' as type, COUNT(*) as count
FROM "LearningProfile"
WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@clerva.test');

-- Show notifications
SELECT 'Notifications' as type, COUNT(*) as count
FROM "Notification"
WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@clerva.test');

-- Expected: At least 1 of each type
