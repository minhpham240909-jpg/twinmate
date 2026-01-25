/**
 * AI Partner Dashboard API
 * GET /api/ai-partner/dashboard - Get AI Partner status for dashboard widget
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { hasAIPartnerSessions, getActiveOrPausedSession } from '@/lib/ai-partner'
import { prisma } from '@/lib/prisma'

// GET: Get AI Partner dashboard data
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

    // Check if user has hidden AI Partner from dashboard
    const userSettings = await prisma.user.findUnique({
      where: { id: user.id },
      select: { hideAIPartner: true },
    })

    // If user has hidden AI Partner, don't show widget
    if (userSettings?.hideAIPartner) {
      return NextResponse.json({
        success: true,
        showWidget: false,
        hidden: true,
        hasUsedAIPartner: true, // They used it before but chose to hide
      })
    }

    // Check if user has ever used AI Partner
    const hasUsed = await hasAIPartnerSessions(user.id)

    if (!hasUsed) {
      return NextResponse.json({
        success: true,
        showWidget: false,
        hidden: false,
        hasUsedAIPartner: false,
      })
    }

    // Get active or paused session
    const currentSession = await getActiveOrPausedSession(user.id)

    // Get total session count and stats
    const stats = await prisma.aIPartnerSession.aggregate({
      where: { userId: user.id },
      _count: true,
      _sum: {
        totalDuration: true,
        messageCount: true,
      },
    })

    // Get the most recent completed session for "continue previous topic" feature
    // Include searchCriteria so we can restore all filters (subjects, location, interests, etc.)
    const lastCompletedSession = await prisma.aIPartnerSession.findFirst({
      where: {
        userId: user.id,
        status: 'COMPLETED',
      },
      orderBy: { endedAt: 'desc' },
      select: {
        id: true,
        subject: true,
        endedAt: true,
        messageCount: true,
        searchCriteria: true, // Full search criteria for continuing session
        skillLevel: true,
        studyGoal: true,
      },
    })

    return NextResponse.json({
      success: true,
      showWidget: true,
      hidden: false,
      hasUsedAIPartner: true,
      currentSession,
      lastCompletedSession,
      stats: {
        totalSessions: stats._count,
        totalDuration: stats._sum.totalDuration || 0,
        totalMessages: stats._sum.messageCount || 0,
      },
    })
  } catch (error) {
    console.error('[AI Partner] Dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to get dashboard data' },
      { status: 500 }
    )
  }
}
