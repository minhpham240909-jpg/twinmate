/**
 * AI Partner Completed Session API
 * GET /api/ai-partner/completed-session - Get user's most recently completed AI session
 * Used to show the "session completed" FAB with summary details
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET: Get user's most recently completed session (within last 24 hours)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the most recent completed session from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const completedSession = await prisma.aIPartnerSession.findFirst({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        endedAt: {
          gte: twentyFourHoursAgo,
        },
      },
      select: {
        id: true,
        subject: true,
        skillLevel: true,
        studyGoal: true,
        startedAt: true,
        endedAt: true,
        totalDuration: true,
        messageCount: true,
      },
      orderBy: {
        endedAt: 'desc',
      },
    })

    if (!completedSession) {
      return NextResponse.json({
        success: true,
        hasCompletedSession: false,
        session: null,
      })
    }

    return NextResponse.json({
      success: true,
      hasCompletedSession: true,
      session: {
        id: completedSession.id,
        subject: completedSession.subject,
        skillLevel: completedSession.skillLevel,
        studyGoal: completedSession.studyGoal,
        startedAt: completedSession.startedAt,
        endedAt: completedSession.endedAt,
        duration: completedSession.totalDuration || 0,
        messageCount: completedSession.messageCount,
      },
    })
  } catch (error) {
    console.error('[AI Partner] Get completed session error:', error)
    return NextResponse.json(
      { error: 'Failed to get completed session' },
      { status: 500 }
    )
  }
}
