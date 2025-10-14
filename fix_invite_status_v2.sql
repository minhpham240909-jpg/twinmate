-- Fix missing InviteStatus enum type (Version 2 - handles existing columns)
-- This script safely migrates the status column to use the InviteStatus enum

-- Step 1: Create the enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteStatus') THEN
        CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
    END IF;
END $$;

-- Step 2: Migrate the GroupInvite table's status column
DO $$
BEGIN
    -- Check if GroupInvite table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'GroupInvite'
    ) THEN
        -- Check if status column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'GroupInvite'
            AND column_name = 'status'
        ) THEN
            -- Step 2a: Drop the default constraint first
            ALTER TABLE "GroupInvite"
            ALTER COLUMN "status" DROP DEFAULT;

            -- Step 2b: Convert existing data and change column type
            ALTER TABLE "GroupInvite"
            ALTER COLUMN "status" TYPE "InviteStatus"
            USING "status"::text::"InviteStatus";

            -- Step 2c: Add back the default constraint using the enum
            ALTER TABLE "GroupInvite"
            ALTER COLUMN "status" SET DEFAULT 'PENDING'::"InviteStatus";
        END IF;
    END IF;
END $$;
