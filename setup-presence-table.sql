-- ============================================
-- CREATE PRESENCE TABLE FOR ONLINE STATUS
-- ============================================
-- This table tracks which users are online/offline

-- Check if table already exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'presence'
);

-- Create presence table
CREATE TABLE IF NOT EXISTS "presence" (
  user_id UUID PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_presence_is_online ON "presence"(is_online);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON "presence"(last_seen);

-- Enable RLS (Row Level Security)
ALTER TABLE "presence" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see all presence data (public info)
CREATE POLICY "Anyone can view presence"
  ON "presence"
  FOR SELECT
  USING (true);

-- RLS Policy: Users can update their own presence
CREATE POLICY "Users can update own presence"
  ON "presence"
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- RLS Policy: System can insert/update any presence
CREATE POLICY "Service role can manage presence"
  ON "presence"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Initialize presence for existing users (all offline by default)
INSERT INTO "presence" (user_id, is_online, last_seen, updated_at)
SELECT id, false, NOW(), NOW()
FROM "User"
ON CONFLICT (user_id) DO NOTHING;

-- Verify table created
SELECT
  'Presence table created!' as message,
  COUNT(*) as total_users,
  SUM(CASE WHEN is_online THEN 1 ELSE 0 END) as online_users,
  SUM(CASE WHEN NOT is_online THEN 1 ELSE 0 END) as offline_users
FROM "presence";
