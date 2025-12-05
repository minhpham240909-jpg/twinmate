-- Migration: Preserve messages when users delete their accounts
-- This allows admin dashboard to still view messages from deleted users

-- Step 1: Add new columns to store cached sender/recipient info
ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderEmail" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT,
ADD COLUMN IF NOT EXISTS "recipientName" TEXT,
ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;

-- Step 2: Make senderId nullable (to allow SET NULL on delete)
ALTER TABLE "Message"
ALTER COLUMN "senderId" DROP NOT NULL;

-- Step 3: Drop the existing foreign key constraint with CASCADE
ALTER TABLE "Message"
DROP CONSTRAINT IF EXISTS "Message_senderId_fkey";

-- Step 4: Add new foreign key constraint with SET NULL instead of CASCADE
ALTER TABLE "Message"
ADD CONSTRAINT "Message_senderId_fkey"
FOREIGN KEY ("senderId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 5: Backfill existing messages with sender info (for messages already in DB)
-- This ensures old messages still show sender info after user deletion
UPDATE "Message" m
SET
  "senderName" = u."name",
  "senderEmail" = u."email",
  "senderAvatarUrl" = u."avatarUrl"
FROM "User" u
WHERE m."senderId" = u."id"
AND m."senderName" IS NULL;

-- Step 6: Backfill recipient info for DMs
UPDATE "Message" m
SET
  "recipientName" = u."name",
  "recipientEmail" = u."email"
FROM "User" u
WHERE m."recipientId" = u."id"
AND m."recipientName" IS NULL
AND m."recipientId" IS NOT NULL;

-- Step 7: Add indexes for efficient searching by cached sender info (admin dashboard)
CREATE INDEX IF NOT EXISTS "Message_senderName_idx" ON "Message"("senderName");
CREATE INDEX IF NOT EXISTS "Message_senderEmail_idx" ON "Message"("senderEmail");

-- Verify the changes
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'Message'
-- AND column_name IN ('senderId', 'senderName', 'senderEmail', 'senderAvatarUrl', 'recipientName', 'recipientEmail');
