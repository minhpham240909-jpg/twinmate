-- ============================================================================
-- AI Partner Intelligence System v2.0 - Database Migration
-- ============================================================================
-- This migration adds the Intelligence System columns to AIPartnerSession
-- and sets up proper RLS policies and performance indexes.
--
-- Run this SQL in Supabase SQL Editor or via psql connection.
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD NEW COLUMNS TO AIPartnerSession
-- ============================================================================

-- Add Intelligence System columns (if they don't exist)
DO $$
BEGIN
    -- Add intelligenceVersion column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AIPartnerSession'
        AND column_name = 'intelligenceVersion'
    ) THEN
        ALTER TABLE "AIPartnerSession"
        ADD COLUMN "intelligenceVersion" TEXT;

        RAISE NOTICE 'Added column: intelligenceVersion';
    ELSE
        RAISE NOTICE 'Column already exists: intelligenceVersion';
    END IF;

    -- Add adaptiveState column (JSONB for better performance)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AIPartnerSession'
        AND column_name = 'adaptiveState'
    ) THEN
        ALTER TABLE "AIPartnerSession"
        ADD COLUMN "adaptiveState" JSONB;

        RAISE NOTICE 'Added column: adaptiveState';
    ELSE
        RAISE NOTICE 'Column already exists: adaptiveState';
    END IF;

    -- Add totalTokensUsed column with default
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AIPartnerSession'
        AND column_name = 'totalTokensUsed'
    ) THEN
        ALTER TABLE "AIPartnerSession"
        ADD COLUMN "totalTokensUsed" INTEGER NOT NULL DEFAULT 0;

        RAISE NOTICE 'Added column: totalTokensUsed';
    ELSE
        RAISE NOTICE 'Column already exists: totalTokensUsed';
    END IF;

    -- Add fallbackCallCount column with default
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AIPartnerSession'
        AND column_name = 'fallbackCallCount'
    ) THEN
        ALTER TABLE "AIPartnerSession"
        ADD COLUMN "fallbackCallCount" INTEGER NOT NULL DEFAULT 0;

        RAISE NOTICE 'Added column: fallbackCallCount';
    ELSE
        RAISE NOTICE 'Column already exists: fallbackCallCount';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Index for querying sessions by intelligence version (useful for analytics)
CREATE INDEX IF NOT EXISTS "AIPartnerSession_intelligenceVersion_idx"
ON "AIPartnerSession" ("intelligenceVersion");

-- Partial index for active intelligence system sessions (most common query pattern)
CREATE INDEX IF NOT EXISTS "AIPartnerSession_active_intelligence_idx"
ON "AIPartnerSession" ("userId", "status", "intelligenceVersion")
WHERE "intelligenceVersion" IS NOT NULL AND "status" = 'ACTIVE';

-- Index for token usage monitoring (analytics/admin queries)
CREATE INDEX IF NOT EXISTS "AIPartnerSession_tokenUsage_idx"
ON "AIPartnerSession" ("totalTokensUsed")
WHERE "totalTokensUsed" > 0;

-- Composite index for common query pattern: user + status + started time
CREATE INDEX IF NOT EXISTS "AIPartnerSession_user_status_started_idx"
ON "AIPartnerSession" ("userId", "status", "startedAt" DESC);

-- ============================================================================
-- STEP 3: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN "AIPartnerSession"."intelligenceVersion" IS
'Version of the Intelligence System used for this session (e.g., 2.0.0). NULL indicates legacy session.';

COMMENT ON COLUMN "AIPartnerSession"."adaptiveState" IS
'Serialized adaptive tracker state for behavior customization across messages. Contains engagement, confusion, and preference tracking.';

COMMENT ON COLUMN "AIPartnerSession"."totalTokensUsed" IS
'Total tokens consumed by this session for budget tracking and analytics.';

COMMENT ON COLUMN "AIPartnerSession"."fallbackCallCount" IS
'Number of AI fallback classification calls used (rate limited to prevent overuse).';

-- ============================================================================
-- STEP 4: ROW LEVEL SECURITY (RLS) POLICIES FOR AIPartnerSession
-- ============================================================================

-- Enable RLS on AIPartnerSession if not already enabled
ALTER TABLE "AIPartnerSession" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Users can insert their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Users can update their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Users can delete their own AI partner sessions" ON "AIPartnerSession";
DROP POLICY IF EXISTS "Service role has full access to AI partner sessions" ON "AIPartnerSession";

