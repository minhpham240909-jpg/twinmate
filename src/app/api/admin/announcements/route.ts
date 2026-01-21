// Admin Announcements API - System Announcements
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// GET - List announcements
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (default preset: 100 requests/minute)
    const rateLimitResult = await adminRateLimit(request, 'default')
    if (rateLimitResult) return rateLimitResult

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
// SECURITY: Protected by admin authentication (admin check + rate limiting)
export async function POST(request: NextRequest) {
  // Apply rate limiting (bulk preset: 10 operations per 5 minutes)
  // Announcements can be expensive due to notification broadcasting
  const rateLimitResult = await adminRateLimit(request, 'bulk')
  if (rateLimitResult) return rateLimitResult

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
          if (targetRole === 'SPECIFIC') {
            // SPECIFIC mode: Only send to selected users, no one else
            if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
              targetUsers = await prisma.user.findMany({
                where: {
                  id: { in: targetUserIds },
                  deactivatedAt: null, // Only active users
                },
                select: { id: true },
              })
            }
            // If no users selected in SPECIFIC mode, targetUsers stays empty
          } else if (Array.isArray(targetUserIds) && targetUserIds.length > 0 && !targetRole) {
            // Specific users selected with "All Users" - just target all users (specific are included)
            // Use cursor-based pagination to avoid memory issues
            const FETCH_BATCH_SIZE = 1000
            let cursorId: string | undefined = undefined
            let hasMoreUsers = true

            while (hasMoreUsers) {
              const userBatch: { id: string }[] = await prisma.user.findMany({
                where: { deactivatedAt: null },
                select: { id: true },
                take: FETCH_BATCH_SIZE,
                skip: cursorId ? 1 : 0,
                cursor: cursorId ? { id: cursorId } : undefined,
                orderBy: { id: 'asc' },
              })

              if (userBatch.length < FETCH_BATCH_SIZE) {
                hasMoreUsers = false
              }

              if (userBatch.length > 0) {
                cursorId = userBatch[userBatch.length - 1].id
                targetUsers.push(...userBatch)
              } else {
                hasMoreUsers = false
              }

              if (targetUsers.length >= 100000) {
                console.warn('[Announcements] Hit 100K user limit')
                hasMoreUsers = false
              }
            }
          } else if (targetRole === 'FREE' || targetRole === 'PREMIUM') {
            // Users with specific role (e.g., 'FREE', 'PREMIUM')
            // SCALABILITY: Use cursor-based pagination for role-based queries too
            const ROLE_BATCH_SIZE = 1000
            let roleCursor: string | undefined = undefined
            let hasMoreRoleUsers = true

            while (hasMoreRoleUsers) {
              const roleBatch: { id: string }[] = await prisma.user.findMany({
                where: {
                  role: targetRole as 'FREE' | 'PREMIUM',
                  deactivatedAt: null,
                },
                select: { id: true },
                take: ROLE_BATCH_SIZE,
                skip: roleCursor ? 1 : 0,
                cursor: roleCursor ? { id: roleCursor } : undefined,
                orderBy: { id: 'asc' },
              })

              if (roleBatch.length < ROLE_BATCH_SIZE) {
                hasMoreRoleUsers = false
              }

              if (roleBatch.length > 0) {
                roleCursor = roleBatch[roleBatch.length - 1].id
                targetUsers.push(...roleBatch)
              } else {
                hasMoreRoleUsers = false
              }

              // Safety limit
              if (targetUsers.length >= 100000) {
                console.warn('[Announcements] Hit 100K user limit for role-based targeting')
                hasMoreRoleUsers = false
              }
            }
            
            // If specific users also selected, add them too
            if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
              const additionalUsers = await prisma.user.findMany({
                where: {
                  id: { in: targetUserIds },
                  deactivatedAt: null,
                },
                select: { id: true },
              })
              const userIdSet = new Set([...targetUsers.map(u => u.id), ...additionalUsers.map(u => u.id)])
              targetUsers = Array.from(userIdSet).map(id => ({ id }))
            }
          } else {
            // All active users - CRITICAL: Use cursor-based pagination to avoid loading all users into memory
            // This prevents memory explosion for large user bases (100K+ users)
            const BATCH_SIZE = 1000
            let pageCursor: string | undefined = undefined
            let hasMore = true

            while (hasMore) {
              const batchResults: { id: string }[] = await prisma.user.findMany({
                where: { deactivatedAt: null },
                select: { id: true },
                take: BATCH_SIZE,
                skip: pageCursor ? 1 : 0,
                cursor: pageCursor ? { id: pageCursor } : undefined,
                orderBy: { id: 'asc' },
              })

              if (batchResults.length < BATCH_SIZE) {
                hasMore = false
              }

              if (batchResults.length > 0) {
                pageCursor = batchResults[batchResults.length - 1].id
                targetUsers.push(...batchResults)
              } else {
                hasMore = false
              }

              // Safety limit: Don't fetch more than 100K users in one announcement
              if (targetUsers.length >= 100000) {
                console.warn('[Announcements] Hit 100K user limit for broadcast')
                hasMore = false
              }
            }
          }

          // Create notifications in batches for efficiency
          if (targetUsers.length > 0) {
            const NOTIF_BATCH_SIZE = 500
            const notificationTemplate = {
              type: 'ANNOUNCEMENT' as const,
              title: `📢 ${title}`,
              message: content.length > 200 ? content.substring(0, 200) + '...' : content,
              actionUrl: '/dashboard',
              isRead: false,
            }

            // Insert in batches to avoid overwhelming the database
            // Process in smaller chunks to reduce memory pressure
            for (let i = 0; i < targetUsers.length; i += NOTIF_BATCH_SIZE) {
              const batchUsers = targetUsers.slice(i, i + NOTIF_BATCH_SIZE)
              const notificationData = batchUsers.map(u => ({
                ...notificationTemplate,
                userId: u.id,
              }))

              await prisma.notification.createMany({
                data: notificationData,
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
