// API Route: Get User Profile
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrSetCached, userProfileKey, CACHE_TTL } from '@/lib/cache'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

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

    // Get user with profile and posts (with caching)
    const cacheKey = userProfileKey(userId)
    let dbUser: any = null
    
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

    // Calculate match score with detailed breakdown (aligned with search API logic)
    let matchScore: number | null = null
    let matchDataInsufficient = true
    const matchDetails = {
      subjects: {
        count: 0,
        items: [] as string[],
        score: 0,
      },
      interests: {
        count: 0,
        items: [] as string[],
        score: 0,
      },
      goals: {
        count: 0,
        items: [] as string[],
      },
      skillLevel: {
        matches: false,
        value: null as string | null,
      },
      studyStyle: {
        matches: false,
        value: null as string | null,
      },
    }

    if (user.id !== userId && dbUser.profile) {
      try {
        // Get current user's profile - secure query using Prisma with authenticated user
        const currentUserProfile = await prisma.profile.findUnique({
          where: { userId: user.id },
        })

        if (currentUserProfile && dbUser.profile) {
          // Check if current user has enough profile data for meaningful matching
          const currentHasSubjects = Array.isArray(currentUserProfile.subjects) && currentUserProfile.subjects.length > 0
          const currentHasInterests = Array.isArray(currentUserProfile.interests) && currentUserProfile.interests.length > 0
          const currentHasGoals = Array.isArray(currentUserProfile.goals) && currentUserProfile.goals.length > 0
          const currentHasSkillLevel = !!currentUserProfile.skillLevel
          const currentHasStudyStyle = !!currentUserProfile.studyStyle
          const currentFilledCount = [currentHasSubjects, currentHasInterests, currentHasGoals, currentHasSkillLevel, currentHasStudyStyle].filter(Boolean).length

          // Check if viewed user has enough profile data
          const viewedHasSubjects = Array.isArray(dbUser.profile.subjects) && dbUser.profile.subjects.length > 0
          const viewedHasInterests = Array.isArray(dbUser.profile.interests) && dbUser.profile.interests.length > 0
          const viewedHasGoals = Array.isArray(dbUser.profile.goals) && dbUser.profile.goals.length > 0
          const viewedHasSkillLevel = !!dbUser.profile.skillLevel
          const viewedHasStudyStyle = !!dbUser.profile.studyStyle
          const viewedFilledCount = [viewedHasSubjects, viewedHasInterests, viewedHasGoals, viewedHasSkillLevel, viewedHasStudyStyle].filter(Boolean).length

          // Only calculate meaningful match if BOTH users have at least 2 criteria filled
          const canCalculateMeaningfulMatch = currentFilledCount >= 2 && viewedFilledCount >= 2
          matchDataInsufficient = !canCalculateMeaningfulMatch

          if (canCalculateMeaningfulMatch) {
            // Match subjects - ensure arrays exist and sanitize
            const profileSubjects = Array.isArray(dbUser.profile.subjects) ? dbUser.profile.subjects : []
            const currentSubjects = Array.isArray(currentUserProfile.subjects) ? currentUserProfile.subjects : []
            const commonSubjects = profileSubjects.filter((subject: string) =>
              currentSubjects.includes(subject)
            )
            matchDetails.subjects.count = commonSubjects.length
            matchDetails.subjects.items = commonSubjects
            matchDetails.subjects.score = commonSubjects.length * 20 // 20 points per subject

            // Match interests - ensure arrays exist and sanitize
            const profileInterests = Array.isArray(dbUser.profile.interests) ? dbUser.profile.interests : []
            const currentInterests = Array.isArray(currentUserProfile.interests) ? currentUserProfile.interests : []
            const commonInterests = profileInterests.filter((interest: string) =>
              currentInterests.includes(interest)
            )
            matchDetails.interests.count = commonInterests.length
            matchDetails.interests.items = commonInterests
            matchDetails.interests.score = commonInterests.length * 15 // 15 points per interest

            // Match goals - informational only, not scored
            const profileGoals = Array.isArray(dbUser.profile.goals) ? dbUser.profile.goals : []
            const currentGoals = Array.isArray(currentUserProfile.goals) ? currentUserProfile.goals : []
            const commonGoals = profileGoals.filter((goal: string) =>
              currentGoals.includes(goal)
            )
            matchDetails.goals.count = commonGoals.length
            matchDetails.goals.items = commonGoals

            // Match skill level - 10 points if matches
            matchDetails.skillLevel.matches = Boolean(
              currentUserProfile.skillLevel &&
              dbUser.profile.skillLevel &&
              dbUser.profile.skillLevel === currentUserProfile.skillLevel
            )
            matchDetails.skillLevel.value = dbUser.profile.skillLevel
            const skillScore = matchDetails.skillLevel.matches ? 10 : 0

            // Match study style - 10 points if matches
            matchDetails.studyStyle.matches = Boolean(
              currentUserProfile.studyStyle &&
              dbUser.profile.studyStyle &&
              dbUser.profile.studyStyle === currentUserProfile.studyStyle
            )
            matchDetails.studyStyle.value = dbUser.profile.studyStyle
            const styleScore = matchDetails.studyStyle.matches ? 10 : 0

            // Calculate total match score (out of 100) - cap at 100
            matchScore = Math.min(
              matchDetails.subjects.score +
              matchDetails.interests.score +
              skillScore +
              styleScore,
              100
            )
          }
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

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
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
      matchScore, // null if not enough data to calculate
      matchDetails: matchDataInsufficient ? null : matchDetails,
      matchDataInsufficient, // Flag for UI to show "Complete profile for match %" message
    })
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