// Admin Feedback API - User Feedback Management
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// GET - List feedback with filtering and pagination
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
    const rating = searchParams.get('rating') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (rating) {
      where.rating = parseInt(rating)
    }

    // Execute query
    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          reviewedBy: {
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
      prisma.feedback.count({ where }),
    ])

    // Get statistics
    const stats = await prisma.feedback.groupBy({
      by: ['status'],
      _count: true,
    })

    const ratingStats = await prisma.feedback.groupBy({
      by: ['rating'],
      _count: true,
    })

    const avgRating = await prisma.feedback.aggregate({
      _avg: { rating: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        feedback,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
        statistics: {
          byStatus: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
          byRating: ratingStats.reduce((acc, r) => ({ ...acc, [r.rating]: r._count }), {}),
          averageRating: avgRating._avg.rating || 0,
          total,
        },
      },
    })
  } catch (error) {
    console.error('[Admin Feedback] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Handle feedback actions (review, resolve, archive)
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (userActions preset: 30 actions/minute)
    const rateLimitResult = await adminRateLimit(request, 'userActions')
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

    const body = await request.json()
    const { action, feedbackId, adminNotes } = body

    if (!action || !feedbackId) {
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

    // Get the feedback
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    })

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    switch (action) {
      case 'review': {
        // Mark as reviewed
        await prisma.feedback.update({
          where: { id: feedbackId },
          data: {
            status: 'REVIEWED',
            reviewedById: user.id,
            reviewedAt: new Date(),
            adminNotes: adminNotes || feedback.adminNotes,
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'feedback_reviewed',
          targetType: 'feedback',
          targetId: feedbackId,
          details: { adminNotes },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Feedback marked as reviewed' })
      }

      case 'resolve': {
        // Mark as resolved
        await prisma.feedback.update({
          where: { id: feedbackId },
          data: {
            status: 'RESOLVED',
            reviewedById: user.id,
            reviewedAt: new Date(),
            adminNotes: adminNotes || feedback.adminNotes,
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'feedback_resolved',
          targetType: 'feedback',
          targetId: feedbackId,
          details: { adminNotes },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Feedback resolved' })
      }

      case 'archive': {
        // Archive the feedback
        await prisma.feedback.update({
          where: { id: feedbackId },
          data: {
            status: 'ARCHIVED',
            reviewedById: user.id,
            reviewedAt: new Date(),
            adminNotes: adminNotes || feedback.adminNotes,
          },
        })

        await logAdminAction({
          adminId: user.id,
          action: 'feedback_archived',
          targetType: 'feedback',
          targetId: feedbackId,
          details: { adminNotes },
          ipAddress,
          userAgent,
        })

        return NextResponse.json({ success: true, message: 'Feedback archived' })
      }

      case 'add_notes': {
        // Just update admin notes
        await prisma.feedback.update({
          where: { id: feedbackId },
          data: {
            adminNotes: adminNotes,
          },
        })

        return NextResponse.json({ success: true, message: 'Notes updated' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Feedback] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Permanently delete feedback
export async function DELETE(request: NextRequest) {
  try {
    // Apply rate limiting (userActions preset: 30 actions/minute)
    const rateLimitResult = await adminRateLimit(request, 'userActions')
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

    const body = await request.json()
    const { feedbackId } = body

    if (!feedbackId) {
      return NextResponse.json({ error: 'Feedback ID required' }, { status: 400 })
    }

    // Get IP and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Delete the feedback
    await prisma.feedback.delete({
      where: { id: feedbackId },
    })

    await logAdminAction({
      adminId: user.id,
      action: 'feedback_deleted',
      targetType: 'feedback',
      targetId: feedbackId,
      details: {},
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, message: 'Feedback deleted permanently' })
  } catch (error) {
    console.error('[Admin Feedback Delete] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
