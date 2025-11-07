-- Add postUrl column to Post table
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "postUrl" TEXT;
