import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Notification Cleanup Cron Job
 * 
 * Schedule: Daily (recommended to run at off-peak hours like 3 AM)
 * 
 * This endpoint cleans up old notifications to prevent table bloat
 * and maintain query performance.
 * 
 * Actions:
 * 1. Delete read notifications older than 30 days
 * 2. Delete unread notifications older than 90 days
 * 3. Archive important notifications before deletion (optional)
 * 
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-notifications",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 */

// Configuration
const READ_NOTIFICATIONS_MAX_AGE_DAYS = 30
const UNREAD_NOTIFICATIONS_MAX_AGE_DAYS = 90
const BATCH_SIZE = 1000 // Delete in batches to avoid timeouts

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      console.error('[Notification Cleanup] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Notification Cleanup] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const startTime = Date.now()
    const results = {
      readNotificationsDeleted: 0,
      unreadNotificationsDeleted: 0,
      dismissedAnnouncementsDeleted: 0,
      errors: [] as string[],
    }

    // Calculate cutoff dates
    const readCutoff = new Date()
    readCutoff.setDate(readCutoff.getDate() - READ_NOTIFICATIONS_MAX_AGE_DAYS)

    const unreadCutoff = new Date()
    unreadCutoff.setDate(unreadCutoff.getDate() - UNREAD_NOTIFICATIONS_MAX_AGE_DAYS)

    // 1. Delete old READ notifications (30+ days)
    try {
      let deletedCount = 0
      let hasMore = true

      while (hasMore) {
        const deleted = await prisma.notification.deleteMany({
          where: {
            isRead: true,
            createdAt: { lt: readCutoff },
          },
        })

        deletedCount += deleted.count
        hasMore = deleted.count === BATCH_SIZE

        // Safety limit to prevent infinite loops
        if (deletedCount > 100000) {
          console.warn('[Notification Cleanup] Hit safety limit for read notifications')
          break
        }
      }

      results.readNotificationsDeleted = deletedCount
      console.info(`[Notification Cleanup] Deleted ${deletedCount} read notifications older than ${READ_NOTIFICATIONS_MAX_AGE_DAYS} days`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Read notifications: ${message}`)
      console.error('[Notification Cleanup] Error deleting read notifications:', error)
    }

    // 2. Delete very old UNREAD notifications (90+ days)
    // These are likely abandoned and will never be read
    try {
      let deletedCount = 0
      let hasMore = true

      while (hasMore) {
        const deleted = await prisma.notification.deleteMany({
          where: {
            isRead: false,
            createdAt: { lt: unreadCutoff },
          },
        })

        deletedCount += deleted.count
        hasMore = deleted.count === BATCH_SIZE

        if (deletedCount > 50000) {
          console.warn('[Notification Cleanup] Hit safety limit for unread notifications')
          break
        }
      }

      results.unreadNotificationsDeleted = deletedCount
      console.info(`[Notification Cleanup] Deleted ${deletedCount} unread notifications older than ${UNREAD_NOTIFICATIONS_MAX_AGE_DAYS} days`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Unread notifications: ${message}`)
      console.error('[Notification Cleanup] Error deleting unread notifications:', error)
    }

    // 3. Clean up old announcement dismissals for expired announcements
    try {
      // Get IDs of expired announcements
      const expiredAnnouncements = await prisma.announcement.findMany({
        where: {
          OR: [
            { status: 'ARCHIVED' },
            { 
              status: 'ACTIVE',
              expiresAt: { lt: new Date() }
            }
          ]
        },
        select: { id: true }
      })

      const expiredIds = expiredAnnouncements.map(a => a.id)

      if (expiredIds.length > 0) {
        const deleted = await prisma.announcementDismissal.deleteMany({
          where: {
            announcementId: { in: expiredIds }
          }
        })

        results.dismissedAnnouncementsDeleted = deleted.count
        console.info(`[Notification Cleanup] Deleted ${deleted.count} announcement dismissals for expired announcements`)
      }
    } catch (error) {
      // This might fail if announcement tables don't exist yet
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!message.includes('does not exist')) {
        results.errors.push(`Announcement dismissals: ${message}`)
        console.error('[Notification Cleanup] Error cleaning announcement dismissals:', error)
      }
    }

    const duration = Date.now() - startTime

    console.info(`[Notification Cleanup] Completed in ${duration}ms`, results)

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Notification Cleanup] Critical error:', error)
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering from admin dashboard
export async function POST(request: NextRequest) {
  return GET(request)
}

