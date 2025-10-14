-- ============================================
-- Database Performance Optimization
-- Created: 2025-10-10
-- Purpose: Address slow queries and improve overall performance
-- ============================================

-- Issue 2: Timezone query (105 calls, 24.8 seconds total)
-- The query "SELECT name FROM pg_timezone_names" is expensive
-- Solution: Cache timezone data or use a limited set

-- Create a materialized view for commonly used timezones (if needed)
-- This is optional - only use if your app frequently queries timezones
CREATE MATERIALIZED VIEW IF NOT EXISTS common_timezones AS
SELECT name, abbrev, utc_offset, is_dst
FROM pg_timezone_names
WHERE name IN (
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
  -- Add other timezones your users commonly use
);

-- Refresh this view periodically if needed (timezones rarely change)
-- REFRESH MATERIALIZED VIEW common_timezones;

-- ============================================
-- Issue 3: Improve index coverage for realtime queries
-- ============================================

-- Add composite indexes for tables in realtime publication
-- This helps with the list_changes queries

-- SessionMessage indexes (if not already present)
CREATE INDEX IF NOT EXISTS "SessionMessage_sessionId_createdAt_idx"
ON "SessionMessage"("sessionId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SessionMessage_senderId_createdAt_idx"
ON "SessionMessage"("senderId", "createdAt" DESC);

-- Message indexes (if not already present)
CREATE INDEX IF NOT EXISTS "Message_groupId_createdAt_idx"
ON "Message"("groupId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_senderId_createdAt_idx"
ON "Message"("senderId", "createdAt" DESC);

-- SessionTimer indexes
CREATE INDEX IF NOT EXISTS "SessionTimer_sessionId_idx"
ON "SessionTimer"("sessionId");

-- SessionParticipant indexes
CREATE INDEX IF NOT EXISTS "SessionParticipant_sessionId_userId_idx"
ON "SessionParticipant"("sessionId", "userId");

CREATE INDEX IF NOT EXISTS "SessionParticipant_userId_idx"
ON "SessionParticipant"("userId");

-- Notification indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt" DESC)
WHERE "isRead" = false; -- Partial index for unread notifications

-- ============================================
-- Issue 4: Add indexes for common filter patterns
-- ============================================

-- If you filter by deletedAt (from your soft delete implementation)
-- Add partial indexes for non-deleted records
CREATE INDEX IF NOT EXISTS "SessionMessage_not_deleted_idx"
ON "SessionMessage"("sessionId", "createdAt" DESC)
WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Message_not_deleted_idx"
ON "Message"("groupId", "createdAt" DESC)
WHERE "deletedAt" IS NULL;

-- ============================================
-- Issue 5: Analyze tables to update statistics
-- This helps PostgreSQL make better query plans
-- ============================================

ANALYZE "SessionMessage";
ANALYZE "Message";
ANALYZE "SessionTimer";
ANALYZE "SessionParticipant";
ANALYZE "StudySession";
ANALYZE "Group";
ANALYZE "GroupMember";
ANALYZE "User";
ANALYZE "Notification";

-- ============================================
-- Issue 6: Clean up old data (optional)
-- If you have old deleted records, consider archiving/purging them
-- ============================================

-- Example: Delete soft-deleted messages older than 90 days
-- UNCOMMENT AND MODIFY AS NEEDED:
-- DELETE FROM "SessionMessage"
-- WHERE "deletedAt" IS NOT NULL
-- AND "deletedAt" < NOW() - INTERVAL '90 days';

-- DELETE FROM "Message"
-- WHERE "deletedAt" IS NOT NULL
-- AND "deletedAt" < NOW() - INTERVAL '90 days';
