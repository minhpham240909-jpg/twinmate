// Admin Messages API - Browse and manage all messages
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { adminRateLimit } from '@/lib/admin/rate-limit'

// GET - Fetch messages with filters
export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit admin message list requests
  const rateLimitResult = await adminRateLimit(request, 'messages')
  if (rateLimitResult) return rateLimitResult

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
    const type = searchParams.get('type') || 'all' // all, dm, group, session, flagged, images
    const search = searchParams.get('search') || ''
    const userId = searchParams.get('userId') || ''
    const status = searchParams.get('status') || '' // For flagged: pending, approved, removed
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    let messages: any[] = []
    let totalCount = 0

    // NEW: Images filter - fetch all messages with image attachments
    if (type === 'images') {
      const imageWhereClause: any = {
        isDeleted: false,
        OR: [
          { type: 'IMAGE' },
          { fileUrl: { not: null } },
          { content: { startsWith: '[Image:' } },
        ],
      }
      if (search) {
        imageWhereClause.AND = [
          {
            OR: [
              { content: { contains: search, mode: 'insensitive' } },
              { sender: { name: { contains: search, mode: 'insensitive' } } },
              { sender: { email: { contains: search, mode: 'insensitive' } } },
              { senderName: { contains: search, mode: 'insensitive' } },
              { senderEmail: { contains: search, mode: 'insensitive' } },
              { fileName: { contains: search, mode: 'insensitive' } },
            ],
          },
        ]
      }
      if (userId) {
        imageWhereClause.senderId = userId
      }

      const [imageMessages, imageCount] = await Promise.all([
        prisma.message.findMany({
          where: imageWhereClause,
          include: {
            sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
            group: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.message.count({ where: imageWhereClause }),
      ])

      messages = imageMessages.map((m) => ({
        id: m.id,
        type: m.groupId ? 'GROUP_MESSAGE' : 'DIRECT_MESSAGE',
        content: m.content,
        senderId: m.senderId,
        senderEmail: m.sender?.email || m.senderEmail || '[Deleted User]',
        senderName: m.sender?.name || m.senderName || 'Deleted User',
        senderAvatar: m.sender?.avatarUrl || m.senderAvatarUrl,
        senderDeleted: !m.sender,
        conversationId: m.groupId || m.recipientId,
        conversationType: m.groupId ? 'group' : 'partner',
        groupName: m.group?.name,
        createdAt: m.createdAt,
        isFlagged: false,
        // File/image attachments
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        fileSize: m.fileSize,
        messageType: m.type,
      }))
      totalCount = imageCount
    } else if (type === 'flagged') {
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
      // Fetch regular messages - ADMIN sees ALL messages including soft-deleted ones
      // Only permanently deleted messages (hard delete by admin) are not shown
      const baseWhere: any = {}

      if (search) {
        // Search in content AND sender name/email (both live and cached)
        baseWhere.OR = [
          { content: { contains: search, mode: 'insensitive' } },
          { sender: { name: { contains: search, mode: 'insensitive' } } },
          { sender: { email: { contains: search, mode: 'insensitive' } } },
          // Also search cached sender info (for deleted users)
          { senderName: { contains: search, mode: 'insensitive' } },
          { senderEmail: { contains: search, mode: 'insensitive' } },
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
          // Use cached info if sender is deleted, otherwise use live data
          senderEmail: m.sender?.email || m.senderEmail || '[Deleted User]',
          senderName: m.sender?.name || m.senderName || 'Deleted User',
          senderAvatar: m.sender?.avatarUrl || m.senderAvatarUrl,
          senderDeleted: !m.sender, // Flag to show user was deleted
          conversationId: m.recipientId,
          recipientName: m.recipientName,
          recipientEmail: m.recipientEmail,
          conversationType: 'partner',
          createdAt: m.createdAt,
          isFlagged: false,
          // File/image attachments
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
          messageType: m.type, // TEXT, IMAGE, FILE, etc.
          // Deletion status - admin can see deleted messages
          isDeleted: m.isDeleted || false,
          deletedAt: m.deletedAt,
          deletedByUser: m.isDeleted && !m.deletedAt ? false : !!m.deletedAt, // User soft-deleted
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
          // Use cached info if sender is deleted, otherwise use live data
          senderEmail: m.sender?.email || m.senderEmail || '[Deleted User]',
          senderName: m.sender?.name || m.senderName || 'Deleted User',
          senderAvatar: m.sender?.avatarUrl || m.senderAvatarUrl,
          senderDeleted: !m.sender, // Flag to show user was deleted
          conversationId: m.groupId,
          conversationType: 'group',
          groupName: m.group?.name,
          createdAt: m.createdAt,
          isFlagged: false,
          // File/image attachments
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
          messageType: m.type, // TEXT, IMAGE, FILE, etc.
          // Deletion status - admin can see deleted messages
          isDeleted: m.isDeleted || false,
          deletedAt: m.deletedAt,
          deletedByUser: m.isDeleted && !m.deletedAt ? false : !!m.deletedAt,
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

// DELETE - Permanently delete a message (hard delete - cannot be undone)
export async function DELETE(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await adminRateLimit(request, 'userActions')
    if (rateLimitResult) return rateLimitResult

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
    const { messageId, messageType } = body

    if (!messageId || !messageType) {
      return NextResponse.json(
        { error: 'messageId and messageType are required' },
        { status: 400 }
      )
    }

    // Permanently delete based on message type
    if (messageType === 'DIRECT_MESSAGE' || messageType === 'GROUP_MESSAGE') {
      await prisma.message.delete({
        where: { id: messageId },
      })
    } else if (messageType === 'SESSION_MESSAGE') {
      await prisma.sessionMessage.delete({
        where: { id: messageId },
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      )
    }

    // Log the audit action
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'MESSAGE_PERMANENT_DELETE',
        targetType: 'Message',
        targetId: messageId,
        details: {
          messageType,
          deletedAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Message permanently deleted',
    })
  } catch (error) {
    console.error('Permanent delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Moderate a message (approve, remove, warn)
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (userActions preset: 30 actions/minute)
    const rateLimitResult = await adminRateLimit(request, 'userActions')
    if (rateLimitResult) return rateLimitResult

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
