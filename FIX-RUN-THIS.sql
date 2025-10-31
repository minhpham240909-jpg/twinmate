-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
-- This adds the missing current_activity column

-- Add the missing column
ALTER TABLE "presence"
ADD COLUMN IF NOT EXISTS current_activity TEXT DEFAULT 'available';

-- Initialize for existing users
UPDATE "presence"
SET current_activity = 'available'
WHERE current_activity IS NULL;

-- Verify it worked
SELECT
    'Success! Presence table fixed' as status,
    COUNT(*) as total_users,
    COUNT(current_activity) as users_with_activity
FROM "presence";
