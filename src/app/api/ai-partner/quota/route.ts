/**
 * AI Partner Quota API
 * GET /api/ai-partner/quota - Get user's current AI usage quota status
 *
 * Returns:
 * - Current usage (tokens, cost, requests)
 * - Limits
 * - Percentage used
 * - Reset time
 * - Warning/exceeded status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserQuotaStatus } from '@/lib/ai-partner/quota'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    // Light rate limiting for quota checks
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.lenient,
      keyPrefix: 'ai-quota-check',
    })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotaStatus = await getUserQuotaStatus(user.id)

    return NextResponse.json({
      success: true,
      quota: quotaStatus,
    })
  } catch (error) {
    console.error('[AI Quota] Error fetching quota status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quota status' },
      { status: 500 }
    )
  }
}
