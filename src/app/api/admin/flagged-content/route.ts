// Admin Flagged Content API - AI-detected content moderation
// CEO Control Panel - Review and manage automatically flagged content
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin/utils'

// GET /api/admin/flagged-content - Get flagged content with pagination
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify admin status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    // Get query params
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status') || undefined
    const contentType = searchParams.get('contentType') || undefined

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (contentType) where.contentType = contentType

    // Fetch flagged content with pagination (parallel queries)
    const [flaggedContent, total, stats] = await Promise.all([
      prisma.flaggedContent.findMany({
        where,
        orderBy: [
          { status: 'asc' }, // PENDING first
          { aiScore: 'desc' }, // Higher score = more urgent
          { flaggedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.flaggedContent.count({ where }),
      // Get statistics in parallel
      prisma.flaggedContent.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ])

    // Get sender and reviewer IDs for batch query
    const senderIds = [...new Set(flaggedContent.map(fc => fc.senderId))]
    const reviewerIds = [...new Set(flaggedContent.map(fc => fc.reviewedById).filter((id): id is string => id !== null))]
    const allUserIds = [...new Set([...senderIds, ...reviewerIds])]

    // Batch fetch all users (senders and reviewers) in one query
    const users = allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        })
      : []

    const userMap = new Map(users.map(u => [u.id, u]))

    // Enrich flagged content with sender and reviewer info
    const enrichedContent = flaggedContent.map(fc => {
      const sender = userMap.get(fc.senderId)
      const reviewer = fc.reviewedById ? userMap.get(fc.reviewedById) : null

      return {
        ...fc,
        sender: sender || {
          id: fc.senderId,
          name: fc.senderName || 'Unknown',
          email: fc.senderEmail || 'unknown',
          avatarUrl: null,
        },
        reviewedBy: reviewer ? {
          id: reviewer.id,
          name: reviewer.name,
          email: reviewer.email,
        } : null,
      }
    })

    // Format statistics
    const statistics = {
      byStatus: stats.reduce((acc, s) => {
        acc[s.status] = s._count._all
        return acc
      }, {} as Record<string, number>),
      total,
    }

    return NextResponse.json({
      success: true,
      data: {
        flaggedContent: enrichedContent,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
        statistics,
      },
    })
  } catch (error) {
    console.error('[Admin Flagged Content] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/flagged-content - Take action on flagged content
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify admin status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { action, flaggedContentId, notes, banUser, banDuration, banReason } = body

    if (!flaggedContentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the flagged content
    const flaggedContent = await prisma.flaggedContent.findUnique({
      where: { id: flaggedContentId },
    })

    if (!flaggedContent) {
      return NextResponse.json(
        { error: 'Flagged content not found' },
        { status: 404 }
      )
    }

    // Handle different actions
    switch (action) {
      case 'approve': {
        // Content is fine, mark as approved
        await prisma.flaggedContent.update({
          where: { id: flaggedContentId },
          data: {
            status: 'APPROVED',
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewNotes: notes || 'Content approved by admin',
            actionTaken: 'none',
          },
        })

        // Log the action
        await logAdminAction({
          adminId: user.id,
          action: 'flagged_content_approved',
          targetType: 'flagged_content',
          targetId: flaggedContentId,
          details: { notes },
        })

        return NextResponse.json({ success: true, message: 'Content approved' })
      }

      case 'remove': {
        // Remove the content and mark as removed
        await prisma.flaggedContent.update({
          where: { id: flaggedContentId },
          data: {
            status: 'REMOVED',
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewNotes: notes || 'Content removed by admin',
            actionTaken: 'deleted',
          },
        })

        // Also soft-delete the original content if it's a post
        if (flaggedContent.contentType === 'POST' && flaggedContent.contentId) {
          try {
            await prisma.post.update({
              where: { id: flaggedContent.contentId },
              data: { isDeleted: true },
            })
          } catch {
            // Content may have already been deleted
          }
        }

        // Log the action
        await logAdminAction({
          adminId: user.id,
          action: 'flagged_content_removed',
          targetType: 'flagged_content',
          targetId: flaggedContentId,
          details: { notes, contentType: flaggedContent.contentType },
        })

        return NextResponse.json({ success: true, message: 'Content removed' })
      }

      case 'warn': {
        // Warn the user and mark content as reviewed
        await prisma.flaggedContent.update({
          where: { id: flaggedContentId },
          data: {
            status: 'WARNING',
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewNotes: notes || 'User warned',
            actionTaken: 'warned',
          },
        })

        // Log the action
        await logAdminAction({
          adminId: user.id,
          action: 'user_warned',
          targetType: 'user',
          targetId: flaggedContent.senderId,
          details: { notes, contentId: flaggedContentId },
        })

        return NextResponse.json({ success: true, message: 'User warned' })
      }

      case 'ban': {
        // Ban the user
        const banEndDate = banDuration
          ? new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000)
          : null // null = permanent

        await prisma.$transaction([
          // Update flagged content
          prisma.flaggedContent.update({
            where: { id: flaggedContentId },
            data: {
              status: 'REMOVED',
              reviewedById: user.id,
              reviewedAt: new Date(),
              reviewNotes: notes || `User banned: ${banReason || 'Content violation'}`,
              actionTaken: 'banned',
            },
          }),
          // Deactivate the user
          prisma.user.update({
            where: { id: flaggedContent.senderId },
            data: {
              deactivatedAt: new Date(),
              deactivationReason: banReason || 'Content violation',
            },
          }),
        ])

        // Log the action
        await logAdminAction({
          adminId: user.id,
          action: 'user_banned',
          targetType: 'user',
          targetId: flaggedContent.senderId,
          details: {
            reason: banReason,
            duration: banDuration || 'permanent',
            contentId: flaggedContentId,
          },
        })

        return NextResponse.json({ success: true, message: 'User banned' })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Admin Flagged Content] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/flagged-content - Delete flagged content record
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify admin status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, deactivatedAt: true },
    })

    if (!dbUser?.isAdmin || dbUser.deactivatedAt) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { flaggedContentId } = body

    if (!flaggedContentId) {
      return NextResponse.json(
        { error: 'Missing flaggedContentId' },
        { status: 400 }
      )
    }

    await prisma.flaggedContent.delete({
      where: { id: flaggedContentId },
    })

    // Log the action
    await logAdminAction({
      adminId: user.id,
      action: 'flagged_content_deleted',
      targetType: 'flagged_content',
      targetId: flaggedContentId,
      details: { message: 'Flagged content record permanently deleted' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Flagged Content] Delete Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
