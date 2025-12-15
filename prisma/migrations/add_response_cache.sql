-- ============================================================================
-- AI RESPONSE CACHE TABLE (Enhanced for Smart Routing)
-- ============================================================================
-- This migration updates the response cache table for the AI Partner system.
-- Features:
-- 1. Hybrid caching (global + per-user)
-- 2. Semantic similarity matching via normalized queries
-- 3. Automatic expiration with TTL
-- 4. Hit counting for popularity-based eviction
-- 5. RLS security policies
-- 6. Performance indexes for fast lookups
--
-- Run this SQL in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 0: DROP EXISTING TABLE (if it exists with old structure)
-- ============================================================================

-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS "ai_response_cache" CASCADE;

-- ============================================================================
-- STEP 1: CREATE THE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ai_response_cache" (
    -- Primary key
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,

    -- Query identification
    "queryHash" TEXT NOT NULL,           -- SHA256 hash for exact matching
    "queryNormalized" TEXT NOT NULL,     -- Normalized query for fuzzy matching

    -- Response data
    "response" TEXT NOT NULL,            -- Cached AI response

    -- Scope and ownership
    "scope" TEXT NOT NULL DEFAULT 'global',  -- 'global', 'user', 'session'
    "userId" TEXT,                       -- NULL for global scope
    "subject" TEXT,                      -- Subject context (optional)
    "skillLevel" TEXT,                   -- Skill level context (optional)

    -- Cache management
    "hitCount" INTEGER NOT NULL DEFAULT 0,   -- Number of times this cache was used
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ NOT NULL,        -- When this cache entry expires
    "lastAccessedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata (JSONB for flexibility)
    "metadata" JSONB DEFAULT '{}',       -- originalQuery, modelUsed, tokensUsed, etc.

    -- Constraints
    CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_response_cache_queryHash_key" UNIQUE ("queryHash"),
    CONSTRAINT "ai_response_cache_scope_check" CHECK ("scope" IN ('global', 'user', 'session')),

    -- Foreign key to User (optional, for per-user caches)
    CONSTRAINT "ai_response_cache_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE
);

-- ============================================================================
-- STEP 2: CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Primary lookup index: queryHash (exact match)
CREATE INDEX IF NOT EXISTS "ai_response_cache_queryHash_idx"
ON "ai_response_cache" ("queryHash");

-- Scope-based lookup (for filtering)
CREATE INDEX IF NOT EXISTS "ai_response_cache_scope_idx"
ON "ai_response_cache" ("scope");

-- User-specific cache lookup
CREATE INDEX IF NOT EXISTS "ai_response_cache_userId_idx"
ON "ai_response_cache" ("userId")
WHERE "userId" IS NOT NULL;

-- Expiration index for cleanup jobs
CREATE INDEX IF NOT EXISTS "ai_response_cache_expiresAt_idx"
ON "ai_response_cache" ("expiresAt");

-- Subject-based lookup for fuzzy matching
CREATE INDEX IF NOT EXISTS "ai_response_cache_subject_idx"
ON "ai_response_cache" ("subject")
WHERE "subject" IS NOT NULL;

-- Composite index for common query pattern: scope + expiration + hitCount
-- Note: Cannot use NOW() in partial index (not immutable), so we use a full index
CREATE INDEX IF NOT EXISTS "ai_response_cache_scope_expires_hits_idx"
ON "ai_response_cache" ("scope", "expiresAt", "hitCount" DESC);

-- Partial index for global cache entries (most common lookup)
-- Note: Only filter on immutable condition (scope), expiration checked at query time
CREATE INDEX IF NOT EXISTS "ai_response_cache_global_active_idx"
ON "ai_response_cache" ("queryHash", "expiresAt", "hitCount" DESC)
WHERE "scope" = 'global';

-- GIN index on metadata for JSONB queries (if needed)
CREATE INDEX IF NOT EXISTS "ai_response_cache_metadata_idx"
ON "ai_response_cache" USING GIN ("metadata");

-- ============================================================================
-- STEP 3: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE "ai_response_cache" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "cache_select_global" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_select_own" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_select" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_insert" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_update" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_delete" ON "ai_response_cache";
DROP POLICY IF EXISTS "cache_service" ON "ai_response_cache";

-- Policy: Combined SELECT policy for authenticated users
-- Users can read: global cache entries OR their own cache entries
-- NOTE: Using single policy instead of multiple to avoid performance warning
-- (Multiple permissive policies require evaluating ALL policies per query)
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

