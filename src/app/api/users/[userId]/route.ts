// API Route: Get User Profile
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrSetCached, userProfileKey, CACHE_TTL } from '@/lib/cache'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { 
  calculateMatchScore, 
  countFilledFields, 
  getMissingFields,
  hasMinimumProfileData,
  type ProfileData 
} from '@/lib/matching/algorithm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // SECURITY: Rate limit profile views to prevent scraping
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.lenient, // 100 requests per minute
    keyPrefix: 'profile-view',
  })
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const { userId } = await params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if this is the user fetching their own profile (bypass cache for fresh data)
    const isSelfFetch = user.id === userId
    const cacheKey = userProfileKey(userId)
    let dbUser: any = null

    // For self-fetch, bypass cache to ensure fresh profile data (important for profile completion check)
    if (isSelfFetch) {
      console.log('[API] Self-fetch detected, bypassing cache for user:', userId)
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            coverPhotoUrl: true,
            role: true,
            isAdmin: true,
            profile: true,
            createdAt: true,
            presence: {
              select: {
                status: true,
              },
            },
          },
        })
      } catch (error) {
        console.error('Error fetching own profile:', error)
        // Fallback to cached version if direct fetch fails
        dbUser = await getOrSetCached(cacheKey, CACHE_TTL.USER_PROFILE, async () => {
          return await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              coverPhotoUrl: true,
              role: true,
              isAdmin: true,
              profile: true,
              createdAt: true,
            },
          })
        })
      }
    } else {
      // For viewing other profiles, use caching
      dbUser = await getOrSetCached(
        cacheKey,
        CACHE_TTL.USER_PROFILE,
        async () => {
        try {
          return await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          coverPhotoUrl: true,
          role: true,
          isAdmin: true,
          profile: true,
          createdAt: true,
          presence: {
            select: {
              status: true,
            },
          },
        },
      })
        } catch (error) {
          console.error('Error fetching user:', error)
          // Try without presence relation if it fails
          try {
            return await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            // @ts-ignore - coverPhotoUrl exists in schema but Prisma client needs regeneration
            coverPhotoUrl: true,
            role: true,
            isAdmin: true,
            profile: true,
          createdAt: true,
        },
      }).then(user => {
        // Add null presence if not included
        if (user) {
          return { ...user, presence: null }
        }
        return user
      })
          } catch (retryError) {
            console.error('Error fetching user (retry):', retryError)
            throw retryError
          }
        }
      }
    )
    }

    // Ensure dbUser is not null before proceeding
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // SECURITY: Ensure profile exists - use upsert to handle race conditions
    if (!dbUser.profile) {
      try {
        // Use upsert to safely handle concurrent profile creation attempts
        await prisma.profile.upsert({
          where: { userId: dbUser.id },
          create: { userId: dbUser.id },
          update: {}, // No updates needed if it already exists
        })

        // Refetch user with profile
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            isAdmin: true,
            profile: true,
            createdAt: true,
            presence: {
              select: {
                // @ts-ignore - Prisma type inference issue
                onlineStatus: true,
              },
            },
          },
        }) as any
        if (updatedUser) {
          dbUser = updatedUser
        }
      } catch (error) {
        // Upsert failed - log for debugging but continue
        console.error('Profile upsert error:', error)
        // Try to fetch profile one more time in case it was created by another request
        try {
          const refetchedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { profile: true }
          })
          if (refetchedUser?.profile) {
            dbUser.profile = refetchedUser.profile
          }
        } catch (refetchError) {
          console.error('Profile refetch error:', refetchError)
        }
      }
    }

    // Get user's non-deleted posts
    let userPosts: any[] = []
    try {
      userPosts = await prisma.post.findMany({
        where: {
          userId: userId,
          isDeleted: false,
        },
        include: {
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Show latest 10 posts
      })
    } catch (error) {
      console.warn('Error fetching user posts:', error)
      // Continue with empty array
      userPosts = []
    }

    // Check connection status between current user and viewed user
    let connectionStatus = 'none' // 'none' | 'pending' | 'connected'
    let connectionId = null

    if (user.id !== userId) {
      try {
        const connection = await prisma.match.findFirst({
          where: {
            OR: [
              { senderId: user.id, receiverId: userId },
              { senderId: userId, receiverId: user.id },
            ],
          },
          select: {
            id: true,
            status: true,
            senderId: true,
          },
        })

        if (connection) {
          connectionId = connection.id
          if (connection.status === 'ACCEPTED') {
            connectionStatus = 'connected'
          } else if (connection.status === 'PENDING') {
            connectionStatus = 'pending'
          }
        }
      } catch (error) {
        console.warn('Error checking connection status:', error)
        // Continue with default values
      }
    }

    // Calculate match score using the centralized algorithm
    let matchScore: number | null = null
    let matchDataInsufficient = true
    let matchDetails: any = null
    let matchReasons: string[] = []
    let currentUserMissingFields: string[] = []
    let viewedUserMissingFields: string[] = []

    if (user.id !== userId && dbUser.profile) {
      try {
        // Get current user's profile - secure query using Prisma with authenticated user
        const currentUserProfile = await prisma.profile.findUnique({
          where: { userId: user.id },
        })

        if (currentUserProfile && dbUser.profile) {
          // Prepare profile data for the algorithm
          const currentUserProfileData: ProfileData = {
            subjects: currentUserProfile.subjects as string[] | null,
            interests: currentUserProfile.interests as string[] | null,
            goals: currentUserProfile.goals as string[] | null,
            availableDays: currentUserProfile.availableDays as string[] | null,
            skillLevel: currentUserProfile.skillLevel,
            studyStyle: currentUserProfile.studyStyle,
          }

          const viewedUserProfileData: ProfileData = {
            subjects: dbUser.profile.subjects as string[] | null,
            interests: dbUser.profile.interests as string[] | null,
            goals: dbUser.profile.goals as string[] | null,
            availableDays: dbUser.profile.availableDays as string[] | null,
            skillLevel: dbUser.profile.skillLevel,
            studyStyle: dbUser.profile.studyStyle,
          }

          // Calculate match using the centralized algorithm
          const matchResult = calculateMatchScore(currentUserProfileData, viewedUserProfileData)

          matchScore = matchResult.matchScore
          matchDataInsufficient = matchResult.matchDataInsufficient
          matchDetails = matchResult.matchDetails
          matchReasons = matchResult.matchReasons
          currentUserMissingFields = matchResult.currentUserMissingFields
          viewedUserMissingFields = matchResult.partnerMissingFields
        }
      } catch (error) {
        console.warn('Error calculating match score:', error)
        // Continue with default values (matchScore = null)
      }
    }

    // Safely get online status
    let onlineStatus = null
    try {
      if (connectionStatus === 'connected' && dbUser.presence?.onlineStatus) {
        onlineStatus = dbUser.presence.onlineStatus
      }
    } catch (error) {
      console.warn('Error getting online status:', error)
    }

    // SECURITY: Sanitize location data based on privacy settings
    let sanitizedProfile = dbUser.profile
    if (dbUser.profile && user.id !== userId) {
      const locationVisibility = (dbUser.profile as any).location_visibility || 'private'

      // If location is private, always hide it
      if (locationVisibility === 'private') {
        sanitizedProfile = {
          ...dbUser.profile,
          location_city: null,
          location_state: null,
          location_country: null,
        }
      }

      // If location is match-only, only show to accepted partners
      if (locationVisibility === 'match-only' && connectionStatus !== 'connected') {
        sanitizedProfile = {
          ...dbUser.profile,
          location_city: null,
          location_state: null,
          location_country: null,
        }
      }
    }

    // Set cache headers
    // - private: only browser can cache, not CDN
    // - max-age=30: cache for 30 seconds
    // - stale-while-revalidate=60: serve stale while fetching fresh in background
    const cacheHeaders = isSelfFetch
      ? { 'Cache-Control': 'private, no-cache' } // Don't cache own profile
      : { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

    // SECURITY: Only show email to the user themselves, not to other users
    // This prevents email enumeration attacks
    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: isSelfFetch ? dbUser.email : undefined, // CRITICAL: Hide email from other users
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        coverPhotoUrl: dbUser.coverPhotoUrl || null,
        role: dbUser.role,
        isAdmin: dbUser.isAdmin || false,
        onlineStatus,
      },
      profile: sanitizedProfile || null,
      posts: userPosts || [],
      connectionStatus,
      connectionId,
      // Match data - only show real values
      matchScore, // null if not enough data to calculate
      matchDetails: matchDataInsufficient ? null : matchDetails,
      matchReasons: matchDataInsufficient ? [] : matchReasons,
      matchDataInsufficient, // Flag for UI to show "Complete profile for match %" message
      // Profile completeness info
      currentUserMissingFields,
      viewedUserMissingFields,
    }, { headers: cacheHeaders })
  } catch (error) {
    console.error('Get user error:', error)
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}