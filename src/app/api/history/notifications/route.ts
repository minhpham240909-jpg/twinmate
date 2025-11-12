import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/history/notifications - Get user's notification history
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // NotificationType
    const isRead = searchParams.get('isRead') // 'true', 'false', or null for all

    // Build where clause
    const where: any = {
      userId: user.id,
    }

    if (type) {
      where.type = type
    }

    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true'
    }

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Calculate statistics
    const totalNotifications = await prisma.notification.count({
      where: { userId: user.id },
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    })

    const byType = await prisma.notification.groupBy({
      by: ['type'],
      where: { userId: user.id },
      _count: true,
    })

    return NextResponse.json({
      notifications: notifications.map(notif => ({
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        isRead: notif.isRead,
        actionUrl: notif.actionUrl,
        relatedUserId: notif.relatedUserId,
        relatedMatchId: notif.relatedMatchId,
        createdAt: notif.createdAt,
      })),
      statistics: {
        total: totalNotifications,
        unread: unreadCount,
        read: totalNotifications - unreadCount,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count
          return acc
        }, {} as Record<string, number>),
      },
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

