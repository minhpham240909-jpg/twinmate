-- ================================================
-- USER SETTINGS - Complete Settings System
-- ================================================
-- This migration adds comprehensive user settings with RLS policies
-- Includes all setting categories for the app

-- Create UserSettings table
CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  
  -- ==========================================
  -- ACCOUNT & PROFILE SETTINGS
  -- ==========================================
  "language" TEXT DEFAULT 'en', -- Interface language
  "timezone" TEXT DEFAULT 'UTC',
  
  -- ==========================================
  -- PRIVACY & VISIBILITY SETTINGS
  -- ==========================================
  "profileVisibility" TEXT DEFAULT 'EVERYONE', -- EVERYONE, CONNECTIONS_ONLY, PRIVATE
  "searchVisibility" BOOLEAN DEFAULT true, -- Appear in partner search
  "showOnlineStatus" BOOLEAN DEFAULT true, -- Show when online
  "showLastSeen" BOOLEAN DEFAULT true, -- Show last active time
  "dataSharing" TEXT DEFAULT 'STANDARD', -- MINIMAL, STANDARD, FULL
  
  -- ==========================================
  -- NOTIFICATION PREFERENCES
  -- ==========================================
  -- In-App Notifications
  "notifyConnectionRequests" BOOLEAN DEFAULT true,
  "notifyConnectionAccepted" BOOLEAN DEFAULT true,
  "notifySessionInvites" BOOLEAN DEFAULT true,
  "notifyGroupInvites" BOOLEAN DEFAULT true,
  "notifyMessages" BOOLEAN DEFAULT true,
  "notifyMissedCalls" BOOLEAN DEFAULT true,
  "notifyCommunityActivity" BOOLEAN DEFAULT true, -- Likes, comments, mentions
  "notifySessionReminders" BOOLEAN DEFAULT true,
  
  -- Email Notifications
  "emailConnectionRequests" BOOLEAN DEFAULT true,
  "emailSessionInvites" BOOLEAN DEFAULT true,
  "emailMessages" BOOLEAN DEFAULT false,
  "emailWeeklySummary" BOOLEAN DEFAULT true,
  
  -- Notification Frequency
  "notificationFrequency" TEXT DEFAULT 'REALTIME', -- REALTIME, DIGEST_DAILY, DIGEST_WEEKLY, OFF
  
  -- Do Not Disturb
  "doNotDisturbEnabled" BOOLEAN DEFAULT false,
  "doNotDisturbStart" TEXT, -- e.g., "22:00"
  "doNotDisturbEnd" TEXT, -- e.g., "08:00"
  
  -- ==========================================
  -- STUDY PREFERENCES
  -- ==========================================
  "defaultStudyDuration" INTEGER DEFAULT 25, -- minutes
  "defaultBreakDuration" INTEGER DEFAULT 5, -- minutes
  "preferredSessionLength" INTEGER DEFAULT 60, -- minutes
  "autoGenerateQuizzes" BOOLEAN DEFAULT false,
  "flashcardReviewFrequency" TEXT DEFAULT 'DAILY', -- DAILY, WEEKLY, CUSTOM
  
  -- ==========================================
  -- COMMUNICATION SETTINGS
  -- ==========================================
  "messageReadReceipts" BOOLEAN DEFAULT true,
  "typingIndicators" BOOLEAN DEFAULT true,
  "autoDownloadMedia" BOOLEAN DEFAULT true,
  "videoQuality" TEXT DEFAULT 'AUTO', -- AUTO, LOW, MEDIUM, HIGH
  "audioQuality" TEXT DEFAULT 'AUTO', -- AUTO, LOW, MEDIUM, HIGH
  "enableVirtualBackground" BOOLEAN DEFAULT false,
  
  -- Call Settings
  "autoAnswerFromPartners" BOOLEAN DEFAULT false,
  "callRingtone" TEXT DEFAULT 'default',
  
  -- ==========================================
  -- STUDY SESSION SETTINGS
  -- ==========================================
  "autoStartTimer" BOOLEAN DEFAULT false,
  "breakReminders" BOOLEAN DEFAULT true,
  "sessionHistoryRetention" INTEGER DEFAULT 90, -- days
  "sessionInvitePrivacy" TEXT DEFAULT 'EVERYONE', -- EVERYONE, CONNECTIONS, NOBODY
  
  -- ==========================================
  -- GROUP SETTINGS
  -- ==========================================
  "defaultGroupPrivacy" TEXT DEFAULT 'PUBLIC', -- PUBLIC, PRIVATE, INVITE_ONLY
  "groupNotifications" BOOLEAN DEFAULT true,
  "autoJoinMatchingGroups" BOOLEAN DEFAULT false,
  "groupInvitePrivacy" TEXT DEFAULT 'EVERYONE', -- EVERYONE, CONNECTIONS, NOBODY
  
  -- ==========================================
  -- CONTENT & COMMUNITY SETTINGS
  -- ==========================================
  "feedAlgorithm" TEXT DEFAULT 'RECOMMENDED', -- RECOMMENDED, CHRONOLOGICAL, TRENDING
  "showTrendingTopics" BOOLEAN DEFAULT true,
  "commentPrivacy" TEXT DEFAULT 'EVERYONE', -- EVERYONE, CONNECTIONS, NOBODY
  "tagPrivacy" TEXT DEFAULT 'EVERYONE', -- EVERYONE, CONNECTIONS, NOBODY
  "contentFiltering" TEXT[], -- Array of filtered keywords
  
  -- ==========================================
  -- ACCESSIBILITY SETTINGS
  -- ==========================================
  "theme" TEXT DEFAULT 'SYSTEM', -- LIGHT, DARK, SYSTEM
  "fontSize" TEXT DEFAULT 'MEDIUM', -- SMALL, MEDIUM, LARGE, XLARGE
  "highContrast" BOOLEAN DEFAULT false,
  "reducedMotion" BOOLEAN DEFAULT false,
  "keyboardShortcuts" BOOLEAN DEFAULT true,
  "colorBlindMode" TEXT DEFAULT 'NONE', -- NONE, PROTANOPIA, DEUTERANOPIA, TRITANOPIA
  
  -- ==========================================
  -- DATA & STORAGE SETTINGS
  -- ==========================================
  "cacheEnabled" BOOLEAN DEFAULT true,
  "autoBackup" BOOLEAN DEFAULT true,
  "storageUsageLimit" INTEGER DEFAULT 1000, -- MB
  
  -- ==========================================
  -- INTEGRATIONS
  -- ==========================================
  "googleCalendarSync" BOOLEAN DEFAULT false,
  "googleCalendarId" TEXT,
  
  -- ==========================================
  -- ADVANCED SETTINGS
  -- ==========================================
  "developerMode" BOOLEAN DEFAULT false,
  "betaFeatures" BOOLEAN DEFAULT false,
  "performanceMode" TEXT DEFAULT 'BALANCED', -- LOW_POWER, BALANCED, PERFORMANCE
  "analyticsEnabled" BOOLEAN DEFAULT true,
  
  -- Timestamps
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Create index on userId for fast lookups
CREATE INDEX IF NOT EXISTS "UserSettings_userId_idx" ON "UserSettings"("userId");

