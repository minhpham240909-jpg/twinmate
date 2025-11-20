import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'

export async function GET(request: NextRequest) {
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

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false
      }
    })

    return NextResponse.json({
      success: true,
      notifications: notificationsWithUsers,
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
