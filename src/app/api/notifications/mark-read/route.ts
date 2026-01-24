import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const markReadSchema = z.object({
  notificationId: z.string().optional(),
  markAll: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit mark-read requests (lenient - read operations)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validation = markReadSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { notificationId, markAll } = validation.data

    if (markAll) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false
        },
        data: {
          isRead: true
        }
      })

      // Also dismiss all active announcements - OPTIMIZED: batch operation instead of N+1 loop
      const activeAnnouncements = await prisma.announcement.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true }
      })

      if (activeAnnouncements.length > 0) {
        // Get already dismissed announcements to avoid duplicates
        const alreadyDismissed = await prisma.announcementDismissal.findMany({
          where: {
            userId: user.id,
            announcementId: { in: activeAnnouncements.map(a => a.id) }
          },
          select: { announcementId: true }
        })
        const dismissedIds = new Set(alreadyDismissed.map(d => d.announcementId))

        // Filter to only new dismissals needed
        const newDismissals = activeAnnouncements
          .filter(a => !dismissedIds.has(a.id))
          .map(a => ({ announcementId: a.id, userId: user.id }))

        // Batch create all dismissals in single query (no N+1)
        if (newDismissals.length > 0) {
          await prisma.announcementDismissal.createMany({
            data: newDismissals,
            skipDuplicates: true // Safety net for race conditions
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      })
    } else if (notificationId) {
      // Check if this is an announcement dismissal (ID starts with "announcement-")
      if (notificationId.startsWith('announcement-')) {
        const announcementId = notificationId.replace('announcement-', '')

        // Create dismissal record
        await prisma.announcementDismissal.upsert({
          where: {
            announcementId_userId: {
              announcementId,
              userId: user.id
            }
          },
          update: {},
          create: {
            announcementId,
            userId: user.id
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Announcement dismissed'
        })
      }

      // Mark specific notification as read
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
      })

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        )
      }

      if (notification.userId !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      })

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read'
      })
    } else {
      return NextResponse.json(
        { error: 'Must provide notificationId or markAll' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
