import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isBlocked } from '@/lib/blocked-users'

const declineRequestSchema = z.object({
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
    const validation = declineRequestSchema.safeParse(body)

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
        { error: 'You are not authorized to decline this request' },
        { status: 403 }
      )
    }

    // SECURITY: Check if either user has blocked the other
    // (decline should still work but we reject silently for blocked users)
    const blocked = await isBlocked(user.id, match.senderId)
    if (blocked) {
      return NextResponse.json(
        { error: 'Unable to process this request' },
        { status: 403 }
      )
    }

    // Perform all operations in a single transaction to ensure atomicity
    const updatedMatch = await prisma.$transaction(async (tx) => {
      // Update match status to REJECTED
      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'REJECTED',
          respondedAt: new Date()
        }
      })

      // Create notification for sender
      await tx.notification.create({
        data: {
          userId: match.senderId,
          type: 'MATCH_DECLINED',
          title: 'Connection Request Declined',
          message: `${match.receiver.name} declined your connection request`,
          isRead: false,
          relatedUserId: user.id,
          relatedMatchId: match.id
        }
      })

      // Mark the connection request notification as read
      await tx.notification.updateMany({
        where: {
          userId: user.id,
          relatedMatchId: matchId,
          type: 'MATCH_REQUEST'
        },
        data: {
          isRead: true
        }
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      match: updatedMatch,
      message: 'Connection request declined'
    })
  } catch (error) {
    console.error('Decline connection request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
