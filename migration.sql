-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "public"."OnlineStatus" AS ENUM ('ONLINE', 'BUSY', 'OFFLINE', 'LOOKING_FOR_PARTNER');

-- CreateEnum
CREATE TYPE "public"."SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "public"."StudyStyle" AS ENUM ('VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'COLLABORATIVE', 'SOLO');

-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."GroupPrivacy" AS ENUM ('PUBLIC', 'PRIVATE', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "public"."MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."SessionType" AS ENUM ('SOLO', 'ONE_ON_ONE', 'GROUP');

-- CreateEnum
CREATE TYPE "public"."BadgeType" AS ENUM ('STUDY_STREAK', 'HOURS_LOGGED', 'PARTNERSHIPS', 'QUIZZES_PASSED', 'SPECIAL');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('MATCH_REQUEST', 'MATCH_ACCEPTED', 'NEW_MESSAGE', 'GROUP_INVITE', 'STUDY_REMINDER', 'BADGE_EARNED', 'STREAK_REMINDER');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'FREE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "googleId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "timezone" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "subjects" TEXT[],
    "interests" TEXT[],
    "goals" TEXT[],
    "skillLevel" "public"."SkillLevel" NOT NULL DEFAULT 'BEGINNER',
    "studyStyle" "public"."StudyStyle" NOT NULL DEFAULT 'COLLABORATIVE',
    "availableDays" TEXT[],
    "availableHours" TEXT[],
    "onlineStatus" "public"."OnlineStatus" NOT NULL DEFAULT 'OFFLINE',
    "isLookingForPartner" BOOLEAN NOT NULL DEFAULT false,
    "showLocation" BOOLEAN NOT NULL DEFAULT false,
    "showEmail" BOOLEAN NOT NULL DEFAULT false,
    "studyStreak" INTEGER NOT NULL DEFAULT 0,
    "totalStudyHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastStudyDate" TIMESTAMP(3),
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "compatibilityScore" DOUBLE PRECISION,
    "matchReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "privacy" "public"."GroupPrivacy" NOT NULL DEFAULT 'PUBLIC',
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."MemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "senderId" TEXT NOT NULL,
    "groupId" TEXT,
    "recipientId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Add CHECK constraint to ensure exactly one of groupId or recipientId is set
ALTER TABLE "public"."Message"
ADD CONSTRAINT "Message_recipient_type_check"
CHECK (
  ("groupId" IS NOT NULL AND "recipientId" IS NULL) OR
  ("groupId" IS NULL AND "recipientId" IS NOT NULL)
);

-- CreateTable
CREATE TABLE "public"."StudySession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."SessionType" NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "aiSummary" TEXT,
    "aiKeyPoints" TEXT[],
    "aiTodos" TEXT[],
    "roomId" TEXT,
    "recordingUrl" TEXT,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "public"."BadgeType" NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "requirement" INTEGER NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "public"."User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "public"."User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "public"."User"("googleId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "public"."Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "public"."Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_subjects_idx" ON "public"."Profile"("subjects");

-- CreateIndex
CREATE INDEX "Profile_interests_idx" ON "public"."Profile"("interests");

-- CreateIndex
CREATE INDEX "Profile_onlineStatus_idx" ON "public"."Profile"("onlineStatus");

-- CreateIndex
CREATE INDEX "Match_senderId_status_idx" ON "public"."Match"("senderId", "status");

-- CreateIndex
CREATE INDEX "Match_receiverId_status_idx" ON "public"."Match"("receiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_senderId_receiverId_key" ON "public"."Match"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "Group_subject_idx" ON "public"."Group"("subject");

-- CreateIndex
CREATE INDEX "Group_privacy_idx" ON "public"."Group"("privacy");

-- CreateIndex
CREATE INDEX "Group_ownerId_idx" ON "public"."Group"("ownerId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "public"."GroupMember"("userId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "public"."GroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "public"."GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "public"."Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_groupId_idx" ON "public"."Message"("groupId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "public"."Message"("recipientId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "public"."Message"("createdAt");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "public"."StudySession"("userId");

-- CreateIndex
CREATE INDEX "StudySession_startedAt_idx" ON "public"."StudySession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "public"."Badge"("name");

-- CreateIndex
CREATE INDEX "Badge_type_idx" ON "public"."Badge"("type");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "public"."UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "public"."UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "public"."Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "public"."Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "public"."Session"("token");

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

