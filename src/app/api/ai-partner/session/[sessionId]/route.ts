/**
 * AI Partner Session Details API
 * GET /api/ai-partner/session/[sessionId] - Get session details
 * DELETE /api/ai-partner/session/[sessionId] - End session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { getSession, endSession } from '@/lib/ai-partner'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

// GET: Get session details with messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - lenient for read operations
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
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

    const { sessionId } = await params
    const aiSession = await getSession(sessionId, user.id)

    if (!aiSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session: aiSession,
    })
  } catch (error) {
    console.error('[AI Partner] Get session error:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}

// DELETE: End session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - strict for session termination
    const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
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

    const { sessionId } = await params
    const body = await request.json().catch(() => ({}))
    const { rating, feedback, focusTime } = body

    const result = await endSession({
      sessionId,
      userId: user.id,
      rating: rating ? parseInt(rating) : undefined,
      feedback,
      // focusTime is the Pomodoro timer time - only counted when user clicks Start Timer
      // If focusTime is 0 or undefined, it means user never started the timer
      focusTime: focusTime ? parseInt(focusTime) : undefined,
    })

    return NextResponse.json({
      success: true,
      summary: result.summary,
      duration: result.duration,
    })
  } catch (error) {
    console.error('[AI Partner] End session error:', error)
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    )
  }
}
