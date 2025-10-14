import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// DELETE - Soft delete a message
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, messageId } = await params

    // Get the message
    const message = await prisma.sessionMessage.findUnique({
      where: { id: messageId },
    })

    if (!message || message.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if message is already deleted
    if (message.deletedAt) {
      return NextResponse.json({ error: 'Message already deleted' }, { status: 400 })
    }

    // Check permissions: sender or host can delete
    const isSender = message.senderId === user.id

    // Check if user is host
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        role: 'HOST',
      },
    })

    const isHost = !!participant

    if (!isSender && !isHost) {
      return NextResponse.json(
        { error: 'You can only delete your own messages or you must be the host' },
        { status: 403 }
      )
    }

    // Soft delete the message
    const deletedMessage = await prisma.sessionMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
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
