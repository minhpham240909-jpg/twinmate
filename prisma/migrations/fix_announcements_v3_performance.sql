-- FIX V3: Remove duplicate policies and optimize auth.uid() calls
-- Run this in Supabase SQL Editor to fix all performance warnings

-- =====================================================
-- STEP 1: DROP ALL EXISTING POLICIES (clean slate)
-- =====================================================

-- Drop old policies on Announcement (including duplicates)
DROP POLICY IF EXISTS "announcement_select_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_insert_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_update_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_delete_policy" ON "Announcement";
DROP POLICY IF EXISTS "announcement_select" ON "Announcement";
DROP POLICY IF EXISTS "announcement_insert" ON "Announcement";
DROP POLICY IF EXISTS "announcement_update" ON "Announcement";
DROP POLICY IF EXISTS "announcement_delete" ON "Announcement";

-- Drop old policies on AnnouncementDismissal (including duplicates)
DROP POLICY IF EXISTS "dismissal_select_policy" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "dismissal_insert_policy" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "dismissal_delete_policy" ON "AnnouncementDismissal";
DROP POLICY IF EXISTS "Users can manage own dismissals" ON "AnnouncementDismissal";

-- =====================================================
-- STEP 2: CREATE OPTIMIZED RLS POLICIES FOR Announcement
-- Using (select auth.uid()) for performance optimization
-- =====================================================

-- SELECT: Admins see all, users see active targeted announcements
CREATE POLICY "announcement_select_policy" ON "Announcement"
FOR SELECT USING (
    -- Admins can see all (optimized with select wrapper)
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
    OR
    -- Users see active announcements targeted to them
    (
        "status" = 'ACTIVE'
        AND ("startsAt" IS NULL OR "startsAt" <= NOW())
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        AND (
            "targetAll" = true
            OR "targetRole" IS NULL
            OR EXISTS (
                SELECT 1 FROM "User"
                WHERE "User"."id" = (select auth.uid())::text
                AND (
                    "targetRole" IS NULL
                    OR "User"."role"::text = "targetRole"
                    OR (select auth.uid())::text = ANY("targetUserIds")
                )
            )
        )
    )
);

-- INSERT: Only admins (optimized)
CREATE POLICY "announcement_insert_policy" ON "Announcement"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- UPDATE: Only admins (optimized)
CREATE POLICY "announcement_update_policy" ON "Announcement"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- DELETE: Only admins (optimized)
CREATE POLICY "announcement_delete_policy" ON "Announcement"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- STEP 3: CREATE OPTIMIZED RLS POLICIES FOR AnnouncementDismissal
-- Using (select auth.uid()) for performance optimization
-- =====================================================

-- SELECT: Users see own, admins see all (optimized)
CREATE POLICY "dismissal_select_policy" ON "AnnouncementDismissal"
FOR SELECT USING (
    "userId" = (select auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- INSERT: Users can dismiss for themselves (optimized)
CREATE POLICY "dismissal_insert_policy" ON "AnnouncementDismissal"
FOR INSERT WITH CHECK (
    "userId" = (select auth.uid())::text
);

-- DELETE: Users can undo own, admins can remove any (optimized)
CREATE POLICY "dismissal_delete_policy" ON "AnnouncementDismissal"
FOR DELETE USING (
    "userId" = (select auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = (select auth.uid())::text
        AND "User"."isAdmin" = true
    )
);

-- =====================================================
-- DONE! Verify policies
-- =====================================================
SELECT 'SUCCESS: All policies optimized and duplicates removed!' as result;

-- Verify no duplicate policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('Announcement', 'AnnouncementDismissal')
ORDER BY tablename, cmd;
