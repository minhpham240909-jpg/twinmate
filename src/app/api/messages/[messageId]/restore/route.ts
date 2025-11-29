import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/messages/[messageId]/restore - Restore a deleted message
export async function POST(
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
    }) as any

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if message is deleted
    if (!message.isDeleted) {
      return NextResponse.json({ error: 'Message is not deleted' }, { status: 400 })
    }

    // Check if message belongs to user
    // For DMs: check senderId or recipientId
    // For groups: check if user is a member of the group
    let hasAccess = message.senderId === user.id || message.recipientId === user.id

    if (!hasAccess && message.groupId) {
      // Check group membership for group messages
      const groupMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: message.groupId,
            userId: user.id,
          },
        },
      })
      hasAccess = !!groupMember
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You can only restore messages you have access to' },
        { status: 403 }
      )
    }

    // Check if 30 days have passed
    if (message.deletedAt) {
      const daysSinceDeletion = Math.floor(
        (Date.now() - new Date(message.deletedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceDeletion > 30) {
        return NextResponse.json(
          { error: 'Message cannot be restored after 30 days' },
          { status: 400 }
        )
      }
    }

    // Restore the message
    const restoredMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: false,
        deletedAt: null,
      } as any,
    })

    return NextResponse.json({
      success: true,
      message: restoredMessage,
    })
  } catch (error) {
    console.error('Error restoring message:', error)
    return NextResponse.json(
      { error: 'Failed to restore message' },
      { status: 500 }
    )
  }
}

