-- Verify RLS is enabled on all critical tables
-- Run this in Supabase SQL Editor to check RLS status

-- ==========================================
-- CHECK RLS STATUS ON ALL TABLES
-- ==========================================

SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✓ Protected'
    ELSE '✗ VULNERABLE'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'User', 'Profile', 'Message', 'Match', 'Notification', 
  'StudySession', 'SessionMessage', 'Post', 'PostComment', 
  'PostLike', 'PostRepost', 'Group', 'GroupMember', 'GroupInvite',
  'LearningProfile', 'ConversationArchive', 'Session', 'UserBadge',
  'Badge', 'SessionParticipant', 'SessionGoal', 'SessionGoalUpdate'
)
ORDER BY tablename;

-- ==========================================
-- LIST ALL RLS POLICIES
-- ==========================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==========================================
-- TEST RLS ENFORCEMENT (CRITICAL TEST)
-- ==========================================

-- Test 1: Try to access User table as anonymous (should fail)
-- Run these in separate transactions to test properly
BEGIN;
SET ROLE anon;
SELECT COUNT(*) as should_be_zero FROM "User";
ROLLBACK;

-- Test 2: Try to access Profile table as anonymous (should fail)
BEGIN;
SET ROLE anon;
SELECT COUNT(*) as should_be_zero FROM "Profile";
ROLLBACK;

-- Test 3: Verify service_role can access (should succeed)
BEGIN;
SET ROLE service_role;
SELECT COUNT(*) as should_have_data FROM "User";
ROLLBACK;

-- ==========================================
-- CHECK FOR MISSING POLICIES
-- ==========================================

-- Find tables with RLS enabled but no policies (will block ALL access)
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename, t.rowsecurity
HAVING COUNT(p.policyname) = 0
ORDER BY t.tablename;

-- ==========================================
-- PERFORMANCE CHECK: INDEX USAGE ON RLS
-- ==========================================

-- Check if RLS policies can use indexes efficiently
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Profile', 'Message', 'StudySession')
ORDER BY tablename, indexname;

-- ==========================================
-- SECURITY AUDIT SUMMARY
-- ==========================================

-- Count tables by RLS status
SELECT 
  CASE WHEN rowsecurity THEN 'Protected' ELSE 'Vulnerable' END as security_status,
  COUNT(*) as table_count,
  array_agg(tablename ORDER BY tablename) as tables
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE '_prisma%'
GROUP BY rowsecurity
ORDER BY rowsecurity DESC;

