import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/messages/by-id/[id]
 *
 * Fetches a single message by its ID with complete sender information.
 * Used by realtime subscriptions to get full message details when a new message arrives.
 *
 * Security: Verifies user has access to the conversation (either as sender, recipient, or group member)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required', success: false },
        { status: 400 }
      )
    }

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      )
    }

    const userId = user.id

    // Fetch the message with sender info
    const message = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found', success: false },
        { status: 404 }
      )
    }

    // Security check: Verify user has access to this message
    let hasAccess = false

    if (message.groupId) {
      // Group message - check if user is a member
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId: message.groupId,
          userId: userId
        }
      })
      hasAccess = !!membership
    } else if (message.recipientId) {
      // DM message - check if user is sender or recipient
      hasAccess = message.senderId === userId || message.recipientId === userId
    } else {
      // Edge case: message has no group or recipient (shouldn't happen)
      hasAccess = message.senderId === userId
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied', success: false },
        { status: 403 }
      )
    }

    // Return complete message with sender info
    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        type: message.type,
        senderId: message.senderId,
        recipientId: message.recipientId,
        groupId: message.groupId,
        sender: message.sender,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        isRead: message.isRead,
        isEdited: message.isEdited,
        deletedAt: message.deletedAt,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        callType: message.callType,
        callStatus: message.callStatus,
        callDuration: message.callDuration
      }
    })

  } catch (error) {
    console.error('Error fetching message by ID:', error)
    return NextResponse.json(
      { error: 'Failed to fetch message', success: false },
      { status: 500 }
    )
  }
}
