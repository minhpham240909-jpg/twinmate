import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    // Note: messageId here actually represents conversationId (groupId or partnerId)
    // The folder is named [messageId] to match the slug naming convention
    const { messageId: conversationId } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Check if conversationId is a group or partner
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get('type') // 'partner' or 'group'

    // Pagination parameters (prevent loading all messages at once)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100 messages
    const cursor = searchParams.get('cursor') // Message ID to load messages before
    const page = parseInt(searchParams.get('page') || '1')

    let messages: Array<{
      id: string
      content: string
      type: string
      senderId: string | null // Nullable - user may have been deleted
      createdAt: Date
      updatedAt?: Date
      isRead: boolean
      deletedAt?: Date | null
      fileUrl?: string | null
      fileName?: string | null
      fileSize?: number | null
      isEdited?: boolean
      // Cached sender info - preserved even after account deletion
      senderName?: string | null
      senderEmail?: string | null
      senderAvatarUrl?: string | null
      sender: {
        id: string
        name: string
        avatarUrl: string | null
      } | null // Nullable - user may have been deleted
    }> = []
    let conversationInfo: Record<string, unknown> | null = null

    if (type === 'group') {
      // Verify user is a member of this group
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: conversationId,
          userId: userId
        },
        include: {
          group: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatarUrl: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this group' },
          { status: 403 }
        )
      }

      conversationInfo = {
        id: membership.group.id,
        name: membership.group.name,
        avatarUrl: membership.group.avatarUrl,
        type: 'group',
        members: membership.group.members.map(m => ({
          ...m.user,
          role: m.role
        }))
      }

      // Get group messages with pagination (prevent loading all messages)
      const whereClause: Prisma.MessageWhereInput = {
        groupId: conversationId,
        ...(cursor && { id: { lt: cursor } }) // Load messages before the cursor
      }

      messages = await prisma.message.findMany({
        where: whereClause,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc' // Load newest first, then reverse for display
        },
        take: limit
      })

      // Reverse to show oldest first (chronological order)
      messages.reverse()

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          groupId: conversationId,
          senderId: { not: userId },
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

    } else if (type === 'partner') {
      // Verify there's an accepted match between users
      const match = await prisma.match.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: conversationId, status: 'ACCEPTED' },
            { senderId: conversationId, receiverId: userId, status: 'ACCEPTED' }
          ]
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              presence: {
                select: {
                  status: true
                }
              }
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              presence: {
                select: {
                  status: true
                }
              }
            }
          }
        }
      })

      if (!match) {
        return NextResponse.json(
          { error: 'No active partnership found' },
          { status: 403 }
        )
      }

      const partner = match.senderId === userId ? match.receiver : match.sender

      conversationInfo = {
        id: partner.id,
        name: partner.name,
        avatarUrl: partner.avatarUrl,
        type: 'partner',
        onlineStatus: partner.presence?.status || 'offline'
      }

      // Get DM messages with pagination
      const dmWhereClause: Prisma.MessageWhereInput = {
        OR: [
          { senderId: userId, recipientId: conversationId },
          { senderId: conversationId, recipientId: userId }
        ],
        groupId: null,
        ...(cursor && { id: { lt: cursor } })
      }

      messages = await prisma.message.findMany({
        where: dmWhereClause,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc' // Load newest first, then reverse
        },
        take: limit
      })

      // Reverse to show oldest first (chronological order)
      messages.reverse()

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          senderId: conversationId,
          recipientId: userId,
          isRead: false,
          groupId: null
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid conversation type' },
        { status: 400 }
      )
    }

    // Determine if there are more messages to load
    const hasMore = messages.length === limit
    const nextCursor = hasMore && messages.length > 0 ? messages[0].id : null

    return NextResponse.json({
      conversationInfo,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        type: msg.type,
        senderId: msg.senderId,
        sender: msg.sender,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        isRead: msg.isRead,
        isEdited: msg.isEdited,
        deletedAt: msg.deletedAt,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt
      })),
      pagination: {
        limit,
        hasMore,
        nextCursor,
        currentCount: messages.length
      },
      success: true
    })

  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
