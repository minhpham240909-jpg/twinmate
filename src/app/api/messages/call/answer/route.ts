/**
 * API endpoint to handle call answer (accept/decline)
 * Updates the call message status and triggers realtime updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { CallStatus } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export async function POST(req: NextRequest) {
  // Rate limit: 15 answer operations per minute
  const rateLimitResult = await rateLimit(req, { max: 15, windowMs: 60 * 1000, keyPrefix: 'call-answer' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.' },
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

    const body = await req.json()
    const { messageId, action } = body

    if (!messageId || !action) {
      return NextResponse.json(
        { error: 'Missing messageId or action' },
        { status: 400 }
      )
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "accept" or "decline"' },
        { status: 400 }
      )
    }

    // Fetch the call message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        groupId: true,
        callStatus: true,
        type: true
      }
    })

    if (!message) {
      return NextResponse.json(
        { error: 'Call message not found' },
        { status: 404 }
      )
    }

    if (message.type !== 'CALL') {
      return NextResponse.json(
        { error: 'Message is not a call' },
        { status: 400 }
      )
    }

    // Verify user is the recipient of this call (not the sender)
    const isRecipient = message.recipientId === user.id ||
      (message.groupId && await prisma.groupMember.findFirst({
        where: {
          groupId: message.groupId,
          userId: user.id
        }
      }))

    if (!isRecipient) {
      return NextResponse.json(
        { error: 'You are not authorized to answer this call' },
        { status: 403 }
      )
    }

    // Only allow answering if call is still in STARTED state
    if (message.callStatus !== 'STARTED') {
      return NextResponse.json(
        { error: 'Call is no longer active' },
        { status: 400 }
      )
    }

    // Update call status based on action
    const newStatus: CallStatus = action === 'accept' ? 'STARTED' : 'DECLINED'

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        callStatus: newStatus,
        // If declined, update content to show declined status
        ...(action === 'decline' && {
          content: 'Call declined'
        })
      },
      select: {
        id: true,
        callStatus: true,
        content: true
      }
    })

    return NextResponse.json({
      success: true,
      message: updatedMessage,
      action
    })

  } catch (error) {
    console.error('Error handling call answer:', error)
    return NextResponse.json(
      { error: 'Failed to handle call answer' },
      { status: 500 }
    )
  }
}
