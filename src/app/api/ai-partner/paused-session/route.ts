/**
 * AI Partner Paused Session API
 * GET /api/ai-partner/paused-session - Get user's paused AI session (if any)
 * Optimized single query to check for paused sessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

// GET: Get user's paused session (optimized single query)
export async function GET(request: NextRequest) {
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

    // Single optimized query - get the most recent paused session
    const pausedSession = await prisma.aIPartnerSession.findFirst({
      where: {
        userId: user.id,
        status: 'PAUSED',
      },
      select: {
        id: true,
        subject: true,
        startedAt: true,
        totalDuration: true,
        messageCount: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    })

    if (!pausedSession) {
      return NextResponse.json({
        success: true,
        hasPausedSession: false,
        session: null,
      })
    }

    return NextResponse.json({
      success: true,
      hasPausedSession: true,
      session: {
        id: pausedSession.id,
        subject: pausedSession.subject,
        startedAt: pausedSession.startedAt,
        duration: pausedSession.totalDuration || 0,
        messageCount: pausedSession.messageCount,
      },
    })
  } catch (error) {
    console.error('[AI Partner] Get paused session error:', error)
    return NextResponse.json(
      { error: 'Failed to get paused session' },
      { status: 500 }
    )
  }
}
