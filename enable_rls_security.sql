-- Enable Row Level Security (RLS) on Critical Tables
-- This adds defense-in-depth security even though we have API-level authentication
--
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/zuukijevgtcfsgylbsqj/sql
--
-- Strategy: Allow access for authenticated users through service_role
-- This protects data if someone bypasses API routes or gets database credentials

-- ==========================================
-- ENABLE RLS ON CRITICAL TABLES
-- ==========================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionMessage" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- CREATE RLS POLICIES
-- ==========================================

-- Allow service_role (our API) to bypass RLS
-- This ensures our Next.js API routes can still access data normally
-- But direct database access from unknown sources will be blocked

-- User table: Allow service_role full access
CREATE POLICY "Allow service role full access to User" ON "User"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Profile table: Allow service_role full access
CREATE POLICY "Allow service role full access to Profile" ON "Profile"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Message table: Allow service_role full access
CREATE POLICY "Allow service role full access to Message" ON "Message"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Match table: Allow service_role full access
CREATE POLICY "Allow service role full access to Match" ON "Match"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Notification table: Allow service_role full access
CREATE POLICY "Allow service role full access to Notification" ON "Notification"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- StudySession table: Allow service_role full access
CREATE POLICY "Allow service role full access to StudySession" ON "StudySession"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- SessionMessage table: Allow service_role full access
CREATE POLICY "Allow service role full access to SessionMessage" ON "SessionMessage"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ==========================================
-- VERIFY RLS IS ENABLED
-- ==========================================

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('User', 'Profile', 'Message', 'Match', 'Notification', 'StudySession', 'SessionMessage')
ORDER BY tablename;

-- ==========================================
-- NOTES
-- ==========================================

-- What this does:
-- 1. Enables RLS on critical tables containing user data
-- 2. Creates policies that only allow access via service_role (our API)
-- 3. Blocks direct database access without proper authentication
-- 4. Maintains compatibility with existing Prisma code
--
-- Security Benefits:
-- - If someone gets the database connection string, they still can't access data
-- - Direct psql access won't work without service_role key
-- - Defense-in-depth: API authentication + RLS
-- - No impact on application functionality (service_role always passes)
--
-- Migration Path:
-- - Run this SQL in Supabase SQL Editor
-- - No code changes needed (Prisma uses service_role connection)
-- - Test that API routes still work normally
-- - RLS protects against unauthorized direct database access