-- Policy: Users can only view their own sessions
CREATE POLICY "Users can view their own AI partner sessions"
ON "AIPartnerSession"
FOR SELECT
USING (
    "userId" = auth.uid()::text
    OR
    -- Allow admin access for moderation/support
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- Policy: Users can only insert sessions for themselves
CREATE POLICY "Users can insert their own AI partner sessions"
ON "AIPartnerSession"
FOR INSERT
WITH CHECK (
    "userId" = auth.uid()::text
);

-- Policy: Users can only update their own sessions
CREATE POLICY "Users can update their own AI partner sessions"
ON "AIPartnerSession"
FOR UPDATE
USING (
    "userId" = auth.uid()::text
)
WITH CHECK (
    "userId" = auth.uid()::text
);

-- Policy: Users can only delete their own sessions
CREATE POLICY "Users can delete their own AI partner sessions"
ON "AIPartnerSession"
FOR DELETE
USING (
    "userId" = auth.uid()::text
);

-- Policy: Service role (backend) has full access (for API routes using service_role key)
CREATE POLICY "Service role has full access to AI partner sessions"
ON "AIPartnerSession"
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- STEP 5: RLS FOR AIPartnerMessage
-- ============================================================================

-- Enable RLS on AIPartnerMessage
ALTER TABLE "AIPartnerMessage" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages in their sessions" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "Users can insert messages in their sessions" ON "AIPartnerMessage";
DROP POLICY IF EXISTS "Service role has full access to AI partner messages" ON "AIPartnerMessage";

-- Policy: Users can only view messages from their own sessions
CREATE POLICY "Users can view messages in their sessions"
ON "AIPartnerMessage"
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "AIPartnerSession"
        WHERE "AIPartnerSession".id = "AIPartnerMessage"."sessionId"
        AND "AIPartnerSession"."userId" = auth.uid()::text
    )
    OR
    -- Admin access for moderation
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- Policy: Users can only insert messages in their own sessions
CREATE POLICY "Users can insert messages in their sessions"
ON "AIPartnerMessage"
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "AIPartnerSession"
        WHERE "AIPartnerSession".id = "AIPartnerMessage"."sessionId"
        AND "AIPartnerSession"."userId" = auth.uid()::text
    )
);

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to AI partner messages"
ON "AIPartnerMessage"
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- STEP 6: RLS FOR AIPartnerPersona (public read, admin write)
-- ============================================================================

-- Enable RLS on AIPartnerPersona
ALTER TABLE "AIPartnerPersona" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active AI partner personas" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "Admins can manage AI partner personas" ON "AIPartnerPersona";
DROP POLICY IF EXISTS "Service role has full access to AI partner personas" ON "AIPartnerPersona";

-- Policy: Anyone can view active personas (public read)
CREATE POLICY "Anyone can view active AI partner personas"
ON "AIPartnerPersona"
FOR SELECT
USING (
    "isActive" = true
    OR
    -- Admins can see all personas including inactive
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- Policy: Only admins can manage personas
CREATE POLICY "Admins can manage AI partner personas"
ON "AIPartnerPersona"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = auth.uid()::text
        AND "User"."isAdmin" = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User".id = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to AI partner personas"
ON "AIPartnerPersona"
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- STEP 7: RLS FOR AI Memory Tables (only if they exist)
-- ============================================================================

-- AIUserMemory (ai_user_memory)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_user_memory') THEN
        ALTER TABLE "ai_user_memory" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Users can view their own AI memory" ON "ai_user_memory";
        DROP POLICY IF EXISTS "Users can manage their own AI memory" ON "ai_user_memory";
        DROP POLICY IF EXISTS "Service role has full access to AI memory" ON "ai_user_memory";

        CREATE POLICY "Users can view their own AI memory"
        ON "ai_user_memory"
        FOR SELECT
        USING ("userId" = auth.uid()::text);

        CREATE POLICY "Users can manage their own AI memory"
        ON "ai_user_memory"
        FOR ALL
        USING ("userId" = auth.uid()::text)
        WITH CHECK ("userId" = auth.uid()::text);

        CREATE POLICY "Service role has full access to AI memory"
        ON "ai_user_memory"
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        RAISE NOTICE 'RLS configured for ai_user_memory';
    ELSE
        RAISE NOTICE 'Table ai_user_memory does not exist, skipping RLS';
    END IF;
END $$;

-- AIMemoryEntry (ai_memory_entries)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memory_entries') THEN
        ALTER TABLE "ai_memory_entries" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Users can view their own memory entries" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "Users can manage their own memory entries" ON "ai_memory_entries";
        DROP POLICY IF EXISTS "Service role has full access to memory entries" ON "ai_memory_entries";

        CREATE POLICY "Users can view their own memory entries"
        ON "ai_memory_entries"
        FOR SELECT
        USING ("userId" = auth.uid()::text);

        CREATE POLICY "Users can manage their own memory entries"
        ON "ai_memory_entries"
        FOR ALL
        USING ("userId" = auth.uid()::text)
        WITH CHECK ("userId" = auth.uid()::text);

        CREATE POLICY "Service role has full access to memory entries"
        ON "ai_memory_entries"
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        RAISE NOTICE 'RLS configured for ai_memory_entries';
    ELSE
        RAISE NOTICE 'Table ai_memory_entries does not exist, skipping RLS';
    END IF;
END $$;

-- ============================================================================
-- STEP 8: RLS FOR AI Usage/Cache Tables (only if they exist)
-- ============================================================================

-- AI Response Cache
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_response_cache') THEN
        ALTER TABLE "ai_response_cache" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Service role has full access to response cache" ON "ai_response_cache";

        CREATE POLICY "Service role has full access to response cache"
        ON "ai_response_cache"
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        RAISE NOTICE 'RLS configured for ai_response_cache';
    ELSE
        RAISE NOTICE 'Table ai_response_cache does not exist, skipping RLS';
    END IF;
END $$;

-- AI Usage Logs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_usage_logs') THEN
        ALTER TABLE "ai_usage_logs" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Admins can view AI usage logs" ON "ai_usage_logs";
        DROP POLICY IF EXISTS "Service role has full access to usage logs" ON "ai_usage_logs";

        CREATE POLICY "Admins can view AI usage logs"
        ON "ai_usage_logs"
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM "User"
                WHERE "User".id = auth.uid()::text
                AND "User"."isAdmin" = true
            )
        );

        CREATE POLICY "Service role has full access to usage logs"
        ON "ai_usage_logs"
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        RAISE NOTICE 'RLS configured for ai_usage_logs';
    ELSE
        RAISE NOTICE 'Table ai_usage_logs does not exist, skipping RLS';
    END IF;
