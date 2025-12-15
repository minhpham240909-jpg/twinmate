-- ============================================================================
-- FIX: Combine Multiple Permissive RLS Policies
-- ============================================================================
-- This fixes the performance warning:
-- "Multiple permissive policies for role authenticated for action SELECT"
--
-- Problem: Having cache_select_global AND cache_select_own as separate
-- permissive policies means PostgreSQL must evaluate BOTH for every query.
--
-- Solution: Combine them into a single policy with OR logic.
--
-- Run this SQL in Supabase SQL Editor
-- ============================================================================

-- Drop the two separate SELECT policies
DROP POLICY IF EXISTS "cache_select_global" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_select_own" ON "ai_response_cache";

-- Create a single combined SELECT policy
-- Users can read: global cache entries OR their own cache entries
CREATE POLICY "cache_select"
ON "ai_response_cache"
FOR SELECT
TO authenticated
USING (
    "expiresAt" > NOW()
    AND (
        -- Global scope: anyone can read
        "scope" = 'global'
        OR
        -- User scope: only owner can read
        "userId" = (SELECT auth.uid())::text
    )
);

-- ============================================================================
-- COMPLETE
-- ============================================================================
-- This migration:
-- 1. Removed cache_select_global policy
-- 2. Removed cache_select_own policy
-- 3. Created single cache_select policy with combined logic
--
-- Performance improvement: Only ONE policy is evaluated per query instead of TWO
-- ============================================================================
