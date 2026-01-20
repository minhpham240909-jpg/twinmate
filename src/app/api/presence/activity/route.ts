import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * POST /api/presence/activity
 * Updates user's activity type (studying, in_call, with_ai, browsing, idle)
 *
 * This is called when users:
 * - Start/end a study session
 * - Join/leave a call
 * - Start/end an AI partner session
 *
 * PERF: Rate limited to prevent DB spam (realtime preset: 500/min)
 * NO N+1: Single upsert query
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit activity updates to prevent DB spam
    // Uses realtime preset (500 req/min) - appropriate for presence updates
    const rateLimitResult = await rateLimit(request, { 
      ...RateLimitPresets.realtime, 
      keyPrefix: 'presence-activity' 
    })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many activity updates. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { activityType, activityDetails } = body

    // Validate activity type
    const validActivityTypes = ['browsing', 'studying', 'in_call', 'with_ai', 'idle']
    if (!validActivityTypes.includes(activityType)) {
      return NextResponse.json(
        { error: 'Invalid activity type' },
        { status: 400 }
      )
    }

    // Upsert presence with new activity type
    await prisma.userPresence.upsert({
      where: { userId: user.id },
      update: {
        activityType,
        activityDetails: activityDetails ? JSON.stringify(activityDetails) : null,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        status: 'online',
        activityType,
        activityDetails: activityDetails ? JSON.stringify(activityDetails) : null,
        lastSeenAt: new Date(),
        lastActivityAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PRESENCE ACTIVITY ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