END $$;

-- AI Usage Daily Summary
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_usage_daily_summaries') THEN
        ALTER TABLE "ai_usage_daily_summaries" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Admins can view usage summaries" ON "ai_usage_daily_summaries";
        DROP POLICY IF EXISTS "Service role has full access to usage summaries" ON "ai_usage_daily_summaries";

        CREATE POLICY "Admins can view usage summaries"
        ON "ai_usage_daily_summaries"
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM "User"
                WHERE "User".id = auth.uid()::text
                AND "User"."isAdmin" = true
            )
        );

        CREATE POLICY "Service role has full access to usage summaries"
        ON "ai_usage_daily_summaries"
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        RAISE NOTICE 'RLS configured for ai_usage_daily_summaries';
    ELSE
        RAISE NOTICE 'Table ai_usage_daily_summaries does not exist, skipping RLS';
    END IF;
END $$;

-- ============================================================================
-- STEP 9: PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Analyze tables to update statistics for query planner
ANALYZE "AIPartnerSession";
ANALYZE "AIPartnerMessage";
ANALYZE "AIPartnerPersona";

-- ============================================================================
-- STEP 10: VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'AIPartnerSession'
    AND column_name IN ('intelligenceVersion', 'adaptiveState', 'totalTokensUsed', 'fallbackCallCount');

    IF col_count = 4 THEN
        RAISE NOTICE '✅ All Intelligence System columns verified successfully';
    ELSE
        RAISE WARNING '⚠️ Expected 4 columns, found %', col_count;
    END IF;
END $$;

-- Verify indexes were created
DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE tablename = 'AIPartnerSession'
    AND (indexname LIKE '%intelligence%' OR indexname LIKE '%tokenUsage%');

    RAISE NOTICE 'Intelligence System indexes created: %', idx_count;
END $$;

-- Verify RLS is enabled
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'AIPartnerSession';

    IF rls_enabled THEN
        RAISE NOTICE '✅ RLS is enabled on AIPartnerSession';
    ELSE
        RAISE WARNING '⚠️ RLS is NOT enabled on AIPartnerSession';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary:
-- 1. Added 4 new columns to AIPartnerSession:
--    - intelligenceVersion (TEXT)
--    - adaptiveState (JSONB)
--    - totalTokensUsed (INTEGER, default 0)
--    - fallbackCallCount (INTEGER, default 0)
--
-- 2. Created performance indexes:
--    - AIPartnerSession_intelligenceVersion_idx
--    - AIPartnerSession_active_intelligence_idx (partial)
--    - AIPartnerSession_tokenUsage_idx (partial)
--    - AIPartnerSession_user_status_started_idx (composite)
--
-- 3. Set up RLS policies for:
--    - AIPartnerSession (user-scoped + admin + service_role)
--    - AIPartnerMessage (user-scoped via session + admin + service_role)
--    - AIPartnerPersona (public read active, admin write)
--    - Other AI tables (only if they exist)
--
-- Next steps after running this migration:
-- 1. Regenerate Prisma client: npx prisma generate
-- 2. Uncomment intelligence fields in service.ts session creation
-- 3. Test the AI Partner with new sessions
--
-- ============================================================================
