-- Add Content Moderation Tables

-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE "ContentType" AS ENUM ('DIRECT_MESSAGE', 'GROUP_MESSAGE', 'SESSION_MESSAGE', 'POST', 'COMMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REMOVED', 'WARNING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "FlagReason" AS ENUM ('AI_DETECTED', 'USER_REPORTED', 'KEYWORD_MATCH', 'MANUAL_REVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create flagged_content table
CREATE TABLE IF NOT EXISTS "flagged_content" (
    "id" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "conversationId" TEXT,
    "conversationType" TEXT,
    "flagReason" "FlagReason" NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiCategories" JSONB,
    "aiScore" DOUBLE PRECISION,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flagged_content_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "flagged_content_status_idx" ON "flagged_content"("status");
CREATE INDEX IF NOT EXISTS "flagged_content_contentType_idx" ON "flagged_content"("contentType");
CREATE INDEX IF NOT EXISTS "flagged_content_senderId_idx" ON "flagged_content"("senderId");
CREATE INDEX IF NOT EXISTS "flagged_content_flaggedAt_idx" ON "flagged_content"("flaggedAt");
CREATE INDEX IF NOT EXISTS "flagged_content_contentType_status_idx" ON "flagged_content"("contentType", "status");

-- Update trigger for updatedAt
CREATE OR REPLACE FUNCTION update_flagged_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS flagged_content_updated_at ON "flagged_content";
CREATE TRIGGER flagged_content_updated_at
    BEFORE UPDATE ON "flagged_content"
    FOR EACH ROW
    EXECUTE FUNCTION update_flagged_content_updated_at();

SELECT 'Content moderation tables created successfully!' as result;
