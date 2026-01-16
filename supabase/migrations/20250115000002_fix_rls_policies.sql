-- Migration: Fix RLS policies for Profile table
-- Date: 2025-01-15
-- Description: Fixes auth_rls_initplan and multiple_permissive_policies warnings
--
-- This migration:
-- 1. Drops ALL existing Profile policies (old and new naming conventions)
-- 2. Recreates policies using (select auth.uid()) for performance optimization
-- 3. Eliminates duplicate/conflicting permissive policies

-- ============================================================================
-- 1. DROP ALL EXISTING PROFILE POLICIES
-- ============================================================================

-- Drop old naming convention policies (from previous migrations)
DROP POLICY IF EXISTS "Users can view profiles" ON "Profile";
DROP POLICY IF EXISTS "Users can view own profile" ON "Profile";
DROP POLICY IF EXISTS "Users can create own profile" ON "Profile";
DROP POLICY IF EXISTS "Users can update own profile" ON "Profile";
DROP POLICY IF EXISTS "Users can delete own profile" ON "Profile";
DROP POLICY IF EXISTS "Admins can delete profiles" ON "Profile";
DROP POLICY IF EXISTS "Service role can manage profiles" ON "Profile";
DROP POLICY IF EXISTS "Enable read access for own profile" ON "Profile";
DROP POLICY IF EXISTS "Enable insert for own profile" ON "Profile";
DROP POLICY IF EXISTS "Enable update for own profile" ON "Profile";
DROP POLICY IF EXISTS "Enable delete for own profile" ON "Profile";

-- Drop new naming convention policies (from recent migration)
DROP POLICY IF EXISTS "profile_select_own" ON "Profile";
DROP POLICY IF EXISTS "profile_insert_own" ON "Profile";
DROP POLICY IF EXISTS "profile_update_own" ON "Profile";
DROP POLICY IF EXISTS "profile_delete_own" ON "Profile";
DROP POLICY IF EXISTS "profile_select_public" ON "Profile";

-- ============================================================================
-- 2. ENSURE RLS IS ENABLED
-- ============================================================================

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE OPTIMIZED RLS POLICIES
-- ============================================================================

-- Policy: Users can SELECT their own profile
-- Using (select auth.uid()) instead of auth.uid() prevents re-evaluation per row
-- This is the recommended pattern from Supabase for performance
CREATE POLICY "profile_select_own" ON "Profile"
    FOR SELECT
    USING ((select auth.uid())::text = "userId");

-- Policy: Users can INSERT their own profile
CREATE POLICY "profile_insert_own" ON "Profile"
    FOR INSERT
    WITH CHECK ((select auth.uid())::text = "userId");

-- Policy: Users can UPDATE their own profile
CREATE POLICY "profile_update_own" ON "Profile"
    FOR UPDATE
    USING ((select auth.uid())::text = "userId")
    WITH CHECK ((select auth.uid())::text = "userId");

-- Policy: Users can DELETE their own profile
CREATE POLICY "profile_delete_own" ON "Profile"
    FOR DELETE
    USING ((select auth.uid())::text = "userId");

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

-- Ensure authenticated users have proper access
GRANT SELECT, INSERT, UPDATE, DELETE ON "Profile" TO authenticated;

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================

-- Verify policies were created correctly
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'Profile';

    IF policy_count < 4 THEN
        RAISE EXCEPTION 'Expected at least 4 policies on Profile table, found %', policy_count;
    END IF;

    RAISE NOTICE 'Profile RLS policies fixed successfully! Found % policies.', policy_count;
END $$;
