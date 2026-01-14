import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/presence/studying-count
 * Returns count of users currently studying across all modes
 * (solo focus, partner sessions, AI partner sessions)
 *
 * PERFORMANCE:
 * - Single indexed count query
 * - No N+1 issues
 * - Uses 3-minute activity window for accuracy
 * - Lightweight for frequent polling
 */
export async function GET() {
  try {
    // Activity types that count as "studying"
    const studyingActivityTypes = ['studying', 'in_call', 'with_ai']
    
    // Consider users active if they've been active within the last 3 minutes
    const activityThreshold = new Date(Date.now() - 3 * 60 * 1000)

    // Single optimized count query with indexed filters
    const count = await prisma.userPresence.count({
      where: {
        status: 'online',
        activityType: {
          in: studyingActivityTypes,
        },
        lastActivityAt: {
          gte: activityThreshold,
        },
      },
    })

    return NextResponse.json({
      success: true,
      count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[STUDYING COUNT ERROR]', error)
    return NextResponse.json(
      { success: false, count: 0, error: 'Failed to fetch count' },
      { status: 500 }
    )
  }
}
