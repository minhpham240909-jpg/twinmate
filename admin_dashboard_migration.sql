-- =====================================================
-- CLERVA ADMIN DASHBOARD - DATABASE MIGRATION
-- =====================================================
-- Run this in Supabase SQL Editor (https://app.supabase.com)
-- Go to: SQL Editor > New Query > Paste this > Run
-- =====================================================

-- Step 1: Add Admin columns to User table
-- =====================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT FALSE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminGrantedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminGrantedBy" TEXT;

-- Step 2: Create Enums for Admin System
-- =====================================================

-- Announcement Priority Enum
DO $$ BEGIN
    CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Announcement Status Enum
DO $$ BEGIN
    CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report Type Enum
DO $$ BEGIN
    CREATE TYPE "ReportType" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_ACCOUNT', 'SCAM', 'HATE_SPEECH', 'VIOLENCE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report Status Enum
DO $$ BEGIN
    CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ban Type Enum
DO $$ BEGIN
    CREATE TYPE "BanType" AS ENUM ('TEMPORARY', 'PERMANENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create AdminAuditLog table
-- =====================================================
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for AdminAuditLog
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_idx" ON "AdminAuditLog"("targetType");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- Foreign key for AdminAuditLog
ALTER TABLE "AdminAuditLog" DROP CONSTRAINT IF EXISTS "AdminAuditLog_adminId_fkey";
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create Announcement table
-- =====================================================
CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "targetRole" TEXT,
    "showBanner" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- Indexes for Announcement
CREATE INDEX IF NOT EXISTS "Announcement_status_idx" ON "Announcement"("status");
CREATE INDEX IF NOT EXISTS "Announcement_priority_idx" ON "Announcement"("priority");
CREATE INDEX IF NOT EXISTS "Announcement_startsAt_idx" ON "Announcement"("startsAt");
CREATE INDEX IF NOT EXISTS "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- Foreign key for Announcement
ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_createdById_fkey";
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Create AnnouncementDismissal table
-- =====================================================
CREATE TABLE IF NOT EXISTS "AnnouncementDismissal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
ALTER TABLE "AnnouncementDismissal" DROP CONSTRAINT IF EXISTS "AnnouncementDismissal_announcementId_userId_key";
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_userId_key"
    UNIQUE ("announcementId", "userId");

-- Index
CREATE INDEX IF NOT EXISTS "AnnouncementDismissal_userId_idx" ON "AnnouncementDismissal"("userId");

-- Foreign key
ALTER TABLE "AnnouncementDismissal" DROP CONSTRAINT IF EXISTS "AnnouncementDismissal_announcementId_fkey";
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Create Report table
-- =====================================================
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "description" TEXT,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "resolution" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- Indexes for Report
CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report"("reporterId");
CREATE INDEX IF NOT EXISTS "Report_reportedUserId_idx" ON "Report"("reportedUserId");
CREATE INDEX IF NOT EXISTS "Report_contentType_contentId_idx" ON "Report"("contentType", "contentId");
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status");
CREATE INDEX IF NOT EXISTS "Report_type_idx" ON "Report"("type");
CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt");

-- Foreign keys for Report
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_reporterId_fkey";
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_reportedUserId_fkey";
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey"
    FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_handledById_fkey";
ALTER TABLE "Report" ADD CONSTRAINT "Report_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Create UserWarning table
-- =====================================================
CREATE TABLE IF NOT EXISTS "UserWarning" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "reportId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWarning_pkey" PRIMARY KEY ("id")
);

-- Indexes for UserWarning
CREATE INDEX IF NOT EXISTS "UserWarning_userId_idx" ON "UserWarning"("userId");
CREATE INDEX IF NOT EXISTS "UserWarning_issuedById_idx" ON "UserWarning"("issuedById");
CREATE INDEX IF NOT EXISTS "UserWarning_createdAt_idx" ON "UserWarning"("createdAt");

-- Step 8: Create UserBan table
-- =====================================================
CREATE TABLE IF NOT EXISTS "UserBan" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "type" "BanType" NOT NULL,
    "reason" TEXT NOT NULL,
    "reportId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "appealMessage" TEXT,
    "appealedAt" TIMESTAMP(3),
    "appealStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBan_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (one active ban per user)
ALTER TABLE "UserBan" DROP CONSTRAINT IF EXISTS "UserBan_userId_key";
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_userId_key" UNIQUE ("userId");

-- Indexes for UserBan
CREATE INDEX IF NOT EXISTS "UserBan_userId_idx" ON "UserBan"("userId");
CREATE INDEX IF NOT EXISTS "UserBan_issuedById_idx" ON "UserBan"("issuedById");
CREATE INDEX IF NOT EXISTS "UserBan_type_idx" ON "UserBan"("type");
CREATE INDEX IF NOT EXISTS "UserBan_expiresAt_idx" ON "UserBan"("expiresAt");

-- =====================================================
-- DONE! Your admin dashboard tables are now ready.
-- =====================================================
-- Next: Grant yourself admin access by running:
-- UPDATE "User" SET "isAdmin" = true WHERE email = 'YOUR_EMAIL_HERE';
-- =====================================================
