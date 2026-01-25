/**
 * API Route: Check User Access Status
 * Returns whether the current user is banned or deactivated
 * Used by frontend to show appropriate UI
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { checkUserAccess } from '@/lib/security/checkUserBan'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for access status checks
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessStatus = await checkUserAccess(user.id)

    return NextResponse.json({
      canAccess: accessStatus.canAccess,
      reason: accessStatus.reason,
      banStatus: accessStatus.banStatus ? {
        isBanned: accessStatus.banStatus.isBanned,
        banType: accessStatus.banStatus.banType,
        expiresAt: accessStatus.banStatus.expiresAt?.toISOString(),
        reason: accessStatus.banStatus.reason,
        bannedAt: accessStatus.banStatus.bannedAt?.toISOString(),
      } : undefined,
      isDeactivated: accessStatus.isDeactivated,
    })
  } catch (error) {
    console.error('[access-status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check access status' },
      { status: 500 }
    )
  }
}
