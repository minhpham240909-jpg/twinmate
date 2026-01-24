/**
 * Database Backup Script
 *
 * Creates a backup of all database tables before major schema changes.
 * Run this before the PWA transformation to preserve data.
 *
 * Usage: npx ts-node scripts/backup-database.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface BackupResult {
  table: string
  count: number
  success: boolean
  error?: string
}

async function createBackup(): Promise<void> {
  console.log('🔄 Starting database backup...\n')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(process.cwd(), 'backups', timestamp)

  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const results: BackupResult[] = []

  // Tables to backup (grouped by category)
  const tablesToBackup = {
    // Core - KEEP
    users: () => prisma.user.findMany(),
    profiles: () => prisma.profile.findMany(),
    learningProfiles: () => prisma.learningProfile.findMany(),
    userSettings: () => prisma.userSettings.findMany(),
    deviceSessions: () => prisma.deviceSession.findMany(),
    blockedUsers: () => prisma.blockedUser.findMany(),

    // Flashcards - KEEP
    flashcardDecks: () => prisma.flashcardDeck.findMany(),
    flashcardCards: () => prisma.flashcardCard.findMany(),
    flashcardCardProgress: () => prisma.flashcardCardProgress.findMany(),
    flashcardDeckProgress: () => prisma.flashcardDeckProgress.findMany(),
    flashcardStudySessions: () => prisma.flashcardStudySession.findMany(),
    flashcardQuizAttempts: () => prisma.flashcardQuizAttempt.findMany(),

    // AI Partner - KEEP
    aiPartnerPersonas: () => prisma.aIPartnerPersona.findMany(),
    aiPartnerSessions: () => prisma.aIPartnerSession.findMany(),
    aiPartnerMessages: () => prisma.aIPartnerMessage.findMany(),
    aiMemoryEntries: () => prisma.aIMemoryEntry.findMany(),
    aiUserMemory: () => prisma.aIUserMemory.findMany(),
    aiResponseCache: () => prisma.aIResponseCache.findMany(),
    aiUsageLogs: () => prisma.aIUsageLog.findMany(),
    aiUsageDailySummaries: () => prisma.aIUsageDailySummary.findMany(),

    // Admin - KEEP
    adminAuditLogs: () => prisma.adminAuditLog.findMany(),
    announcements: () => prisma.announcement.findMany(),
    announcementDismissals: () => prisma.announcementDismissal.findMany(),
    reports: () => prisma.report.findMany(),
    userWarnings: () => prisma.userWarning.findMany(),
    userBans: () => prisma.userBan.findMany(),
    flaggedContent: () => prisma.flaggedContent.findMany(),
    suspiciousActivityLogs: () => prisma.suspiciousActivityLog.findMany(),

    // Notifications - KEEP
    notifications: () => prisma.notification.findMany(),
    pushSubscriptions: () => prisma.pushSubscription.findMany(),

    // Other - KEEP
    helpMessages: () => prisma.helpMessage.findMany(),
    feedback: () => prisma.feedback.findMany(),
    weeklySummaries: () => prisma.weeklySummary.findMany(),

    // TO BE REMOVED (backing up for safety)
    studySessions: () => prisma.studySession.findMany(),
    sessionParticipants: () => prisma.sessionParticipant.findMany(),
    sessionMessages: () => prisma.sessionMessage.findMany(),
    sessionTimers: () => prisma.sessionTimer.findMany(),
    sessionNotes: () => prisma.sessionNote.findMany(),
    sessionWhiteboards: () => prisma.sessionWhiteboard.findMany(),
    sessionFlashcards: () => prisma.sessionFlashcard.findMany(),

    focusSessions: () => prisma.focusSession.findMany(),
    focusSessionParticipants: () => prisma.focusSessionParticipant.findMany(),

    arenaSessions: () => prisma.arenaSession.findMany(),
    arenaQuestions: () => prisma.arenaQuestion.findMany(),
    arenaAnswers: () => prisma.arenaAnswer.findMany(),
    arenaWeeklyStats: () => prisma.arenaWeeklyStats.findMany(),

    groups: () => prisma.group.findMany(),
    groupMembers: () => prisma.groupMember.findMany(),
    groupInvites: () => prisma.groupInvite.findMany(),

    studyCircles: () => prisma.studyCircle.findMany(),
    studyCaptains: () => prisma.studyCaptain.findMany(),
    studyCircleMembers: () => prisma.studyCircleMember.findMany(),
    circleScheduledSessions: () => prisma.circleScheduledSession.findMany(),
    circleAttendance: () => prisma.circleAttendance.findMany(),

    messages: () => prisma.message.findMany(),
    messageReadStatus: () => prisma.messageReadStatus.findMany(),
    typingIndicators: () => prisma.typingIndicator.findMany(),
    conversationArchives: () => prisma.conversationArchive.findMany(),

    posts: () => prisma.post.findMany(),
    postLikes: () => prisma.postLike.findMany(),
    postComments: () => prisma.postComment.findMany(),
    postReposts: () => prisma.postRepost.findMany(),

    matches: () => prisma.match.findMany(),

    badges: () => prisma.badge.findMany(),
    userBadges: () => prisma.userBadge.findMany(),
    unlockables: () => prisma.unlockable.findMany(),
    userUnlocks: () => prisma.userUnlock.findMany(),
    gamificationEvents: () => prisma.gamificationEvent.findMany(),

    userPresence: () => prisma.userPresence.findMany(),
    userSearchQueries: () => prisma.userSearchQuery.findMany(),
    studyDebts: () => prisma.studyDebt.findMany(),
  }

  // Backup each table
  for (const [tableName, fetchFn] of Object.entries(tablesToBackup)) {
    try {
      console.log(`📦 Backing up ${tableName}...`)
      const data = await fetchFn()
      const filePath = path.join(backupDir, `${tableName}.json`)

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))

      results.push({
        table: tableName,
        count: Array.isArray(data) ? data.length : 0,
        success: true,
      })

      console.log(`   ✅ ${tableName}: ${Array.isArray(data) ? data.length : 0} records`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        table: tableName,
        count: 0,
        success: false,
        error: errorMessage,
      })
      console.log(`   ❌ ${tableName}: ${errorMessage}`)
    }
  }

  // Write summary
  const summary = {
    timestamp,
    backupDir,
    totalTables: results.length,
    successfulBackups: results.filter(r => r.success).length,
    failedBackups: results.filter(r => !r.success).length,
    results,
  }

  fs.writeFileSync(
    path.join(backupDir, '_summary.json'),
    JSON.stringify(summary, null, 2)
  )

  console.log('\n' + '='.repeat(50))
  console.log('📊 BACKUP SUMMARY')
  console.log('='.repeat(50))
  console.log(`📁 Backup directory: ${backupDir}`)
  console.log(`✅ Successful: ${summary.successfulBackups}`)
  console.log(`❌ Failed: ${summary.failedBackups}`)
  console.log(`📦 Total tables: ${summary.totalTables}`)
  console.log('='.repeat(50))

  if (summary.failedBackups > 0) {
    console.log('\n⚠️  Some backups failed. Check the errors above.')
    console.log('This may be because some tables don\'t exist yet.\n')
  } else {
    console.log('\n✅ All backups completed successfully!\n')
  }
}

// Run backup
createBackup()
  .catch((error) => {
    console.error('❌ Backup failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
