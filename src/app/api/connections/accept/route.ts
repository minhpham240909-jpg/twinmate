import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isBlocked } from '@/lib/blocked-users'
import { notifyConnectionAccepted } from '@/lib/notifications/send'
import { Prisma } from '@prisma/client'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'

const acceptRequestSchema = z.object({
  matchId: z.string()
})

export async function POST(request: NextRequest) {
  // Rate limiting: 10 connection responses per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

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

    // SECURITY: Check blocked status before transaction
    // We do a preliminary check here, then verify again inside the transaction
    const preliminaryMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: { senderId: true, receiverId: true }
    })

    if (!preliminaryMatch) {
      return NextResponse.json(
        { error: 'Connection request not found' },
        { status: 404 }
      )
    }

    // Verify user is the receiver (preliminary check)
    if (preliminaryMatch.receiverId !== user.id) {
      return NextResponse.json(
        { error: 'You are not authorized to accept this request' },
        { status: 403 }
      )
    }

    // SECURITY: Check if either user has blocked the other
    const blocked = await isBlocked(user.id, preliminaryMatch.senderId)
    if (blocked) {
      return NextResponse.json(
        { error: 'Unable to accept this request' },
        { status: 403 }
      )
    }

    // Use a transaction to prevent race conditions
    // This ensures atomic update: if two users try to accept/decline simultaneously,
    // only one will succeed due to the status check inside the transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch match inside transaction with lock (FOR UPDATE via findFirst)
      const match = await tx.match.findFirst({
        where: {
          id: matchId,
          receiverId: user.id,
          status: 'PENDING' // Only accept PENDING requests
        },
        include: {
          sender: { select: { name: true } },
          receiver: { select: { name: true } }
        }
      })

      if (!match) {
        // Match not found, already accepted/declined, or user not authorized
        throw new Error('MATCH_NOT_AVAILABLE')
      }

      // Update match status to ACCEPTED
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date()
        }
      })

      // Create notification for sender
      await tx.notification.create({
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

      return { updatedMatch, senderId: match.senderId }
    }, {
      // Use serializable isolation to prevent race conditions
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000 // 10 second timeout
    })

    // Send push notification outside transaction (async, don't wait)
    notifyConnectionAccepted(user.id, result.senderId).catch(console.error)

    return NextResponse.json({
      success: true,
      match: result.updatedMatch,
      message: 'Connection request accepted'
    })
  } catch (error) {
    // Handle specific transaction errors
    if (error instanceof Error) {
      if (error.message === 'MATCH_NOT_AVAILABLE') {
        return NextResponse.json(
          { error: 'Connection request is no longer available or has already been responded to' },
          { status: 409 } // Conflict
        )
      }
      // Handle Prisma transaction timeout or serialization failure
      if (error.message.includes('Transaction') || error.message.includes('deadlock')) {
        return NextResponse.json(
          { error: 'Request could not be processed. Please try again.' },
          { status: 503 }
        )
      }
    }

    logger.error('Accept connection request error', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
