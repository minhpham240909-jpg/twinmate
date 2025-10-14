import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// DELETE - Soft delete a message
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params

    // Get the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if message is already deleted
    if (message.deletedAt) {
      return NextResponse.json({ error: 'Message already deleted' }, { status: 400 })
    }

    // Check permissions
    const isSender = message.senderId === user.id

    // For group messages, check if user is admin or owner
    let isGroupAdmin = false
    if (message.groupId) {
      const membership = message.group?.members.find(m => m.userId === user.id)
      isGroupAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER'
    }

    // User can delete if:
    // 1. They are the sender, OR
    // 2. It's a group message and they are an admin/owner
    if (!isSender && !isGroupAdmin) {
      return NextResponse.json(
        { error: 'You can only delete your own messages or you must be a group admin' },
        { status: 403 }
      )
    }

    // Soft delete the message
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
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

    return NextResponse.json({
      success: true,
      message: deletedMessage,
    })
  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    )
  }
}
