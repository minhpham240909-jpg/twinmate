// API Route: Clear Server-Side Cache
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateUserCache, invalidateCache, CACHE_PREFIX } from '@/lib/cache'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit cache clear (strict - expensive operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Clear all user-related caches
    await invalidateUserCache(user.id)

    // Clear search caches for this user
    await invalidateCache(`${CACHE_PREFIX.SEARCH}:*`)

    return NextResponse.json({
      success: true,
      message: 'Server cache cleared successfully',
    })
  } catch (error) {
    console.error('[Clear Cache] Error:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}
