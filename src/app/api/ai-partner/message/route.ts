/**
 * AI Partner Message API
 * POST /api/ai-partner/message - Send message to AI partner
 *
 * SCALABILITY: Uses Redis-based rate limiting and per-user quota for 1000-3000 concurrent users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/ai-partner'
import { rateLimit } from '@/lib/rate-limit'
import { enforceQuota } from '@/lib/ai-partner/quota'

// AI Partner rate limit: 30 messages per minute per user
const AI_PARTNER_RATE_LIMIT = {
  max: 30,
  windowMs: 60000,
  keyPrefix: 'ai-partner-message',
}

// POST: Send message to AI partner
export async function POST(request: NextRequest) {
  try {
    // SCALABILITY: Apply Redis-based rate limiting (works across serverless instances)
    const rateLimitResult = await rateLimit(request, AI_PARTNER_RATE_LIMIT)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SCALABILITY: Check per-user daily quota
    const quotaCheck = await enforceQuota(user.id)
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: quotaCheck.error!.message, quotaExceeded: true },
        { status: quotaCheck.error!.status }
      )
    }

    const body = await request.json()
    const { sessionId, content, messageType } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 })
    }

    const result = await sendMessage({
      sessionId,
      userId: user.id,
      content: content.trim(),
      messageType,
    })

    return NextResponse.json({
      success: true,
      userMessage: result.userMessage,
      aiMessage: result.aiMessage,
      safetyBlocked: result.safetyBlocked,
      generatedImage: result.generatedImage, // Include image generation result if any
      quotaWarning: quotaCheck.warning, // Include quota warning if approaching limit
    })
  } catch (error) {
    console.error('[AI Partner] Send message error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Duplicate request detected')) {
        return NextResponse.json(
          { error: 'Duplicate request detected. Please wait a moment before sending again.' },
          { status: 429 }
        )
      }
      if (error.message === 'Session not found') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      if (error.message === 'Session is not active') {
        return NextResponse.json({ error: 'Session has ended' }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
