-- =====================================================
-- CLERVA APP - PERFORMANCE INDEXES MIGRATION
-- =====================================================
-- Generated: 2025-12-17
-- Purpose: Add missing indexes to improve query performance
-- Safe to run: YES - Uses IF NOT EXISTS pattern
-- RLS Impact: NONE - Indexes don't affect RLS policies
-- =====================================================

-- =====================================================
-- 1. GroupInvite - Add index for inviterId
-- Used for: Finding invites sent by a specific user
-- =====================================================
CREATE INDEX IF NOT EXISTS "GroupInvite_inviterId_idx"
ON "GroupInvite" ("inviterId");

-- =====================================================
-- 2. Report - Add index for handledById
-- Used for: Finding reports handled by a specific admin
-- =====================================================
CREATE INDEX IF NOT EXISTS "Report_handledById_idx"
ON "Report" ("handledById");

-- =====================================================
-- 3. UserPresence - Add index for lastActivityAt
-- Used for: Cleanup queries for stale presence records
-- Note: Table is mapped to "user_presence" in Prisma
-- =====================================================
CREATE INDEX IF NOT EXISTS "user_presence_lastActivityAt_idx"
ON "user_presence" ("lastActivityAt");

-- =====================================================
-- 4. SessionParticipant - Add composite index for sessionId + status
-- Used for: Finding all active participants in a session
-- =====================================================
CREATE INDEX IF NOT EXISTS "SessionParticipant_sessionId_status_idx"
ON "SessionParticipant" ("sessionId", "status");

-- =====================================================
-- 5. TypingIndicator - Add index for userId
-- Used for: Clearing typing indicators when user disconnects
-- Note: Table is mapped to "typing_indicators" in Prisma
-- =====================================================
CREATE INDEX IF NOT EXISTS "typing_indicators_userId_idx"
ON "typing_indicators" ("userId");

-- =====================================================
-- 6. AIPartnerSession - Add composite index for userId + status
-- Used for: Finding user's active/paused AI sessions
-- =====================================================
CREATE INDEX IF NOT EXISTS "AIPartnerSession_userId_status_idx"
ON "AIPartnerSession" ("userId", "status");

-- =====================================================
-- 7. AIPartnerMessage - Add composite index for sessionId + createdAt
-- Used for: Loading messages in chronological order within a session
-- =====================================================
CREATE INDEX IF NOT EXISTS "AIPartnerMessage_sessionId_createdAt_idx"
ON "AIPartnerMessage" ("sessionId", "createdAt");

-- =====================================================
-- 8. StudySession - Add composite index for createdBy + status
-- Used for: Finding user's active sessions quickly
-- =====================================================
CREATE INDEX IF NOT EXISTS "StudySession_createdBy_status_idx"
ON "StudySession" ("createdBy", "status");
