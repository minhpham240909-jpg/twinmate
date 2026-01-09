import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrSetCached, CACHE_TTL } from '@/lib/cache'

/**
 * GET /api/partners/active
 * Fetches all accepted partners with their profile and presence data
 *
 * OPTIMIZED: Single query with JOINs to avoid N+1 issues
 * - Fetches matches with partner details and presence in one query
 * - Uses Prisma's nested includes for efficient data fetching
 */
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

    // Cache key for this user's active partners
    const cacheKey = `partners:active:${user.id}`

    // Get from cache or fetch from database (30 second cache for presence freshness)
    const partners = await getOrSetCached(
      cacheKey,
      CACHE_TTL.ONLINE_USERS, // 30 seconds - short TTL for online status accuracy
      async () => {
        // OPTIMIZED: Single query with nested includes for partners AND their presence
        // This avoids N+1 by fetching everything in one database call
        const matches = await prisma.match.findMany({
          where: {
            OR: [
              { senderId: user.id, status: 'ACCEPTED' },
              { receiverId: user.id, status: 'ACCEPTED' }
            ]
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                // Include presence directly in the user query (no N+1)
                presence: {
                  select: {
                    status: true,
                    lastSeenAt: true,
                    isPrivate: true
                  }
                },
                profile: {
                  select: {
                    bio: true,
                    subjects: true,
                    interests: true,
                    goals: true,
                    skillLevel: true,
                    studyStyle: true,
                    location_city: true,
                    location_state: true,
                    location_country: true,
                    location_visibility: true,
                    timezone: true,
                    availableDays: true,
                    availableHours: true,
                    aboutYourself: true,
                    aboutYourselfItems: true
                  }
                }
              }
            },
            receiver: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                // Include presence directly in the user query (no N+1)
                presence: {
                  select: {
                    status: true,
                    lastSeenAt: true,
                    isPrivate: true
                  }
                },
                profile: {
                  select: {
                    bio: true,
                    subjects: true,
                    interests: true,
                    goals: true,
                    skillLevel: true,
                    studyStyle: true,
                    location_city: true,
                    location_state: true,
                    location_country: true,
                    location_visibility: true,
                    timezone: true,
                    availableDays: true,
                    availableHours: true,
                    aboutYourself: true,
                    aboutYourselfItems: true
                  }
                }
              }
            }
          },
          orderBy: {
            updatedAt: 'desc'
          }
        })

        // Extract partners (not the current user) with presence data
        return matches.map(match => {
          const partner = match.senderId === user.id ? match.receiver : match.sender
          const presence = partner.presence

          // Determine online status from presence data
          // Check if presence exists and user hasn't gone offline (lastSeenAt within 2 minutes)
          let onlineStatus = 'OFFLINE'
          if (presence && !presence.isPrivate) {
            const lastSeenAt = presence.lastSeenAt
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)

            // User is online if status is 'online' AND they've been seen recently
            if (presence.status === 'online' && lastSeenAt > twoMinutesAgo) {
              onlineStatus = 'ONLINE'
            }
          }

          // SECURITY: Sanitize location data based on privacy settings
          let locationCity = null
          let locationState = null
          let locationCountry = null

          if (partner.profile) {
            const locationVisibility = (partner.profile as any).location_visibility || 'private'

            // Show location if public OR if match-only (since these are accepted partners)
            if (locationVisibility === 'public' || locationVisibility === 'match-only') {
              locationCity = (partner.profile as any).location_city
              locationState = (partner.profile as any).location_state
              locationCountry = (partner.profile as any).location_country
            }
          }

          return {
            matchId: match.id,
            id: partner.id,
            name: partner.name,
            avatarUrl: partner.avatarUrl,
            onlineStatus,
            profile: partner.profile ? {
              bio: partner.profile.bio,
              subjects: partner.profile.subjects,
              interests: partner.profile.interests,
              goals: partner.profile.goals,
              skillLevel: partner.profile.skillLevel,
              studyStyle: partner.profile.studyStyle,
              onlineStatus,
              locationCity,
              locationState,
              locationCountry,
              timezone: partner.profile.timezone,
              availableDays: partner.profile.availableDays,
              availableHours: partner.profile.availableHours,
              aboutYourself: partner.profile.aboutYourself,
              aboutYourselfItems: partner.profile.aboutYourselfItems
            } : null,
            connectedAt: match.updatedAt
          }
        })
      }
    )

    return NextResponse.json({
      success: true,
      partners
    })
  } catch (error) {
    console.error('Fetch active partners error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
