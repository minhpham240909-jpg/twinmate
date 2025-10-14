import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { MessageType } from '@prisma/client'

export async function POST(req: NextRequest) {
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

    const userId = user.id

    const body = await req.json()
    const { content, type, conversationId, conversationType, fileUrl, fileName, fileSize } = body

    if (!content || !conversationId || !conversationType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let message: {
      id: string
      content: string
      type: MessageType
      senderId: string
      createdAt: Date
      updatedAt?: Date
      fileUrl?: string | null
      fileName?: string | null
      fileSize?: number | null
      isRead?: boolean
      isEdited?: boolean
      sender: {
        id: string
        name: string
        avatarUrl: string | null
      }
    }

    if (conversationType === 'group') {
      // Verify user is a member of this group
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: conversationId,
          userId: userId
        }
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this group' },
          { status: 403 }
        )
      }

      // Create group message
      message = await prisma.message.create({
        data: {
          content,
          type: type || 'TEXT',
          senderId: userId,
          groupId: conversationId,
          fileUrl,
          fileName,
          fileSize
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      })

      // Create notifications for all group members except sender
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: conversationId,
          userId: { not: userId }
        },
        select: { userId: true }
      })

      // Get sender's name and group name for notification
      const senderUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      })

      const group = await prisma.group.findUnique({
        where: { id: conversationId },
        select: { name: true }
      })

      if (groupMembers.length > 0) {
        const contentPreview = content.length > 50
          ? content.substring(0, 50) + '...'
          : content

        await prisma.notification.createMany({
          data: groupMembers.map(member => ({
            userId: member.userId,
            type: 'NEW_MESSAGE',
            title: `New message in ${group?.name || 'group'}`,
            message: `${senderUser?.name || 'Someone'}: ${contentPreview}`,
            actionUrl: `/chat?conversation=${conversationId}&type=group`,
            relatedUserId: userId
          }))
        }).catch(err => console.error('Failed to create group notifications:', err))
      }

    } else if (conversationType === 'partner') {
      // Verify there's an accepted match
      const match = await prisma.match.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: conversationId, status: 'ACCEPTED' },
            { senderId: conversationId, receiverId: userId, status: 'ACCEPTED' }
          ]
        }
      })

      if (!match) {
        return NextResponse.json(
          { error: 'No active partnership found' },
          { status: 403 }
        )
      }

      // Create DM message
      message = await prisma.message.create({
        data: {
          content,
          type: type || 'TEXT',
          senderId: userId,
          recipientId: conversationId,
          fileUrl,
          fileName,
          fileSize
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      })

      // Create notification for recipient
      // Get sender's name for notification
      const senderUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      })

      await prisma.notification.create({
        data: {
          userId: conversationId,
          type: 'NEW_MESSAGE',
          title: 'New message',
          message: `${senderUser?.name || 'Someone'} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          actionUrl: `/chat?conversation=${userId}&type=partner`
        }
      }).catch(err => console.error('Failed to create notification:', err))

    } else {
      return NextResponse.json(
        { error: 'Invalid conversation type' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        type: message.type,
        senderId: message.senderId,
        sender: message.sender,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        isRead: message.isRead,
        isEdited: message.isEdited,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      },
      success: true
    })

  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
