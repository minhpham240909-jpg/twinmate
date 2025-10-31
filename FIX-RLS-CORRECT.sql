-- ============================================
-- CORRECT FIX FOR PRESENCE RLS ISSUE
-- ============================================
-- The issue: user_id is TEXT but auth.uid() is UUID
-- Solution: Cast both to text for comparison

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "Anyone can view presence" ON "presence";
DROP POLICY IF EXISTS "Users can update own presence" ON "presence";
DROP POLICY IF EXISTS "Users can insert own presence" ON "presence";
DROP POLICY IF EXISTS "Service role can manage presence" ON "presence";
DROP POLICY IF EXISTS "Service role full access" ON "presence";

-- Step 2: Create CORRECT policies with proper type casting

-- Policy 1: Anyone can view (for matching)
CREATE POLICY "Anyone can view presence"
ON "presence"
FOR SELECT
USING (true);

-- Policy 2: Users can insert their own presence (WITH CORRECT CASTING)
CREATE POLICY "Users can insert own presence"
ON "presence"
FOR INSERT
WITH CHECK (
    -- Cast UUID to TEXT for comparison
    auth.uid()::text = user_id
);

-- Policy 3: Users can update their own presence (WITH CORRECT CASTING)
CREATE POLICY "Users can update own presence"
ON "presence"
FOR UPDATE
USING (
    -- Cast UUID to TEXT for comparison
    auth.uid()::text = user_id
)
WITH CHECK (
    -- Cast UUID to TEXT for comparison
    auth.uid()::text = user_id
);

-- Policy 4: Allow upsert (INSERT OR UPDATE)
-- This is important for the heartbeat which uses upsert
CREATE POLICY "Users can upsert own presence"
ON "presence"
FOR ALL
USING (
    auth.uid()::text = user_id
)
WITH CHECK (
    auth.uid()::text = user_id
);

-- Step 3: Verify policies created
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'presence'
ORDER BY policyname;

-- Step 4: Test with a sample user
-- This should now work without errors
SELECT 'RLS policies fixed with correct type casting!' as status;
