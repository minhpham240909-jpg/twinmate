-- ============================================
-- FIX RLS PERFORMANCE & SECURITY WARNINGS
-- Run this AFTER the private_content_migration.sql
-- ============================================

-- ============================================
-- STEP 1: Drop ALL duplicate/old policies for SessionNote
-- ============================================
DROP POLICY IF EXISTS "SessionNote_select" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_insert" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_update" ON "SessionNote";
DROP POLICY IF EXISTS "SessionNote_delete" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_select_own" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_insert_own" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_update_own" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_delete_own" ON "SessionNote";
DROP POLICY IF EXISTS "Users can view their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can insert their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can update their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can delete their own notes" ON "SessionNote";

-- ============================================
-- STEP 2: Drop ALL duplicate/old policies for SessionFlashcard
-- ============================================
DROP POLICY IF EXISTS "SessionFlashcard_all" ON "SessionFlashcard";
DROP POLICY IF EXISTS "SessionFlashcard_select" ON "SessionFlashcard";
DROP POLICY IF EXISTS "SessionFlashcard_insert" ON "SessionFlashcard";
DROP POLICY IF EXISTS "SessionFlashcard_update" ON "SessionFlashcard";
DROP POLICY IF EXISTS "SessionFlashcard_delete" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_select_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_insert_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_update_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_delete_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can view their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can update their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON "SessionFlashcard";

-- ============================================
-- STEP 3: Create OPTIMIZED RLS Policies for SessionNote
-- Using (select auth.uid()) for performance
-- ============================================
CREATE POLICY "session_note_select_own" ON "SessionNote"
FOR SELECT TO authenticated
USING ((select auth.uid())::text = "userId");

CREATE POLICY "session_note_insert_own" ON "SessionNote"
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "session_note_update_own" ON "SessionNote"
FOR UPDATE TO authenticated
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "session_note_delete_own" ON "SessionNote"
FOR DELETE TO authenticated
USING ((select auth.uid())::text = "userId");

-- ============================================
-- STEP 4: Create OPTIMIZED RLS Policies for SessionFlashcard
-- Using (select auth.uid()) for performance
-- ============================================
CREATE POLICY "session_flashcard_select_own" ON "SessionFlashcard"
FOR SELECT TO authenticated
USING ((select auth.uid())::text = "userId");

CREATE POLICY "session_flashcard_insert_own" ON "SessionFlashcard"
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "session_flashcard_update_own" ON "SessionFlashcard"
FOR UPDATE TO authenticated
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "session_flashcard_delete_own" ON "SessionFlashcard"
FOR DELETE TO authenticated
USING ((select auth.uid())::text = "userId");

-- ============================================
-- STEP 5: Fix function search_path for security
-- ============================================
DROP FUNCTION IF EXISTS update_session_note_last_edited() CASCADE;
DROP FUNCTION IF EXISTS increment_session_note_version() CASCADE;

-- Recreate with secure search_path
CREATE OR REPLACE FUNCTION update_session_note_last_edited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW."lastEditedAt" = NOW();
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION increment_session_note_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS session_note_last_edited_trigger ON "SessionNote";
CREATE TRIGGER session_note_last_edited_trigger
BEFORE UPDATE ON "SessionNote"
FOR EACH ROW
EXECUTE FUNCTION update_session_note_last_edited();

DROP TRIGGER IF EXISTS session_note_version_trigger ON "SessionNote";
CREATE TRIGGER session_note_version_trigger
BEFORE UPDATE ON "SessionNote"
FOR EACH ROW
EXECUTE FUNCTION increment_session_note_version();

-- ============================================
-- STEP 6: Fix search_chunks functions if they exist
-- ============================================
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT p.oid::regprocedure AS func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'search_chunks' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', func_record.func_signature);
  END LOOP;
END $$;

-- ============================================
-- STEP 7: Ensure RLS is enabled
-- ============================================
ALTER TABLE "SessionNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionFlashcard" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionNote" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionFlashcard" TO authenticated;

-- ============================================
-- STEP 9: Analyze tables for query optimizer
-- ============================================
ANALYZE "SessionNote";
ANALYZE "SessionFlashcard";

-- ============================================
-- DONE! All performance and security warnings fixed.
-- ============================================
