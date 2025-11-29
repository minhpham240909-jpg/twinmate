// Admin Reports API - Content Moderation
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'

// GET - List reports with filtering and pagination
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
    const type = searchParams.get('type') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    // Execute query
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          handledBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
      },
    })
  } catch (error) {
    console.error('[Admin Reports] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Handle report actions (review, resolve, dismiss)
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
    const { action, reportId, resolution, banUser, banDuration, banReason } = body

    if (!action || !reportId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get IP and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get the report
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reportedUser: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    switch (action) {
      case 'review': {
        // Mark as under review
        await prisma.report.update({
          where: { id: reportId },
          data: {
            status: 'REVIEWING',
            handledById: user.id,
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'report_reviewing',
          targetType: 'report',
          targetId: reportId,
          details: {},
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Report marked as under review' })
      }

      case 'resolve': {
        // Resolve the report
        await prisma.report.update({
          where: { id: reportId },
          data: {
            status: 'RESOLVED',
            resolution: resolution || 'No resolution notes',
            handledById: user.id,
            handledAt: new Date(),
          },
        })

        // Optionally ban the reported user
        if (banUser && report.reportedUserId) {
          const expiresAt = banDuration
            ? new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000)
            : null

          await prisma.userBan.upsert({
            where: { userId: report.reportedUserId },
            create: {
              userId: report.reportedUserId,
              issuedById: user.id,
              type: banDuration ? 'TEMPORARY' : 'PERMANENT',
              reason: banReason || `Ban from report: ${report.description || report.type}`,
              expiresAt,
            },
            update: {
              issuedById: user.id,
              type: banDuration ? 'TEMPORARY' : 'PERMANENT',
              reason: banReason || `Ban from report: ${report.description || report.type}`,
              expiresAt,
              updatedAt: new Date(),
            },
          })

          await logAdminAction({
            adminId: user.id,
            action: 'user_banned',
            targetType: 'user',
            targetId: report.reportedUserId,
            details: { reason: banReason, fromReport: reportId },
            ipAddress,
            userAgent,
          })
        }

        await logAdminAction({
          adminId: user.id,
          action: 'report_resolved',
          targetType: 'report',
          targetId: reportId,
          details: { resolution, userBanned: banUser },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Report resolved' })
      }

      case 'dismiss': {
        // Dismiss the report
        await prisma.report.update({
          where: { id: reportId },
          data: {
            status: 'DISMISSED',
            resolution: resolution || 'Report dismissed - no action taken',
            handledById: user.id,
            handledAt: new Date(),
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'report_dismissed',
          targetType: 'report',
          targetId: reportId,
          details: { resolution },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Report dismissed' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Reports] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
