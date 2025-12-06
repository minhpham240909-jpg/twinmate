-- FIX: Function Search Path Security Warnings
-- Run this in Supabase SQL Editor to fix all function_search_path_mutable warnings
-- This sets search_path to '' for all functions to prevent schema injection attacks

-- =====================================================
-- STEP 1: FIX is_admin FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public."User"
        WHERE "id" = (SELECT auth.uid())::text
        AND "isAdmin" = true
    );
$$;

-- =====================================================
-- STEP 2: FIX append_post_edit_history FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.append_post_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Append the old content to edit history when content changes
    IF OLD."content" IS DISTINCT FROM NEW."content" THEN
        NEW."editHistory" = array_append(
            COALESCE(OLD."editHistory", ARRAY[]::text[]),
            OLD."content"
        );
        NEW."isEdited" = true;
    END IF;
    RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 3: FIX update_push_subscription_updated_at FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_push_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 4: FIX search_chunks FUNCTION
-- =====================================================

-- Note: This function uses vector similarity search
-- Adjust the function body based on your actual implementation
CREATE OR REPLACE FUNCTION public.search_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.78,
    match_count int DEFAULT 10,
    filter_document_id text DEFAULT NULL
)
RETURNS TABLE (
    id text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM public."DocumentChunk" c
    WHERE
        (filter_document_id IS NULL OR c."documentId" = filter_document_id)
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- STEP 5: FIX update_announcement_updated_at FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_announcement_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 6: FIX update_flagged_content_updated_at FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_flagged_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 7: FIX get_active_announcements_for_user FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_active_announcements_for_user(p_user_id text)
RETURNS SETOF public."Announcement"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM public."Announcement" a
    LEFT JOIN public."AnnouncementDismissal" d
        ON d."announcementId" = a."id" AND d."userId" = p_user_id
    WHERE a."status" = 'ACTIVE'
        AND (a."startsAt" IS NULL OR a."startsAt" <= NOW())
        AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
        AND d."id" IS NULL
        AND (
            a."targetAll" = true
            OR EXISTS (
                SELECT 1 FROM public."User" u
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
$$;

-- =====================================================
-- DONE! Verify functions
-- =====================================================
SELECT 'SUCCESS: All functions now have secure search_path!' as result;

-- Verify all functions have search_path set
SELECT
    proname as function_name,
    proconfig as config
FROM pg_proc
WHERE proname IN (
    'is_admin',
    'append_post_edit_history',
    'update_push_subscription_updated_at',
    'search_chunks',
    'update_announcement_updated_at',
    'update_flagged_content_updated_at',
    'get_active_announcements_for_user'
)
AND pronamespace = 'public'::regnamespace;
