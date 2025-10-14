import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const acceptRequestSchema = z.object({
  matchId: z.string()
})

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const validation = acceptRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { matchId } = validation.data

    // Find the match request
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        sender: { select: { name: true } },
        receiver: { select: { name: true } }
      }
    })

    if (!match) {
      return NextResponse.json(
        { error: 'Connection request not found' },
        { status: 404 }
      )
    }

    // Verify user is the receiver
    if (match.receiverId !== user.id) {
      return NextResponse.json(
        { error: 'You are not authorized to accept this request' },
        { status: 403 }
      )
    }

    // Update match status to ACCEPTED
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date()
      }
    })

    // Create notification for sender
    await prisma.notification.create({
      data: {
        userId: match.senderId,
        type: 'MATCH_ACCEPTED',
        title: 'Connection Request Accepted',
        message: `${match.receiver.name} accepted your connection request`,
        isRead: false,
        relatedUserId: user.id,
        relatedMatchId: match.id,
        actionUrl: `/chat?userId=${user.id}`
      }
    })

    // Mark the connection request notification as read
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        relatedMatchId: matchId,
        type: 'MATCH_REQUEST'
      },
      data: {
        isRead: true
      }
    })

    return NextResponse.json({
      success: true,
      match: updatedMatch,
      message: 'Connection request accepted'
    })
  } catch (error) {
    console.error('Accept connection request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
