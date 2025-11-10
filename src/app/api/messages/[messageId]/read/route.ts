import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { messageId } = await params

    // 2. Verify message exists and user is a recipient
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
      },
    })

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // 3. Only allow recipient to mark as read (not sender)
    if (message.recipientId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You are not the recipient' },
        { status: 403 }
      )
    }

    // 4. Create read receipt (upsert to avoid duplicates)
    const readStatus = await prisma.messageReadStatus.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: user.id,
        },
      },
      update: {
        readAt: new Date(), // Update read time if already read
      },
      create: {
        messageId,
        userId: user.id,
        readAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      readStatus: {
        messageId: readStatus.messageId,
        userId: readStatus.userId,
        readAt: readStatus.readAt,
      },
    })
  } catch (error) {
    console.error('[MARK MESSAGE READ ERROR]', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
