/**
 * AI Partner Hide/Show API
 * POST /api/ai-partner/hide - Hide AI Partner from dashboard
 * DELETE /api/ai-partner/hide - Show AI Partner on dashboard again
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST: Hide AI Partner from dashboard (ends active session first)
export async function POST(request: NextRequest) {
  try {
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

    for (const session of activeSessions) {
      const endedAt = new Date()
      const duration = Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)

      await prisma.aIPartnerSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          endedAt,
          totalDuration: duration,
        },
      })

      // Update linked study session if exists
      if (session.studySessionId) {
        await prisma.studySession.update({
          where: { id: session.studySessionId },
          data: {
            status: 'COMPLETED',
            endedAt,
            durationMinutes: Math.round(duration / 60),
          },
        })
      }
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
