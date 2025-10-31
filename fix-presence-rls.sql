-- ============================================
-- FIX PRESENCE TABLE RLS POLICIES
-- ============================================
-- This fixes the "row violates row-level security policy" error

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "Anyone can view presence" ON "presence";
DROP POLICY IF EXISTS "Users can update own presence" ON "presence";
DROP POLICY IF EXISTS "Users can insert own presence" ON "presence";
DROP POLICY IF EXISTS "Service role can manage presence" ON "presence";

-- Step 2: Create new permissive policies

-- Policy 1: Anyone authenticated can view presence (for matching)
CREATE POLICY "Anyone can view presence"
ON "presence"
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can insert their own presence
CREATE POLICY "Users can insert own presence"
ON "presence"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

-- Policy 3: Users can update their own presence
CREATE POLICY "Users can update own presence"
ON "presence"
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Policy 4: Service role bypasses ALL RLS (most important!)
-- Note: Supabase service_role automatically bypasses RLS
-- But we add this policy as explicit permission
CREATE POLICY "Service role full access"
ON "presence"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 3: Ensure RLS is enabled
ALTER TABLE "presence" ENABLE ROW LEVEL SECURITY;

-- Step 4: Grant necessary permissions
GRANT ALL ON "presence" TO service_role;
GRANT SELECT ON "presence" TO authenticated;
GRANT INSERT, UPDATE ON "presence" TO authenticated;

-- Step 5: Verify policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'presence'
ORDER BY policyname;

-- Step 6: Test query
SELECT 'RLS policies updated successfully!' as status;
