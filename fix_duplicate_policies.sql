-- =====================================================
-- FIX DUPLICATE/OLD POLICIES
-- =====================================================
-- This script removes OLD policies that are causing
-- "multiple_permissive_policies" warnings
-- =====================================================

-- =====================================================
-- 1. FIX GROUPMEMBER - Remove old individual policies
-- =====================================================

DROP POLICY IF EXISTS "Group admins can add members" ON "GroupMember";
DROP POLICY IF EXISTS "Group admins can update members" ON "GroupMember";
DROP POLICY IF EXISTS "Group admins can remove members" ON "GroupMember";

-- The "Group owners and admins can manage members" policy handles all of these

-- =====================================================
-- 2. FIX LEARNINGPROFILE - Remove old multi-policy structure
-- =====================================================

DROP POLICY IF EXISTS "Users can view own learning profile" ON "LearningProfile";
DROP POLICY IF EXISTS "Users can view others' learning profiles for matching" ON "LearningProfile";
DROP POLICY IF EXISTS "Users can insert own learning profile" ON "LearningProfile";
DROP POLICY IF EXISTS "Users can update own learning profile" ON "LearningProfile";
DROP POLICY IF EXISTS "Users can delete own learning profile" ON "LearningProfile";
DROP POLICY IF EXISTS "Service role can manage all learning profiles" ON "LearningProfile";

-- Now create the OPTIMIZED consolidated policies
CREATE POLICY "learning_profile_select_policy"
  ON "LearningProfile"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "learning_profile_insert_policy"
  ON "LearningProfile"
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "learning_profile_update_policy"
  ON "LearningProfile"
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid())::text = "userId")
  WITH CHECK ((select auth.uid())::text = "userId");

CREATE POLICY "learning_profile_delete_policy"
  ON "LearningProfile"
  FOR DELETE
  TO authenticated
  USING ((select auth.uid())::text = "userId");

-- =====================================================
-- DONE!
-- =====================================================
-- Duplicate policies removed
-- Now run the linter again - warnings should be reduced!
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Duplicate policies cleaned up!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Fixed Tables:';
  RAISE NOTICE '  ✓ GroupMember - removed 3 duplicate policies';
  RAISE NOTICE '  ✓ LearningProfile - consolidated to 4 optimal policies';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Next: Run fix_ai_agent_rls.sql to fix remaining warnings';
END $$;
