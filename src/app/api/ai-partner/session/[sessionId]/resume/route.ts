/**
 * AI Partner Resume Session API
 * POST /api/ai-partner/session/[sessionId]/resume - Resume a paused session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { resumeSession } from '@/lib/ai-partner'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

// POST: Resume session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - moderate for session state changes
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
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

    const result = await resumeSession({
      sessionId,
      userId: user.id,
    })

    return NextResponse.json({
      success: result.success,
      welcomeBackMessage: result.welcomeBackMessage,
    })
  } catch (error) {
    console.error('[AI Partner] Resume session error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (error.message === 'Session is not paused') {
        return NextResponse.json({ error: 'Session is not paused' }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to resume session' },
      { status: 500 }
    )
  }
}
