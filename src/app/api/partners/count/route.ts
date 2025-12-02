import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrSetCached } from '@/lib/cache'

export async function GET() {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Cache key for this user's partner count
    const cacheKey = `partners:count:${user.id}`

    // Get from cache or fetch from database
    const activePartnersCount = await getOrSetCached<number>(
      cacheKey,
      60, // Cache for 60 seconds
      async () => {
        return prisma.match.count({
          where: {
            status: 'ACCEPTED',
            OR: [
              { senderId: user.id },
              { receiverId: user.id }
            ]
          }
        })
      }
    )

    return NextResponse.json({
      success: true,
      count: activePartnersCount
    })
  } catch (error) {
    console.error('Fetch partners count error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
