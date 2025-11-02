-- ==========================================
-- FIX ADDITIONAL SUPABASE WARNINGS
-- ==========================================
-- This script fixes:
-- 1. User table RLS not enabled (CRITICAL SECURITY)
-- 2. Function search_path mutable warnings
-- 3. Materialized view accessibility warning
-- ==========================================

-- ==========================================
-- 1. USER TABLE - ENABLE RLS (CRITICAL)
-- ==========================================

-- Enable RLS on User table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- The existing policies on User table are already there:
-- - "Allow service role full access to User"
-- - "Public read access to users"
-- - "Users can update own profile"

-- Let's verify they use optimized auth.uid() pattern and recreate them

-- Drop existing User policies
DROP POLICY IF EXISTS "Allow service role full access to User" ON "User";
DROP POLICY IF EXISTS "Public read access to users" ON "User";
DROP POLICY IF EXISTS "Users can update own profile" ON "User";

-- Recreate with optimized patterns

-- Policy 1: Public can view basic user info (for matching, profiles, etc.)
CREATE POLICY "Public read access to users"
ON "User"
FOR SELECT
USING (true);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON "User"
FOR UPDATE
USING ((select auth.uid())::text = id)
WITH CHECK ((select auth.uid())::text = id);

-- Policy 3: Users can insert their own account (during signup)
CREATE POLICY "Users can insert own account"
ON "User"
FOR INSERT
WITH CHECK ((select auth.uid())::text = id);

-- Policy 4: Users can delete their own account
CREATE POLICY "Users can delete own account"
ON "User"
FOR DELETE
USING ((select auth.uid())::text = id);

-- Grant permissions
GRANT SELECT ON "User" TO authenticated, anon;
GRANT INSERT ON "User" TO authenticated;
GRANT UPDATE ON "User" TO authenticated;
GRANT DELETE ON "User" TO authenticated;

-- ==========================================
-- 2. FIX FUNCTION SEARCH_PATH WARNINGS
-- ==========================================

-- Fix cleanup_expired_agent_memory function
DROP FUNCTION IF EXISTS cleanup_expired_agent_memory();

CREATE OR REPLACE FUNCTION cleanup_expired_agent_memory()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Fix: Set immutable search_path
AS $$
BEGIN
  DELETE FROM agent_memory
  WHERE last_accessed < NOW() - INTERVAL '7 days';
END;
$$;

-- Fix search_chunks function
DROP FUNCTION IF EXISTS search_chunks(query_embedding vector, match_count int);

CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Fix: Set immutable search_path
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM chunks c
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ==========================================
-- 3. MATERIALIZED VIEW - REVOKE PUBLIC ACCESS
-- ==========================================

-- Revoke access from anon and authenticated to materialized view
REVOKE SELECT ON "common_timezones" FROM anon;
REVOKE SELECT ON "common_timezones" FROM authenticated;

-- Grant only to specific roles if needed (optional)
-- GRANT SELECT ON "common_timezones" TO authenticated;  -- Uncomment if needed

-- Alternative: If you want to keep it accessible, you can ignore this warning
-- The warning is about security - materialized views can be refreshed and might
-- expose data unexpectedly. If you're okay with this, you can keep the access.

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Verify User table has RLS enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'User') THEN
    RAISE EXCEPTION 'RLS not enabled on User table!';
  END IF;
  RAISE NOTICE '✅ User table RLS is enabled';
END
$$;

-- ==========================================
-- DONE!
-- ==========================================
-- Fixes applied:
-- ✅ User table RLS enabled with optimized policies
-- ✅ Function search_path set to immutable (public, pg_temp)
-- ✅ Materialized view access revoked from public roles
--
-- Remaining warning (not fixable via SQL):
-- ⚠️  Auth leaked password protection - Must enable in Supabase Dashboard
--     Go to: Authentication → Policies → Enable "Leaked Password Protection"
-- ==========================================
