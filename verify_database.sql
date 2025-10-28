-- =====================================================
-- QUICK DATABASE VERIFICATION
-- =====================================================
-- Run this BEFORE the main script to see what's missing
-- =====================================================

-- Check if LearningProfile table exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'LearningProfile'
    )
    THEN '✅ LearningProfile table EXISTS'
    ELSE '❌ LearningProfile table MISSING (run FIX_ALL_WARNINGS_COMPLETE_V2.sql)'
  END as learning_profile_status;

-- Check if agent_memory table exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'agent_memory'
    )
    THEN '✅ agent_memory table EXISTS'
    ELSE '❌ agent_memory table MISSING'
  END as agent_memory_status;

-- Count current RLS warnings (if any)
SELECT
  COUNT(*) as total_tables_with_rls,
  SUM(CASE WHEN rowsecurity THEN 1 ELSE 0 END) as tables_with_rls_enabled
FROM pg_tables
WHERE schemaname = 'public';

-- Show your current tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
