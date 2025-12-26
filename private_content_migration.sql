-- ============================================
-- PRIVATE CONTENT MIGRATION
-- Makes Notes and Flashcards private per user
-- Includes RLS security and performance optimizations
-- ============================================
--
-- INCLUDED:
-- 1. SessionNote - Adds userId column + RLS policies (Steps 1-13)
-- 2. SessionFlashcard - Adds RLS policies (Steps 14-18)
--
-- NOT INCLUDED:
-- - Whiteboard: Uses localStorage (client-side), no database changes needed
--
-- ============================================

-- Step 0: Clean up any failed previous attempts (drop UUID column if exists)
-- ============================================
ALTER TABLE "SessionNote" DROP COLUMN IF EXISTS "userId";

-- Step 1: Add userId column to SessionNote table (TEXT type to match User.id)
-- ============================================
ALTER TABLE "SessionNote"
ADD COLUMN "userId" TEXT;

-- Step 2: Set default userId for existing notes (use session creator)
-- ============================================
UPDATE "SessionNote" sn
SET "userId" = ss."createdBy"
FROM "StudySession" ss
WHERE sn."sessionId" = ss.id
AND sn."userId" IS NULL;

-- Step 3: Make userId NOT NULL after populating
-- ============================================
ALTER TABLE "SessionNote"
ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Add foreign key constraint
-- ============================================
ALTER TABLE "SessionNote" DROP CONSTRAINT IF EXISTS "SessionNote_userId_fkey";
ALTER TABLE "SessionNote"
ADD CONSTRAINT "SessionNote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

-- Step 5: Drop old unique constraint (if exists) and create new composite one
-- ============================================
ALTER TABLE "SessionNote" DROP CONSTRAINT IF EXISTS "SessionNote_sessionId_key";
ALTER TABLE "SessionNote" DROP CONSTRAINT IF EXISTS "SessionNote_sessionId_userId_key";

ALTER TABLE "SessionNote"
ADD CONSTRAINT "SessionNote_sessionId_userId_key" UNIQUE ("sessionId", "userId");

-- Step 6: Create indexes for performance
-- ============================================
DROP INDEX IF EXISTS "SessionNote_userId_idx";
DROP INDEX IF EXISTS "SessionNote_sessionId_idx";
DROP INDEX IF EXISTS "SessionNote_sessionId_userId_idx";
DROP INDEX IF EXISTS "SessionNote_lastEditedAt_idx";

CREATE INDEX "SessionNote_userId_idx" ON "SessionNote"("userId");
CREATE INDEX "SessionNote_sessionId_idx" ON "SessionNote"("sessionId");
CREATE INDEX "SessionNote_sessionId_userId_idx" ON "SessionNote"("sessionId", "userId");
CREATE INDEX "SessionNote_lastEditedAt_idx" ON "SessionNote"("lastEditedAt" DESC);

-- Step 7: Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE "SessionNote" ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop existing policies if any
-- ============================================
DROP POLICY IF EXISTS "Users can view their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can insert their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can update their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "Users can delete their own notes" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_select_own" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_insert_own" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_update_own" ON "SessionNote";
DROP POLICY IF EXISTS "session_note_delete_own" ON "SessionNote";

-- Step 9: Create RLS Policies for private notes
-- ============================================
CREATE POLICY "session_note_select_own" ON "SessionNote"
FOR SELECT
USING (auth.uid()::text = "userId");

CREATE POLICY "session_note_insert_own" ON "SessionNote"
FOR INSERT
WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "session_note_update_own" ON "SessionNote"
FOR UPDATE
USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "session_note_delete_own" ON "SessionNote"
FOR DELETE
USING (auth.uid()::text = "userId");

-- Step 10: Create function for auto-updating lastEditedAt
-- ============================================
CREATE OR REPLACE FUNCTION update_session_note_last_edited()
RETURNS TRIGGER AS $$
BEGIN
  NEW."lastEditedAt" = NOW();
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_note_last_edited_trigger ON "SessionNote";
CREATE TRIGGER session_note_last_edited_trigger
BEFORE UPDATE ON "SessionNote"
FOR EACH ROW
EXECUTE FUNCTION update_session_note_last_edited();

-- Step 11: Add version increment function for optimistic locking
-- ============================================
CREATE OR REPLACE FUNCTION increment_session_note_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_note_version_trigger ON "SessionNote";
CREATE TRIGGER session_note_version_trigger
BEFORE UPDATE ON "SessionNote"
FOR EACH ROW
EXECUTE FUNCTION increment_session_note_version();

-- Step 12: Grant necessary permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionNote" TO authenticated;

-- Step 13: Analyze table for query optimizer
-- ============================================
ANALYZE "SessionNote";

-- ============================================
-- FLASHCARDS RLS SECURITY
-- SessionFlashcard already has userId, just add RLS
-- ============================================

-- Step 14: Enable Row Level Security for Flashcards
-- ============================================
ALTER TABLE "SessionFlashcard" ENABLE ROW LEVEL SECURITY;

-- Step 15: Drop existing flashcard policies if any
-- ============================================
DROP POLICY IF EXISTS "Users can view their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can update their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_select_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_insert_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_update_own" ON "SessionFlashcard";
DROP POLICY IF EXISTS "session_flashcard_delete_own" ON "SessionFlashcard";

-- Step 16: Create RLS Policies for private flashcards
-- ============================================
CREATE POLICY "session_flashcard_select_own" ON "SessionFlashcard"
FOR SELECT
USING (auth.uid()::text = "userId");

CREATE POLICY "session_flashcard_insert_own" ON "SessionFlashcard"
FOR INSERT
WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "session_flashcard_update_own" ON "SessionFlashcard"
FOR UPDATE
USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "session_flashcard_delete_own" ON "SessionFlashcard"
FOR DELETE
USING (auth.uid()::text = "userId");

-- Step 17: Create indexes for flashcard performance
-- ============================================
CREATE INDEX IF NOT EXISTS "SessionFlashcard_userId_idx" ON "SessionFlashcard"("userId");
CREATE INDEX IF NOT EXISTS "SessionFlashcard_sessionId_userId_idx" ON "SessionFlashcard"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "SessionFlashcard_nextReviewDate_idx" ON "SessionFlashcard"("nextReviewDate");

-- Step 18: Grant permissions for flashcards
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "SessionFlashcard" TO authenticated;

ANALYZE "SessionFlashcard";

-- ============================================
-- DONE! Migration completed successfully.
-- ============================================
