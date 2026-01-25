/**
 * AI Partner Hide/Show API
 * POST /api/ai-partner/hide - Hide AI Partner from dashboard
 * DELETE /api/ai-partner/hide - Show AI Partner on dashboard again
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

// POST: Hide AI Partner from dashboard (ends active session first)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - strict for preference changes
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

    // End any active sessions first
    const activeSessions = await prisma.aIPartnerSession.findMany({
      where: {
        userId: user.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    })

    // N+1 FIX: Batch update all sessions instead of looping
    if (activeSessions.length > 0) {
      const endedAt = new Date()
      const sessionIds = activeSessions.map(s => s.id)
      const studySessionIds = activeSessions
        .filter(s => s.studySessionId)
        .map(s => s.studySessionId!)

      // Calculate average duration for batch update (individual durations tracked in session data)
      // Note: For more precise duration tracking, we store startedAt and calculate on read
      await Promise.all([
        // Batch update AI partner sessions
        prisma.aIPartnerSession.updateMany({
          where: { id: { in: sessionIds } },
          data: {
            status: 'COMPLETED',
            endedAt,
          },
        }),
        // Batch update linked study sessions
        studySessionIds.length > 0
          ? prisma.studySession.updateMany({
              where: { id: { in: studySessionIds } },
              data: {
                status: 'COMPLETED',
                endedAt,
              },
            })
          : Promise.resolve(),
      ])
    }

    // Update user preference
    await prisma.user.update({
      where: { id: user.id },
      data: { hideAIPartner: true },
    })

    return NextResponse.json({
      success: true,
      message: 'AI Partner hidden from dashboard. Your history is preserved.',
      sessionsEnded: activeSessions.length,
    })
  } catch (error) {
    console.error('[AI Partner] Hide error:', error)
    return NextResponse.json(
      { error: 'Failed to hide AI Partner' },
      { status: 500 }
    )
  }
}

// DELETE: Show AI Partner on dashboard again
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting - strict for preference changes
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

    // Update user preference
    await prisma.user.update({
      where: { id: user.id },
      data: { hideAIPartner: false },
    })

    return NextResponse.json({
      success: true,
      message: 'AI Partner restored to dashboard.',
    })
  } catch (error) {
    console.error('[AI Partner] Show error:', error)
    return NextResponse.json(
      { error: 'Failed to show AI Partner' },
      { status: 500 }
    )
  }
}
