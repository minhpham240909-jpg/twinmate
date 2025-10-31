-- Check RLS status and policies for User and Profile tables

-- 1. Check if RLS is enabled
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('User', 'Profile');

-- 2. Check all policies on User table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('User', 'Profile')
ORDER BY tablename, policyname;

-- 3. Test if service_role can actually query User table
-- (This will return user count if it works)
SELECT COUNT(*) as user_count FROM "User";

-- 4. Try to fetch a sample user
SELECT id, name, email FROM "User" LIMIT 5;
