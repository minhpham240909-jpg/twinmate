-- Disable Row Level Security (RLS) for Prisma Direct Database Access
-- This is necessary because we're using Prisma to access PostgreSQL directly,
-- bypassing Supabase's API. Supabase enables RLS by default on all tables,
-- which blocks Prisma queries unless we disable it or create policies.
--
-- Since we're handling authorization in our Next.js API routes (server-side),
-- we can safely disable RLS and rely on application-level security.
--
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/zuukijevgtcfsgylbsqj/sql

-- Disable RLS on all application tables
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Match" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Badge" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBadge" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionParticipant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionGoal" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionMessage" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationArchive" DISABLE ROW LEVEL SECURITY;

-- Note: We keep RLS enabled on storage.objects (managed by Supabase Storage)
-- because file uploads go through Supabase Storage API, not Prisma

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT LIKE '_prisma%'
ORDER BY tablename;
