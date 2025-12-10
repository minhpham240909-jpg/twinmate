-- Add searchCriteria column to AIPartnerSession table
ALTER TABLE "AIPartnerSession" ADD COLUMN IF NOT EXISTS "searchCriteria" JSONB;
