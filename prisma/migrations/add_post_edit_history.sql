-- ============================================================================
-- Post Edit History Migration
-- Adds edit tracking with RLS security and optimized performance
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA CHANGES
-- ============================================================================

-- Add isEdited flag to track if post was ever edited
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN DEFAULT false;

-- Add editHistory as JSONB array to store previous versions
-- Each entry: { "content": "...", "editedAt": "2025-01-01T00:00:00Z", "editedBy": "user-id" }
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "editHistory" JSONB DEFAULT '[]';

-- Add lastEditedAt timestamp for quick queries
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMPTZ;

-- ============================================================================
-- 2. PERFORMANCE INDEXES
-- ============================================================================

-- Index for filtering edited posts
CREATE INDEX IF NOT EXISTS "Post_isEdited_idx" ON "Post" ("isEdited") WHERE "isEdited" = true;

-- Partial index for recently edited posts (better for dashboard queries)
CREATE INDEX IF NOT EXISTS "Post_lastEditedAt_idx" ON "Post" ("lastEditedAt" DESC NULLS LAST)
  WHERE "lastEditedAt" IS NOT NULL;

-- GIN index for JSONB queries on editHistory (if you need to search within history)
CREATE INDEX IF NOT EXISTS "Post_editHistory_gin_idx" ON "Post" USING GIN ("editHistory");

-- Composite index for common query patterns (user's edited posts)
CREATE INDEX IF NOT EXISTS "Post_userId_isEdited_idx" ON "Post" ("userId", "isEdited")
  WHERE "isEdited" = true;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================
-- NOTE: RLS policies for Post table are managed centrally in fix_rls_performance.sql
-- This avoids duplicate policies and ensures optimal performance.
-- Only enabling RLS here; policies are created in the performance fix migration.

-- Enable RLS on Post table (if not already enabled)
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. HELPER FUNCTION: Append to Edit History (with 10-entry limit)
-- ============================================================================

CREATE OR REPLACE FUNCTION append_post_edit_history()
RETURNS TRIGGER AS $$
DECLARE
  history_entry JSONB;
  current_history JSONB;
BEGIN
  -- Only track if content actually changed
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    -- Create history entry with old content
    history_entry := jsonb_build_object(
      'content', OLD.content,
      'editedAt', NOW(),
      'editedBy', (SELECT auth.uid())::text
    );

    -- Get current history (default to empty array)
    current_history := COALESCE(OLD."editHistory", '[]'::JSONB);

    -- Append new entry and limit to last 10 entries
    NEW."editHistory" := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(current_history || history_entry) AS elem
        ORDER BY (elem->>'editedAt')::timestamptz DESC
        LIMIT 10
      ) sub
    );

    -- Update tracking fields
    NEW."isEdited" := true;
    NEW."lastEditedAt" := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. TRIGGER: Auto-track edits
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS post_edit_history_trigger ON "Post";

-- Create trigger to automatically track edits
CREATE TRIGGER post_edit_history_trigger
  BEFORE UPDATE ON "Post"
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION append_post_edit_history();

-- ============================================================================
-- 6. DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN "Post"."isEdited" IS 'Flag indicating if the post has been edited at least once';
COMMENT ON COLUMN "Post"."editHistory" IS 'JSONB array of previous versions. Each entry: {content, editedAt, editedBy}. Limited to 10 entries.';
COMMENT ON COLUMN "Post"."lastEditedAt" IS 'Timestamp of the most recent edit for quick sorting/filtering';
COMMENT ON FUNCTION append_post_edit_history() IS 'Trigger function to automatically track post edits with 10-entry rolling history';

-- ============================================================================
-- 7. VERIFICATION QUERY (run manually to verify)
-- ============================================================================

-- Uncomment to verify setup:
-- SELECT
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual
-- FROM pg_policies
-- WHERE tablename = 'Post';
