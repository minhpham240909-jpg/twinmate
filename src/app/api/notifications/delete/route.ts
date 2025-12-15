import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { notificationIds } = body

    // Validate that notificationIds is an array with at least one item
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { error: 'notificationIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Separate announcement IDs (prefixed with "announcement-") from regular notification IDs
    const announcementIds: string[] = []
    const regularNotificationIds: string[] = []

    for (const id of notificationIds) {
      if (typeof id !== 'string') continue

      if (id.startsWith('announcement-')) {
        // Extract the actual announcement ID
        const announcementId = id.replace('announcement-', '')
        if (announcementId) {
          announcementIds.push(announcementId)
        }
      } else {
        // Regular notification ID - should be a UUID
        regularNotificationIds.push(id)
      }
    }

    let deletedCount = 0
    let dismissedCount = 0

    // Handle regular notifications deletion
    if (regularNotificationIds.length > 0) {
      // First, verify the notifications exist and belong to this user
      const existingNotifications = await prisma.notification.findMany({
        where: {
          id: { in: regularNotificationIds },
          userId: user.id,
        },
        select: { id: true },
      })

      if (existingNotifications.length > 0) {
        // Delete only the verified notifications
        const deleteResult = await prisma.notification.deleteMany({
          where: {
            id: { in: existingNotifications.map(n => n.id) },
            userId: user.id,
          },
        })
        deletedCount = deleteResult.count
      }
    }

    // Handle announcement dismissals (create dismissal records instead of deleting)
    if (announcementIds.length > 0) {
      // Verify these announcements exist
      const existingAnnouncements = await prisma.announcement.findMany({
        where: {
          id: { in: announcementIds },
        },
        select: { id: true },
      })

      if (existingAnnouncements.length > 0) {
        // Create dismissal records for each announcement (skip duplicates)
        for (const announcement of existingAnnouncements) {
          try {
            await prisma.announcementDismissal.create({
              data: {
                userId: user.id,
                announcementId: announcement.id,
              },
            })
            dismissedCount++
          } catch (e: any) {
            // Ignore unique constraint errors (already dismissed)
            if (e?.code !== 'P2002') {
              console.error('Error dismissing announcement:', e)
            } else {
              // Already dismissed, count it as success
              dismissedCount++
            }
          }
        }
      }
    }

    const totalCount = deletedCount + dismissedCount
    console.log(`User ${user.id}: Deleted ${deletedCount} notification(s), dismissed ${dismissedCount} announcement(s)`)

    return NextResponse.json({
      success: true,
      message: totalCount > 0
        ? `${totalCount} notification(s) removed`
        : 'No notifications found to remove',
      deletedCount,
      dismissedCount,
      totalCount,
    })
  } catch (error) {
    console.error('Error in delete notifications API:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack)
    }
    return NextResponse.json(
      {
        error: 'Failed to delete notifications',
        details: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : undefined,
      },
      { status: 500 }
    )
  }
}