-- ==========================================
-- BLOCKED USERS TABLE
-- ==========================================
-- For privacy settings - users can block other users
CREATE TABLE IF NOT EXISTS "BlockedUser" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "blockedUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "BlockedUser_unique" UNIQUE ("userId", "blockedUserId")
);

CREATE INDEX IF NOT EXISTS "BlockedUser_userId_idx" ON "BlockedUser"("userId");
CREATE INDEX IF NOT EXISTS "BlockedUser_blockedUserId_idx" ON "BlockedUser"("blockedUserId");

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on UserSettings
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view only their own settings
CREATE POLICY "Users can view own settings"
  ON "UserSettings"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON "UserSettings"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- Policy: Users can update only their own settings
CREATE POLICY "Users can update own settings"
  ON "UserSettings"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

-- Policy: Users can delete their own settings
CREATE POLICY "Users can delete own settings"
  ON "UserSettings"
  FOR DELETE
  USING (auth.uid()::text = "userId");

-- Enable RLS on BlockedUser
ALTER TABLE "BlockedUser" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own blocked users list
CREATE POLICY "Users can view own blocked users"
  ON "BlockedUser"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Policy: Users can block other users
CREATE POLICY "Users can block other users"
  ON "BlockedUser"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- Policy: Users can unblock users they blocked
CREATE POLICY "Users can unblock users"
  ON "BlockedUser"
  FOR DELETE
  USING (auth.uid()::text = "userId");

-- ==========================================
-- FUNCTION: Auto-update updatedAt timestamp
-- ==========================================
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updatedAt
DROP TRIGGER IF EXISTS update_user_settings_timestamp ON "UserSettings";
CREATE TRIGGER update_user_settings_timestamp
  BEFORE UPDATE ON "UserSettings"
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- ==========================================
-- DEFAULT SETTINGS FOR EXISTING USERS
-- ==========================================
-- Create default settings for all existing users who don't have settings yet
INSERT INTO "UserSettings" ("userId")
SELECT "id" FROM "User"
WHERE "id" NOT IN (SELECT "userId" FROM "UserSettings")
ON CONFLICT ("userId") DO NOTHING;

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================
-- Grant authenticated users access to their settings
GRANT SELECT, INSERT, UPDATE, DELETE ON "UserSettings" TO authenticated;
GRANT SELECT, INSERT, DELETE ON "BlockedUser" TO authenticated;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================
COMMENT ON TABLE "UserSettings" IS 'Comprehensive user settings for all app features';
COMMENT ON TABLE "BlockedUser" IS 'Users blocked by the current user for privacy';
COMMENT ON COLUMN "UserSettings"."profileVisibility" IS 'Who can view the user profile: EVERYONE, CONNECTIONS_ONLY, PRIVATE';
COMMENT ON COLUMN "UserSettings"."searchVisibility" IS 'Whether user appears in partner search results';
COMMENT ON COLUMN "UserSettings"."doNotDisturbStart" IS 'DND start time in 24h format, e.g. 22:00';
COMMENT ON COLUMN "UserSettings"."doNotDisturbEnd" IS 'DND end time in 24h format, e.g. 08:00';

