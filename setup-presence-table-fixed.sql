-- ============================================
-- CREATE PRESENCE TABLE (FIXED for TEXT IDs)
-- ============================================

-- Create presence table with TEXT user_id (not UUID)
CREATE TABLE IF NOT EXISTS "presence" (
  user_id TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_presence_is_online ON "presence"(is_online);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON "presence"(last_seen);

-- Enable RLS
ALTER TABLE "presence" ENABLE ROW LEVEL SECURITY;

-- Allow everyone to see online status (public info)
CREATE POLICY "Anyone can view presence"
  ON "presence" FOR SELECT
  USING (true);

-- Users can update their own presence
CREATE POLICY "Users can update own presence"
  ON "presence" FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Initialize presence for your 4 existing users (all offline)
INSERT INTO "presence" (user_id, is_online, last_seen, updated_at)
SELECT id, false, NOW(), NOW()
FROM "User"
ON CONFLICT (user_id) DO NOTHING;

-- Verify it worked
SELECT
  'Presence table created successfully!' as message,
  COUNT(*) as total_users,
  SUM(CASE WHEN is_online THEN 1 ELSE 0 END) as online_users,
  SUM(CASE WHEN NOT is_online THEN 1 ELSE 0 END) as offline_users
FROM "presence";
