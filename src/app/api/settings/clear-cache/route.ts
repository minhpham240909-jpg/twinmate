// API Route: Clear Server-Side Cache
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateUserCache, invalidateCache, CACHE_PREFIX } from '@/lib/cache'

export async function POST() {
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
