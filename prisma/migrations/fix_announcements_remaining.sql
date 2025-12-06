-- FIX: Run this if the previous SQL failed midway
-- This only runs the remaining steps that might not have executed

-- =====================================================
-- STEP 5: CREATE PERFORMANCE INDEXES (safe to re-run)
-- =====================================================

CREATE INDEX IF NOT EXISTS "Announcement_status_idx" ON "Announcement"("status");
CREATE INDEX IF NOT EXISTS "Announcement_priority_idx" ON "Announcement"("priority");
CREATE INDEX IF NOT EXISTS "Announcement_startsAt_idx" ON "Announcement"("startsAt");
CREATE INDEX IF NOT EXISTS "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");
CREATE INDEX IF NOT EXISTS "Announcement_createdById_idx" ON "Announcement"("createdById");
CREATE INDEX IF NOT EXISTS "Announcement_createdAt_idx" ON "Announcement"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Announcement_status_startsAt_expiresAt_idx"
ON "Announcement"("status", "startsAt", "expiresAt")
WHERE "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "AnnouncementDismissal_userId_idx" ON "AnnouncementDismissal"("userId");
CREATE INDEX IF NOT EXISTS "AnnouncementDismissal_announcementId_idx" ON "AnnouncementDismissal"("announcementId");

-- =====================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY (safe to re-run)
-- =====================================================

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementDismissal" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: DROP EXISTING POLICIES (clean slate)
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

CREATE POLICY "announcement_select_policy" ON "Announcement"
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
    OR
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

CREATE POLICY "announcement_insert_policy" ON "Announcement"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

CREATE POLICY "announcement_update_policy" ON "Announcement"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

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

CREATE POLICY "dismissal_select_policy" ON "AnnouncementDismissal"
FOR SELECT USING (
    "userId" = auth.uid()::text
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()::text
        AND "User"."isAdmin" = true
    )
);

CREATE POLICY "dismissal_insert_policy" ON "AnnouncementDismissal"
FOR INSERT WITH CHECK (
    "userId" = auth.uid()::text
);

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

DO $$
BEGIN
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

-- =====================================================
-- STEP 11: CREATE HELPER FUNCTION
-- =====================================================

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
        AND d."id" IS NULL
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

CREATE OR REPLACE FUNCTION update_announcement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS announcement_updated_at_trigger ON "Announcement";

CREATE TRIGGER announcement_updated_at_trigger
    BEFORE UPDATE ON "Announcement"
    FOR EACH ROW
    EXECUTE FUNCTION update_announcement_updated_at();

-- =====================================================
-- DONE! Verify with:
-- =====================================================
SELECT 'SUCCESS: Announcements setup complete!' as result;
