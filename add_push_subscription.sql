-- =====================================================
-- PushSubscription Table for Web Push Notifications
-- Run this on Supabase SQL Editor
-- =====================================================

-- Create the table
-- Note: userId is TEXT to match User.id type
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "endpoint" TEXT NOT NULL UNIQUE,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance (prevents RLS performance warnings)
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX IF NOT EXISTS "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_isActive_idx" ON "PushSubscription"("isActive");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_isActive_idx" ON "PushSubscription"("userId", "isActive");

-- Enable Row Level Security
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON "PushSubscription";
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON "PushSubscription";
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON "PushSubscription";
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON "PushSubscription";
DROP POLICY IF EXISTS "Service role has full access to push subscriptions" ON "PushSubscription";

-- RLS Policy: Users can only view their own subscriptions
CREATE POLICY "Users can view their own push subscriptions"
ON "PushSubscription"
FOR SELECT
TO authenticated
USING ("userId" = auth.uid()::TEXT);

-- RLS Policy: Users can only insert their own subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
ON "PushSubscription"
FOR INSERT
TO authenticated
WITH CHECK ("userId" = auth.uid()::TEXT);

-- RLS Policy: Users can only update their own subscriptions
CREATE POLICY "Users can update their own push subscriptions"
ON "PushSubscription"
FOR UPDATE
TO authenticated
USING ("userId" = auth.uid()::TEXT)
WITH CHECK ("userId" = auth.uid()::TEXT);

-- RLS Policy: Users can only delete their own subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
ON "PushSubscription"
FOR DELETE
TO authenticated
USING ("userId" = auth.uid()::TEXT);

-- RLS Policy: Service role has full access (for server-side operations)
CREATE POLICY "Service role has full access to push subscriptions"
ON "PushSubscription"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create trigger for updatedAt
CREATE OR REPLACE FUNCTION update_push_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_push_subscription_timestamp ON "PushSubscription";

CREATE TRIGGER update_push_subscription_timestamp
    BEFORE UPDATE ON "PushSubscription"
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscription_updated_at();

-- Grant permissions
GRANT ALL ON "PushSubscription" TO authenticated;
GRANT ALL ON "PushSubscription" TO service_role;

-- =====================================================
-- Also add the new NotificationType enum values if not exists
-- =====================================================

-- Check if POST_LIKE exists, if not alter the enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'POST_LIKE'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    ) THEN
        ALTER TYPE "NotificationType" ADD VALUE 'POST_LIKE';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'POST_COMMENT'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    ) THEN
        ALTER TYPE "NotificationType" ADD VALUE 'POST_COMMENT';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'POST_REPOST'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    ) THEN
        ALTER TYPE "NotificationType" ADD VALUE 'POST_REPOST';
    END IF;
END
$$;

-- =====================================================
-- Verify the setup
-- =====================================================
SELECT
    'PushSubscription table created' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'PushSubscription') as table_exists,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'PushSubscription') as index_count,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'PushSubscription') as policy_count;
