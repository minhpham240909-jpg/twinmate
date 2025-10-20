-- Add school and languages columns to Profile table
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "school" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "languages" TEXT;
