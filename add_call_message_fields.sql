-- Create CallType enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CallStatus enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "CallStatus" AS ENUM ('STARTED', 'COMPLETED', 'MISSED', 'CANCELLED', 'DECLINED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add CALL to MessageType enum (if not already added)
DO $$ BEGIN
    ALTER TYPE "MessageType" ADD VALUE 'CALL';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'CALL value already exists in MessageType enum';
END $$;

-- Add call metadata fields to Message table
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "callType" "CallType";
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "callDuration" INTEGER;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "callStatus" "CallStatus";
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "callStartedAt" TIMESTAMP(3);
