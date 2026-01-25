/**
 * AI Partner Session Feedback API
 * POST /api/ai-partner/session/[sessionId]/feedback - Submit session feedback
 *
 * This endpoint allows users to submit feedback when the study timer ends
 * without ending the session. The feedback is stored and can be viewed by admins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

// POST: Submit session feedback
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - moderate for feedback submission
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
    const body = await request.json().catch(() => ({}))
    const { rating, feedback, focusTime } = body

    // Validate rating if provided
    if (rating !== null && rating !== undefined) {
      const ratingNum = parseInt(rating)
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
      }
    }

    // Validate feedback length if provided
    if (feedback && typeof feedback === 'string' && feedback.length > 500) {
      return NextResponse.json({ error: 'Feedback must be 500 characters or less' }, { status: 400 })
    }

    // Check if session exists and belongs to user
    const session = await prisma.aIPartnerSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        rating: true,
        feedback: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update session with feedback
    const updatedSession = await prisma.aIPartnerSession.update({
      where: { id: sessionId },
      data: {
        ...(rating !== null && rating !== undefined && { rating: parseInt(rating) }),
        ...(feedback !== null && feedback !== undefined && { feedback: feedback.trim() || null }),
        ...(focusTime !== null && focusTime !== undefined && { focusTime: parseInt(focusTime) }),
      },
      select: {
        id: true,
        rating: true,
        feedback: true,
        focusTime: true,
      },
    })

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })
  } catch (error) {
    console.error('[AI Partner] Submit feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
