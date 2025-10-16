import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

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
    console.log('Send connection request body:', body)
    const validation = sendRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('Validation error:', validation.error.issues)
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { receiverId, message } = validation.data
    console.log('Current user ID:', user.id, 'Receiver ID:', receiverId)

    // Check if request already exists
    const existingMatch = await prisma.match.findUnique({
      where: {
        senderId_receiverId: {
          senderId: user.id,
          receiverId: receiverId
        }
      }
    })
    console.log('Existing match check result:', existingMatch ? 'FOUND' : 'NOT FOUND')

    if (existingMatch) {
      console.log('Existing match found:', existingMatch.id, 'status:', existingMatch.status)

      // If there's a PENDING request, don't allow duplicate
      if (existingMatch.status === 'PENDING') {
        return NextResponse.json(
          { error: 'Connection request already sent' },
          { status: 400 }
        )
      }

      // If there's an ACCEPTED connection, they're already connected
      if (existingMatch.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'You are already connected with this user' },
          { status: 400 }
        )
      }

      // If REJECTED or CANCELLED, update the existing match back to PENDING
      const match = await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          status: 'PENDING',
          message: message || null,
          updatedAt: new Date(),
          respondedAt: null
        }
      })

      // Get sender info for notification
      const senderProfile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true }
      })

      // Create notification for receiver
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'MATCH_REQUEST',
          title: 'New Connection Request',
          message: `${senderProfile?.name || 'Someone'} wants to connect with you`,
          isRead: false,
          relatedUserId: user.id,
          relatedMatchId: match.id,
          actionUrl: `/partners`
        }
      })

      return NextResponse.json({
        success: true,
        match,
        message: 'Connection request sent successfully'
      })
    }

    // Check if reverse request exists
    const reverseMatch = await prisma.match.findUnique({
      where: {
        senderId_receiverId: {
          senderId: receiverId,
          receiverId: user.id
        }
      }
    })
    console.log('Reverse match check result:', reverseMatch ? 'FOUND' : 'NOT FOUND')

    if (reverseMatch) {
      console.log('Reverse match found:', reverseMatch.id, 'status:', reverseMatch.status)

      // Only block if there's a PENDING request from the other user
      if (reverseMatch.status === 'PENDING') {
        return NextResponse.json(
          { error: 'This user has already sent you a request' },
          { status: 400 }
        )
      }

      // If ACCEPTED, they're already connected
      if (reverseMatch.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'You are already connected with this user' },
          { status: 400 }
        )
      }

      // If REJECTED or CANCELLED, allow them to send a new request
      // (will create a new match record in the opposite direction)
    }

    // Get sender info
    const senderProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true }
    })

    // Create new match request
    const match = await prisma.match.create({
      data: {
        senderId: user.id,
        receiverId: receiverId,
        status: 'PENDING',
        message: message || null
      }
    })

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'MATCH_REQUEST',
        title: 'New Connection Request',
        message: `${senderProfile?.name || 'Someone'} wants to connect with you`,
        isRead: false,
        relatedUserId: user.id,
        relatedMatchId: match.id,
        actionUrl: `/partners`
      }
    })

    return NextResponse.json({
      success: true,
      match,
      message: 'Connection request sent successfully'
    })
  } catch (error) {
    console.error('Send connection request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
