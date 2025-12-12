/**
 * AI Partner Message API
 * POST /api/ai-partner/message - Send message to AI partner
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/ai-partner'

// Simple per-user rate limit to protect OpenAI/DB (30 requests per minute)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) || []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  rateLimitMap.set(userId, recent)
  return recent.length > RATE_LIMIT_MAX
}

// POST: Send message to AI partner
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
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
