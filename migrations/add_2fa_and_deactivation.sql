-- Migration: Add 2FA and Account Deactivation Support
-- Date: 2025-01-12
-- Description: Adds fields for two-factor authentication and account deactivation to the User table

-- Add deactivation fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;

-- Add 2FA fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "User_deactivatedAt_idx" ON "User"("deactivatedAt");
CREATE INDEX IF NOT EXISTS "User_twoFactorEnabled_idx" ON "User"("twoFactorEnabled");

-- Note: Make sure to update the Prisma schema and run `npx prisma generate` after running this migration
