-- Add Announcements Table for Admin Dashboard
-- Includes RLS Security Policies and Performance Optimizations
-- Run this SQL in Supabase SQL Editor

-- =====================================================
-- STEP 1: CREATE ENUMS
-- =====================================================

DO $$ BEGIN
    CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- STEP 2: CREATE TABLES
-- =====================================================

-- Announcement table
CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "targetRole" TEXT,
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "showBanner" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- AnnouncementDismissal table (tracks who dismissed which announcement)
CREATE TABLE IF NOT EXISTS "AnnouncementDismissal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- STEP 3: ADD FOREIGN KEYS
-- =====================================================

DO $$ BEGIN
    ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- STEP 4: ADD UNIQUE CONSTRAINTS
-- =====================================================

-- Drop and recreate to avoid conflicts
DO $$
BEGIN
    -- Check if constraint exists before trying to add
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnnouncementDismissal_announcementId_userId_key'
    ) THEN
        ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_userId_key"
        UNIQUE ("announcementId", "userId");
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

-- =====================================================
-- STEP 5: CREATE PERFORMANCE INDEXES
-- =====================================================

-- Announcement indexes for common queries
CREATE INDEX IF NOT EXISTS "Announcement_status_idx" ON "Announcement"("status");
CREATE INDEX IF NOT EXISTS "Announcement_priority_idx" ON "Announcement"("priority");
CREATE INDEX IF NOT EXISTS "Announcement_startsAt_idx" ON "Announcement"("startsAt");
CREATE INDEX IF NOT EXISTS "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");
CREATE INDEX IF NOT EXISTS "Announcement_createdById_idx" ON "Announcement"("createdById");
CREATE INDEX IF NOT EXISTS "Announcement_createdAt_idx" ON "Announcement"("createdAt" DESC);

-- Composite index for active announcements query (most common)
CREATE INDEX IF NOT EXISTS "Announcement_status_startsAt_expiresAt_idx"
ON "Announcement"("status", "startsAt", "expiresAt")
WHERE "status" = 'ACTIVE';

-- AnnouncementDismissal indexes
CREATE INDEX IF NOT EXISTS "AnnouncementDismissal_userId_idx" ON "AnnouncementDismissal"("userId");
CREATE INDEX IF NOT EXISTS "AnnouncementDismissal_announcementId_idx" ON "AnnouncementDismissal"("announcementId");

-- =====================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementDismissal" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: DROP EXISTING POLICIES (if any)
-- =====================================================

DROP POLICY IF EXISTS "announcement_select_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_insert_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_update_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_delete_policy" ON "Announcement";
DROP POLICY IF EXISTS "dismissal_select_policy" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "dismissal_insert_policy" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "dismissal_delete_policy" ON "AnnouncementDismissal";

-- =====================================================
-- STEP 8: CREATE RLS POLICIES FOR Announcement
-- =====================================================

-- SELECT: Admins can see all, users can see active announcements targeted to them
CREATE POLICY "announcement_select_policy" ON "Announcement"
FOR SELECT USING (
    -- Admins can see all announcements
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
    OR
    -- Regular users can see active announcements that:
    -- 1. Are ACTIVE status
    -- 2. Have started (startsAt is null or in the past)
    -- 3. Haven't expired (expiresAt is null or in the future)
    -- 4. Target them (targetAll=true, or their role matches, or their ID is in targetUserIds)
    (
        "status" = 'ACTIVE'
        AND ("startsAt" IS NULL OR "startsAt" <= NOW())
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        AND (
            "targetAll" = true
            OR "targetRole" IS NULL
            OR EXISTS (
                SELECT 1 FROM "User"
                WHERE "User"."id" = auth.uid()::text
                AND (
                    "targetRole" IS NULL
                    OR "User"."role"::text = "targetRole"
                    OR auth.uid()::text = ANY("targetUserIds")
                )
            )
        )
    )
);

-- INSERT: Only admins can create announcements
CREATE POLICY "announcement_insert_policy" ON "Announcement"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- UPDATE: Only admins can update announcements
CREATE POLICY "announcement_update_policy" ON "Announcement"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- DELETE: Only admins can delete announcements
CREATE POLICY "announcement_delete_policy" ON "Announcement"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- STEP 9: CREATE RLS POLICIES FOR AnnouncementDismissal
-- =====================================================

-- SELECT: Users can see their own dismissals, admins can see all
CREATE POLICY "dismissal_select_policy" ON "AnnouncementDismissal"
FOR SELECT USING (
    "userId" = auth.uid()::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Users can dismiss announcements for themselves only
CREATE POLICY "dismissal_insert_policy" ON "AnnouncementDismissal"
FOR INSERT WITH CHECK (
    "userId" = auth.uid()::text
);

-- DELETE: Users can remove their own dismissals, admins can remove any
CREATE POLICY "dismissal_delete_policy" ON "AnnouncementDismissal"
FOR DELETE USING (
    "userId" = auth.uid()::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- STEP 10: ADD ANNOUNCEMENT TO NotificationType ENUM
-- =====================================================

-- Check if ANNOUNCEMENT already exists in the enum before adding
DO $$
BEGIN
    -- Try to add the value, will fail silently if it already exists
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

-- =====================================================
-- STEP 11: CREATE HELPER FUNCTION FOR ACTIVE ANNOUNCEMENTS
-- =====================================================

-- Function to get active announcements for a user (optimized)
CREATE OR REPLACE FUNCTION get_active_announcements_for_user(p_user_id TEXT)
RETURNS SETOF "Announcement" AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM "Announcement" a
    LEFT JOIN "AnnouncementDismissal" d
        ON d."announcementId" = a."id" AND d."userId" = p_user_id
    WHERE a."status" = 'ACTIVE'
        AND (a."startsAt" IS NULL OR a."startsAt" <= NOW())
        AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
        AND d."id" IS NULL  -- Not dismissed
        AND (
            a."targetAll" = true
            OR EXISTS (
                SELECT 1 FROM "User" u
                WHERE u."id" = p_user_id
                AND (
                    a."targetRole" IS NULL
                    OR u."role"::text = a."targetRole"
                    OR p_user_id = ANY(a."targetUserIds")
                )
            )
        )
    ORDER BY
        CASE a."priority"
            WHEN 'URGENT' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'NORMAL' THEN 3
            WHEN 'LOW' THEN 4
        END,
        a."createdAt" DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 12: CREATE TRIGGER FOR updatedAt
-- =====================================================

-- Function to auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_announcement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS announcement_updated_at_trigger ON "Announcement";

-- Create trigger
CREATE TRIGGER announcement_updated_at_trigger
    BEFORE UPDATE ON "Announcement"
    FOR EACH ROW
    EXECUTE FUNCTION update_announcement_updated_at();

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- =====================================================

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('Announcement', 'AnnouncementDismissal');

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('Announcement', 'AnnouncementDismissal');

-- Verify policies exist
-- SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('Announcement', 'AnnouncementDismissal');

-- Verify indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('Announcement', 'AnnouncementDismissal');
