// Admin Messages API - Browse and manage all messages
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch messages with filters
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!dbUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all' // all, dm, group, session, flagged
    const search = searchParams.get('search') || ''
    const userId = searchParams.get('userId') || ''
    const status = searchParams.get('status') || '' // For flagged: pending, approved, removed
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    let messages: any[] = []
    let totalCount = 0

    if (type === 'flagged') {
      // Fetch flagged content
      const whereClause: any = {}
      if (status) {
        whereClause.status = status.toUpperCase()
      }
      if (search) {
        whereClause.OR = [
          { content: { contains: search, mode: 'insensitive' } },
          { senderEmail: { contains: search, mode: 'insensitive' } },
          { senderName: { contains: search, mode: 'insensitive' } },
        ]
      }
      if (userId) {
        whereClause.senderId = userId
      }

      const [flaggedContent, count] = await Promise.all([
        prisma.flaggedContent.findMany({
          where: whereClause,
          orderBy: { flaggedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.flaggedContent.count({ where: whereClause }),
      ])

      messages = flaggedContent.map((f) => ({
        id: f.id,
        contentId: f.contentId,
        type: f.contentType,
        content: f.content,
        senderId: f.senderId,
        senderEmail: f.senderEmail,
        senderName: f.senderName,
        conversationId: f.conversationId,
        conversationType: f.conversationType,
        flagReason: f.flagReason,
        aiCategories: f.aiCategories,
        aiScore: f.aiScore,
        status: f.status,
        reviewedById: f.reviewedById,
        reviewedAt: f.reviewedAt,
        actionTaken: f.actionTaken,
        createdAt: f.flaggedAt,
        isFlagged: true,
      }))
      totalCount = count
    } else {
      // Fetch regular messages
      const baseWhere: any = { isDeleted: false }

      if (search) {
        // Search in content AND sender name/email
        baseWhere.OR = [
          { content: { contains: search, mode: 'insensitive' } },
          { sender: { name: { contains: search, mode: 'insensitive' } } },
          { sender: { email: { contains: search, mode: 'insensitive' } } },
        ]
      }
      if (userId) {
        baseWhere.senderId = userId
      }

      if (type === 'dm' || type === 'all') {
        const dmWhere = { ...baseWhere, groupId: null, recipientId: { not: null } }
        const [dmMessages, dmCount] = await Promise.all([
          prisma.message.findMany({
            where: dmWhere,
            include: {
              sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: type === 'dm' ? skip : 0,
            take: type === 'dm' ? limit : Math.floor(limit / 3),
          }),
          prisma.message.count({ where: dmWhere }),
        ])

        messages.push(...dmMessages.map((m) => ({
          id: m.id,
          type: 'DIRECT_MESSAGE',
          content: m.content,
          senderId: m.senderId,
          senderEmail: m.sender.email,
          senderName: m.sender.name,
          senderAvatar: m.sender.avatarUrl,
          conversationId: m.recipientId,
          conversationType: 'partner',
          createdAt: m.createdAt,
          isFlagged: false,
        })))
        if (type === 'dm') totalCount = dmCount
      }

      if (type === 'group' || type === 'all') {
        const groupWhere = { ...baseWhere, groupId: { not: null } }
        const [groupMessages, groupCount] = await Promise.all([
          prisma.message.findMany({
            where: groupWhere,
            include: {
              sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
              group: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: type === 'group' ? skip : 0,
            take: type === 'group' ? limit : Math.floor(limit / 3),
          }),
          prisma.message.count({ where: groupWhere }),
        ])

        messages.push(...groupMessages.map((m) => ({
          id: m.id,
          type: 'GROUP_MESSAGE',
          content: m.content,
          senderId: m.senderId,
          senderEmail: m.sender.email,
          senderName: m.sender.name,
          senderAvatar: m.sender.avatarUrl,
          conversationId: m.groupId,
          conversationType: 'group',
          groupName: m.group?.name,
          createdAt: m.createdAt,
          isFlagged: false,
        })))
        if (type === 'group') totalCount = groupCount
      }

      if (type === 'session' || type === 'all') {
        const sessionWhere: any = {}
        if (search) {
          // Search in content AND sender name/email
          sessionWhere.OR = [
            { content: { contains: search, mode: 'insensitive' } },
            { sender: { name: { contains: search, mode: 'insensitive' } } },
            { sender: { email: { contains: search, mode: 'insensitive' } } },
          ]
        }
        if (userId) {
          sessionWhere.senderId = userId
        }

        const [sessionMessages, sessionCount] = await Promise.all([
          prisma.sessionMessage.findMany({
            where: sessionWhere,
            include: {
              sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
              session: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: type === 'session' ? skip : 0,
            take: type === 'session' ? limit : Math.floor(limit / 3),
          }),
          prisma.sessionMessage.count({ where: sessionWhere }),
        ])

        messages.push(...sessionMessages.map((m) => ({
          id: m.id,
          type: 'SESSION_MESSAGE',
          content: m.content,
          senderId: m.senderId,
          senderEmail: m.sender.email,
          senderName: m.sender.name,
          senderAvatar: m.sender.avatarUrl,
          conversationId: m.sessionId,
          conversationType: 'session',
          sessionTitle: m.session?.title,
          createdAt: m.createdAt,
          isFlagged: false,
        })))
        if (type === 'session') totalCount = sessionCount
      }

      // Sort combined messages by date
      if (type === 'all') {
        messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        messages = messages.slice(0, limit)
        // For 'all', we can't easily get total count, so estimate
        totalCount = messages.length >= limit ? limit * 10 : messages.length
      }
    }

    // Get stats
    const [pendingFlaggedCount, totalFlaggedCount] = await Promise.all([
      prisma.flaggedContent.count({ where: { status: 'PENDING' } }),
      prisma.flaggedContent.count(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        stats: {
          pendingFlagged: pendingFlaggedCount,
          totalFlagged: totalFlaggedCount,
        },
      },
    })
  } catch (error) {
    console.error('Admin messages API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Moderate a message (approve, remove, warn)
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    })

    if (!dbUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { flaggedId, action, notes } = body

    if (!flaggedId || !action) {
      return NextResponse.json(
        { error: 'flaggedId and action are required' },
        { status: 400 }
      )
    }

    // Get the flagged content
    const flagged = await prisma.flaggedContent.findUnique({
      where: { id: flaggedId },
    })

    if (!flagged) {
      return NextResponse.json({ error: 'Flagged content not found' }, { status: 404 })
    }

    // Perform action
    let newStatus: 'APPROVED' | 'REMOVED' | 'WARNING' = 'APPROVED'
    let actionTaken = action

    if (action === 'approve') {
      newStatus = 'APPROVED'
      actionTaken = 'none'
    } else if (action === 'remove') {
      newStatus = 'REMOVED'
      actionTaken = 'deleted'

      // Delete the actual message based on type
      if (flagged.contentType === 'DIRECT_MESSAGE' || flagged.contentType === 'GROUP_MESSAGE') {
        await prisma.message.update({
          where: { id: flagged.contentId },
          data: { isDeleted: true, deletedAt: new Date() },
        })
      } else if (flagged.contentType === 'SESSION_MESSAGE') {
        await prisma.sessionMessage.update({
          where: { id: flagged.contentId },
          data: { deletedAt: new Date() },
        })
      } else if (flagged.contentType === 'POST') {
        await prisma.post.update({
          where: { id: flagged.contentId },
          data: { isDeleted: true, deletedAt: new Date() },
        })
      }
    } else if (action === 'warn') {
      newStatus = 'WARNING'
      actionTaken = 'warned'

      // Create a warning for the user
      await prisma.userWarning.create({
        data: {
          userId: flagged.senderId,
          issuedById: user.id,
          reason: notes || 'Inappropriate content detected',
          severity: 1,
        },
      })
    } else if (action === 'ban') {
      newStatus = 'REMOVED'
      actionTaken = 'banned'

      // Delete the message and ban the user
      if (flagged.contentType === 'DIRECT_MESSAGE' || flagged.contentType === 'GROUP_MESSAGE') {
        await prisma.message.update({
          where: { id: flagged.contentId },
          data: { isDeleted: true, deletedAt: new Date() },
        })
      }

      // Ban the user
      await prisma.userBan.upsert({
        where: { userId: flagged.senderId },
        create: {
          userId: flagged.senderId,
          issuedById: user.id,
          type: 'PERMANENT',
          reason: notes || 'Severe violation of community guidelines',
        },
        update: {
          issuedById: user.id,
          type: 'PERMANENT',
          reason: notes || 'Severe violation of community guidelines',
        },
      })

      // Deactivate the user
      await prisma.user.update({
        where: { id: flagged.senderId },
        data: { deactivatedAt: new Date() },
      })
    }

    // Update the flagged content
    const updated = await prisma.flaggedContent.update({
      where: { id: flaggedId },
      data: {
        status: newStatus,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
        actionTaken,
      },
    })

    // Log the audit action
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: `MODERATION_${action.toUpperCase()}`,
        targetType: 'FlaggedContent',
        targetId: flaggedId,
        details: {
          contentType: flagged.contentType,
          contentId: flagged.contentId,
          senderId: flagged.senderId,
          action: actionTaken,
          notes,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Moderation action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
