// Admin Announcements API - System Announcements
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'

// GET - List announcements
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    // Execute query
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              dismissals: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        announcements,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
      },
    })
  } catch (error) {
    console.error('[Admin Announcements] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or manage announcements
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify admin status
    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action, id, title, content, priority, targetRole, targetUserIds, startsAt, expiresAt } = body

    // Get IP and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    switch (action) {
      case 'create': {
        if (!title || !content) {
          return NextResponse.json(
            { error: 'Title and content are required' },
            { status: 400 }
          )
        }

        const announcement = await prisma.announcement.create({
          data: {
            title,
            content,
            priority: priority || 'NORMAL',
            targetRole: targetRole || null,
            targetUserIds: Array.isArray(targetUserIds) ? targetUserIds : [],
            status: 'ACTIVE',
            startsAt: startsAt ? new Date(startsAt) : new Date(),
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdById: user.id,
          },
        })

        // Send notifications to targeted users
        let notificationsSent = 0
        try {
          let targetUsers: { id: string }[] = []

          // Determine target users based on targeting options
          if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
            // Specific users selected
            targetUsers = await prisma.user.findMany({
              where: { id: { in: targetUserIds } },
              select: { id: true },
            })
          } else if (targetRole) {
            // Users with specific role (e.g., 'FREE', 'PREMIUM')
            // Cast string to enum value for Prisma
            targetUsers = await prisma.user.findMany({
              where: { role: targetRole as 'FREE' | 'PREMIUM' },
              select: { id: true },
            })
          } else {
            // All active users (not deactivated)
            targetUsers = await prisma.user.findMany({
              where: { deactivatedAt: null },
              select: { id: true },
            })
          }

          // Create notifications in batches for efficiency
          if (targetUsers.length > 0) {
            const BATCH_SIZE = 500
            const notificationData = targetUsers.map(u => ({
              userId: u.id,
              type: 'ANNOUNCEMENT' as const,
              title: `📢 ${title}`,
              message: content.length > 200 ? content.substring(0, 200) + '...' : content,
              actionUrl: '/dashboard', // Or a dedicated announcements page
              isRead: false,
            }))

            // Insert in batches to avoid overwhelming the database
            for (let i = 0; i < notificationData.length; i += BATCH_SIZE) {
              const batch = notificationData.slice(i, i + BATCH_SIZE)
              await prisma.notification.createMany({
                data: batch,
                skipDuplicates: true,
              })
            }

            notificationsSent = targetUsers.length
          }
        } catch (notifError: unknown) {
          console.error('[Announcements] Error sending notifications:', notifError)
          // Log more details for debugging
          if (notifError instanceof Error) {
            console.error('[Announcements] Notification error details:', notifError.message, notifError.stack)
          }
          // Don't fail the announcement creation if notifications fail
        }

        await logAdminAction({
          adminId: user.id,
          action: 'announcement_created',
          targetType: 'announcement',
          targetId: announcement.id,
          details: {
            title,
            priority,
            targetRole,
            targetUserIds: targetUserIds?.length || 0,
            notificationsSent,
          },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({
          success: true,
          message: `Announcement created and sent to ${notificationsSent} users`,
          data: announcement,
          notificationsSent,
        })
      }

      case 'update': {
        if (!id) {
          return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (content !== undefined) updateData.content = content
        if (priority !== undefined) updateData.priority = priority
        if (targetRole !== undefined) updateData.targetRole = targetRole
        if (targetUserIds !== undefined) updateData.targetUserIds = Array.isArray(targetUserIds) ? targetUserIds : []
        if (startsAt !== undefined) updateData.startsAt = new Date(startsAt)
        if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null

        const announcement = await prisma.announcement.update({
          where: { id },
          data: updateData,
        })

        await logAdminAction({
          adminId: user.id,
          action: 'announcement_updated',
          targetType: 'announcement',
          targetId: id,
          details: updateData,
          ipAddress,
          userAgent,
        })

        return NextResponse.json({
          success: true,
          message: 'Announcement updated',
          data: announcement,
        })
      }

      case 'publish': {
        if (!id) {
          return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        await prisma.announcement.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            startsAt: new Date(),
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'announcement_published',
          targetType: 'announcement',
          targetId: id,
          details: {},
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Announcement published' })
      }

      case 'archive': {
        if (!id) {
          return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        await prisma.announcement.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'announcement_archived',
          targetType: 'announcement',
          targetId: id,
          details: {},
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Announcement archived' })
      }

      case 'delete': {
        if (!id) {
          return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        await prisma.announcement.delete({
          where: { id },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'announcement_deleted',
          targetType: 'announcement',
          targetId: id,
          details: {},
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Announcement deleted' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('[Admin Announcements POST] Error:', error)
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('[Admin Announcements POST] Error details:', error.message, error.stack)
      return NextResponse.json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
