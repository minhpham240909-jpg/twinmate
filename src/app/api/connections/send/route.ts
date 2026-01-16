import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { isBlocked } from '@/lib/blocked-users'
import { notifyConnectionRequest } from '@/lib/notifications/send'
import logger from '@/lib/logger'

const sendRequestSchema = z.object({
  receiverId: z.string(),
  message: z.string().optional()
})

export async function POST(request: NextRequest) {
  // Rate limiting: 5 connection requests per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many connection requests. Please try again later.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
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
    logger.debug('Send connection request', { receiverId: body?.receiverId })
    const validation = sendRequestSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Validation error in send connection request', { issues: validation.error.issues })
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { receiverId, message } = validation.data

    // SECURITY: Prevent self-matching
    if (receiverId === user.id) {
      return NextResponse.json(
        { error: 'Cannot send connection request to yourself' },
        { status: 400 }
      )
    }

    // SECURITY: Check if either user has blocked the other
    const blocked = await isBlocked(user.id, receiverId)
    if (blocked) {
      return NextResponse.json(
        { error: 'Unable to send connection request' },
        { status: 403 }
      )
    }

    // Use transaction to prevent race conditions
    let match
    try {
      match = await prisma.$transaction(async (tx) => {
        // Check if request already exists
        const existingMatch = await tx.match.findUnique({
          where: {
            senderId_receiverId: {
              senderId: user.id,
              receiverId: receiverId
            }
          }
        })
        logger.debug('Existing match check', { found: !!existingMatch })

        if (existingMatch) {
          logger.debug('Existing match found', { matchId: existingMatch.id, status: existingMatch.status })

          // If there's a PENDING request, don't allow duplicate
          if (existingMatch.status === 'PENDING') {
            throw new Error('REQUEST_ALREADY_SENT')
          }

          // If there's an ACCEPTED connection, they're already connected
          if (existingMatch.status === 'ACCEPTED') {
            throw new Error('ALREADY_CONNECTED')
          }

          // If REJECTED or CANCELLED, update the existing match back to PENDING
          return await tx.match.update({
            where: { id: existingMatch.id },
            data: {
              status: 'PENDING',
              message: message || null,
              updatedAt: new Date(),
              respondedAt: null
            }
          })
        }

        // Check if reverse request exists
        const reverseMatch = await tx.match.findUnique({
          where: {
            senderId_receiverId: {
              senderId: receiverId,
              receiverId: user.id
            }
          }
        })
        logger.debug('Reverse match check', { found: !!reverseMatch })

        if (reverseMatch) {
          logger.debug('Reverse match found', { matchId: reverseMatch.id, status: reverseMatch.status })

          // Only block if there's a PENDING request from the other user
          if (reverseMatch.status === 'PENDING') {
            throw new Error('REVERSE_REQUEST_EXISTS')
          }

          // If ACCEPTED, they're already connected
          if (reverseMatch.status === 'ACCEPTED') {
            throw new Error('ALREADY_CONNECTED')
          }
        }

        // Create new match request
        return await tx.match.create({
          data: {
            senderId: user.id,
            receiverId: receiverId,
            status: 'PENDING',
            message: message || null
          }
        })
      })
    } catch (txError) {
      // SECURITY: Handle transaction errors properly outside the transaction
      // This ensures reliable error reporting to users
      if (txError instanceof Error) {
        if (txError.message === 'REQUEST_ALREADY_SENT') {
          return NextResponse.json(
            { error: 'Connection request already sent' },
            { status: 400 }
          )
        }
        if (txError.message === 'ALREADY_CONNECTED') {
          return NextResponse.json(
            { error: 'You are already connected with this user' },
            { status: 400 }
          )
        }
        if (txError.message === 'REVERSE_REQUEST_EXISTS') {
          return NextResponse.json(
            { error: 'This user has already sent you a request' },
            { status: 400 }
          )
        }
      }
      // Re-throw unexpected errors to be caught by outer try-catch
      throw txError
    }

    // Get sender info for notification
    const senderProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true }
    })

    // Create notification for receiver - welcoming tone
    // ✅ Inspire action: Encourage checking out the potential partner
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'MATCH_REQUEST',
        title: '👋 New Study Partner Request',
        message: `${senderProfile?.name || 'Someone'} wants to study with you! Check out their profile.`,
        isRead: false,
        relatedUserId: user.id,
        relatedMatchId: match.id,
        actionUrl: `/profile/${user.id}`
      }
    })

    // Send push notification (async, don't wait)
    notifyConnectionRequest(user.id, receiverId, match.id).catch((err) => logger.error('Failed to send connection notification', err))

    return NextResponse.json({
      success: true,
      match,
      message: 'Connection request sent successfully'
    })
  } catch (error) {
    logger.error('Send connection request error', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
