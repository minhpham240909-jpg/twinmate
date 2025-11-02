-- ==========================================
-- Add age and role fields to Profile table
-- ==========================================

-- Add new columns
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "age" INTEGER,
ADD COLUMN IF NOT EXISTS "role" TEXT;

-- Add comments for documentation
COMMENT ON COLUMN "Profile"."age" IS 'User age';
COMMENT ON COLUMN "Profile"."role" IS 'User role/position (e.g., Student, Software Engineer)';

-- ==========================================
-- Row Level Security (RLS) Policies
-- ==========================================

-- Enable RLS if not already enabled
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Users can view all profiles" ON "Profile";
DROP POLICY IF EXISTS "Users can insert their own profile" ON "Profile";
DROP POLICY IF EXISTS "Users can update their own profile" ON "Profile";
DROP POLICY IF EXISTS "Users can delete their own profile" ON "Profile";

-- Policy 1: Users can view ALL profiles (for partner matching)
CREATE POLICY "Users can view all profiles"
ON "Profile"
FOR SELECT
USING (true);

-- Policy 2: Users can insert their own profile (optimized)
CREATE POLICY "Users can insert their own profile"
ON "Profile"
FOR INSERT
WITH CHECK ((select auth.uid())::text = "userId");

-- Policy 3: Users can update their own profile (including age and role) (optimized)
CREATE POLICY "Users can update their own profile"
ON "Profile"
FOR UPDATE
USING ((select auth.uid())::text = "userId")
WITH CHECK ((select auth.uid())::text = "userId");

-- Policy 4: Users can delete their own profile (optimized)
CREATE POLICY "Users can delete their own profile"
ON "Profile"
FOR DELETE
USING ((select auth.uid())::text = "userId");

-- ==========================================
-- Grant permissions to authenticated users
-- ==========================================

GRANT SELECT ON "Profile" TO authenticated;
GRANT INSERT ON "Profile" TO authenticated;
GRANT UPDATE ON "Profile" TO authenticated;
GRANT DELETE ON "Profile" TO authenticated;
