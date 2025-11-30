import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // SECURITY: Rate limit notification fetches
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.lenient, // 100 requests per minute
    keyPrefix: 'notifications',
  })
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
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

    // Get all notifications for user
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: PAGINATION.NOTIFICATIONS_LIMIT
    })

    // Try to get announcements (may fail if tables don't exist yet)
    let announcementNotifications: any[] = []
    try {
      // Get user's subscription status for targeted announcements
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionStatus: true }
      })
      // Determine user tier: PREMIUM if they have an active subscription, otherwise FREE
      const userTier = userData?.subscriptionStatus === 'active' ? 'PREMIUM' : 'FREE'

      // Get active announcements that user hasn't dismissed
      const dismissedAnnouncementIds = await prisma.announcementDismissal.findMany({
        where: { userId: user.id },
        select: { announcementId: true }
      })
      const dismissedIds = dismissedAnnouncementIds.map(d => d.announcementId)

      // Fetch announcements that match targeting criteria
      const activeAnnouncements = await prisma.announcement.findMany({
        where: {
          status: 'ACTIVE',
          id: { notIn: dismissedIds },
          startsAt: { lte: new Date() },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ],
          // Targeting logic: role-based OR specific user targeting
          AND: [
            {
              OR: [
                // Role-based targeting (when no specific users are set)
                {
                  AND: [
                    { targetUserIds: { isEmpty: true } },
                    {
                      OR: [
                        { targetRole: null },
                        { targetRole: userTier }
                      ]
                    }
                  ]
                },
                // Specific user targeting (user is in the list)
                { targetUserIds: { has: user.id } },
                // Combined: role targeting WITH specific users (show to both)
                {
                  AND: [
                    { targetUserIds: { isEmpty: false } },
                    {
                      OR: [
                        { targetRole: null },
                        { targetRole: userTier }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })

      // Convert announcements to notification format
      announcementNotifications = activeAnnouncements.map(announcement => ({
        id: `announcement-${announcement.id}`,
        type: 'ANNOUNCEMENT',
        title: announcement.title,
        message: announcement.content,
        isRead: false,
        actionUrl: null,
        relatedUserId: null,
        relatedMatchId: null,
        createdAt: announcement.createdAt.toISOString(),
        priority: announcement.priority,
        announcementId: announcement.id, // Keep reference for dismissal
      }))
    } catch (announcementError) {
      // Announcements table might not exist yet - continue without them
      console.warn('Could not fetch announcements:', announcementError)
    }

    // Get related users for notifications (batch query to avoid N+1)
    const relatedUserIds = notifications
      .map(n => n.relatedUserId)
      .filter((id): id is string => id !== null)

    const uniqueUserIds = [...new Set(relatedUserIds)]

    const relatedUsers = uniqueUserIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: uniqueUserIds }
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        })
      : []

    // Create map for O(1) lookups
    const userMap = new Map(relatedUsers.map(u => [u.id, u]))

    // Attach related user data to notifications
    const notificationsWithUsers = notifications.map(notification => ({
      ...notification,
      relatedUser: notification.relatedUserId ? userMap.get(notification.relatedUserId) : null,
    }))

    // Combine announcements with regular notifications, announcements first (they're important)
    const allNotifications = [...announcementNotifications, ...notificationsWithUsers]

    // Get unread count (regular notifications + active announcements)
    const regularUnreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false
      }
    })
    const unreadCount = regularUnreadCount + announcementNotifications.length

    return NextResponse.json({
      success: true,
      notifications: allNotifications,
      unreadCount
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