-- Policy: Service role can insert cache entries
-- (Cache writes should only happen from backend)
CREATE POLICY "cache_insert"
ON "ai_response_cache"
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Service role can update cache entries (hit counts, etc.)
CREATE POLICY "cache_update"
ON "ai_response_cache"
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Service role can delete cache entries (cleanup)
CREATE POLICY "cache_delete"
ON "ai_response_cache"
FOR DELETE
TO service_role
USING (true);

-- Policy: Full access for service role
CREATE POLICY "cache_service"
ON "ai_response_cache"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 4: CREATE CLEANUP FUNCTION
-- ============================================================================

-- Function to clean up expired cache entries
-- Should be called periodically (e.g., via pg_cron or application)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM "ai_response_cache"
    WHERE "expiresAt" < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % expired cache entries', deleted_count;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- STEP 5: CREATE CACHE STATS FUNCTION
-- ============================================================================

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
    total_entries BIGINT,
    global_entries BIGINT,
    user_entries BIGINT,
    total_hits BIGINT,
    avg_hit_count NUMERIC,
    cache_size_bytes BIGINT,
    oldest_entry TIMESTAMPTZ,
    newest_entry TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_entries,
        COUNT(*) FILTER (WHERE "scope" = 'global')::BIGINT AS global_entries,
        COUNT(*) FILTER (WHERE "scope" = 'user')::BIGINT AS user_entries,
        COALESCE(SUM("hitCount"), 0)::BIGINT AS total_hits,
        COALESCE(AVG("hitCount"), 0)::NUMERIC AS avg_hit_count,
        COALESCE(SUM(LENGTH("response")), 0)::BIGINT AS cache_size_bytes,
        MIN("createdAt") AS oldest_entry,
        MAX("createdAt") AS newest_entry
    FROM "ai_response_cache"
    WHERE "expiresAt" > NOW();
END;
$$;

-- ============================================================================
-- STEP 6: CREATE CACHE EVICTION FUNCTION
-- ============================================================================

-- Function to evict least-used cache entries when at capacity
CREATE OR REPLACE FUNCTION evict_cache_entries(max_entries INTEGER DEFAULT 10000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count INTEGER;
    to_delete INTEGER;
    deleted_count INTEGER := 0;
BEGIN
    -- Get current count
    SELECT COUNT(*) INTO current_count FROM "ai_response_cache";

    -- Calculate how many to delete (keep 90% of max)
    IF current_count > max_entries THEN
        to_delete := current_count - (max_entries * 9 / 10);

        -- Delete least-used entries (lowest hit count, oldest)
        WITH entries_to_delete AS (
            SELECT "id"
            FROM "ai_response_cache"
            ORDER BY "hitCount" ASC, "lastAccessedAt" ASC
            LIMIT to_delete
        )
        DELETE FROM "ai_response_cache"
        WHERE "id" IN (SELECT "id" FROM entries_to_delete);

        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Evicted % cache entries', deleted_count;
    END IF;

    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- STEP 7: ADD TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE "ai_response_cache" IS
'Cache for AI responses to reduce API costs and improve response times. Supports global and per-user caching with automatic expiration.';

COMMENT ON COLUMN "ai_response_cache"."queryHash" IS
'SHA256 hash of normalized query + scope for exact matching';

COMMENT ON COLUMN "ai_response_cache"."queryNormalized" IS
'Normalized query text for fuzzy/semantic matching';

COMMENT ON COLUMN "ai_response_cache"."scope" IS
'Cache scope: global (same for everyone), user (personalized), session (temporary)';

COMMENT ON COLUMN "ai_response_cache"."hitCount" IS
'Number of times this cache entry was used, for popularity-based eviction';

COMMENT ON COLUMN "ai_response_cache"."metadata" IS
'JSON metadata: originalQuery, modelUsed, tokensUsed, responseLength, complexity';

-- ============================================================================
-- STEP 8: ANALYZE TABLE
-- ============================================================================

ANALYZE "ai_response_cache";

-- ============================================================================
-- COMPLETE
-- ============================================================================
--
-- This migration created:
-- 1. ai_response_cache table with proper constraints
-- 2. 8 performance indexes for fast lookups
-- 3. RLS policies (service_role write, authenticated read)
-- 4. cleanup_expired_cache() function for maintenance
-- 5. get_cache_stats() function for monitoring
-- 6. evict_cache_entries() function for capacity management
--
-- Next steps:
-- 1. Prisma schema already updated with AIResponseCache model
-- 2. Run prisma generate
-- 3. Integrate caching into sendMessage flow
--
-- Maintenance recommendations:
-- - Run cleanup_expired_cache() daily via pg_cron or application
-- - Monitor cache stats with get_cache_stats()
-- - Run evict_cache_entries() when approaching capacity
--
-- ============================================================================
