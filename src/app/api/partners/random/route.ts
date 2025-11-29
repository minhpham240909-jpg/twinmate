import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getBlockedUserIds } from '@/lib/blocked-users'
import { 
  calculateMatchScore, 
  countFilledFields, 
  getMissingFields,
  hasMinimumProfileData,
  type ProfileData 
} from '@/lib/matching/algorithm'

export async function GET(request: NextRequest) {
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

    // Get all existing matches (sent or received) for this user
    const existingMatches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id }
        ]
      },
      select: {
        senderId: true,
        receiverId: true,
        status: true
      }
    })

    // SECURITY: Get blocked user IDs to exclude
    const blockedUserIds = await getBlockedUserIds(user.id)

    // Separate ACCEPTED partners from pending/other connections
    const acceptedPartnerIds = new Set<string>()
    const pendingOrOtherUserIds = new Set<string>()

    existingMatches.forEach(match => {
      const otherUserId = match.senderId === user.id ? match.receiverId : match.senderId

      if (match.status === 'ACCEPTED') {
        // These are confirmed partners - include them in results with special status
        acceptedPartnerIds.add(otherUserId)
      } else {
        // PENDING, REJECTED, CANCELLED - exclude from results
        pendingOrOtherUserIds.add(otherUserId)
      }
    })

    // Add blocked users to exclusion set
    blockedUserIds.forEach(id => pendingOrOtherUserIds.add(id))

    // Get random partners excluding current user and pending/rejected connections (but include ACCEPTED partners)
    const randomPartners = await prisma.profile.findMany({
      where: {
        AND: [
          { userId: { not: user.id } },
          { userId: { notIn: Array.from(pendingOrOtherUserIds) } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
          }
        }
      },
      take: 100 // Get more to randomize from
    })

    // Get current user's profile for match calculation
    const currentUserProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        subjects: true,
        interests: true,
        goals: true,
        availableDays: true,
        skillLevel: true,
        studyStyle: true,
      }
    })

    // Check current user's profile completeness
    const currentUserFilledCount = countFilledFields(currentUserProfile)
    const currentUserMissingFields = getMissingFields(currentUserProfile)
    const currentUserProfileComplete = hasMinimumProfileData(currentUserProfile)

    // Calculate match scores for each partner using the new algorithm
    const partnersWithScores = randomPartners.map(profile => {
      // Prepare partner profile data
      const partnerProfileData: ProfileData = {
        subjects: profile.subjects as string[] | null,
        interests: profile.interests as string[] | null,
        goals: profile.goals as string[] | null,
        availableDays: profile.availableDays as string[] | null,
        skillLevel: profile.skillLevel,
        studyStyle: profile.studyStyle,
      }

      // Calculate match using the new algorithm
      const matchResult = calculateMatchScore(currentUserProfile, partnerProfileData)

      // SECURITY: Sanitize location data based on privacy settings
      const locationVisibility = (profile as any).location_visibility || 'private'
      let sanitizedProfile: any = { ...profile }

      // If location is private, always hide it
      if (locationVisibility === 'private') {
        sanitizedProfile.location_city = null
        sanitizedProfile.location_state = null
        sanitizedProfile.location_country = null
      }

      // If location is match-only, only show to accepted partners
      if (locationVisibility === 'match-only' && !acceptedPartnerIds.has(profile.userId)) {
        sanitizedProfile.location_city = null
        sanitizedProfile.location_state = null
        sanitizedProfile.location_country = null
      }

      return {
        ...sanitizedProfile,
        // Match data - only show real values
        matchScore: matchResult.matchScore,
        matchReasons: matchResult.matchReasons,
        matchDataInsufficient: matchResult.matchDataInsufficient,
        matchDetails: matchResult.matchDetails,
        partnerMissingFields: matchResult.partnerMissingFields,
        // Partner status
        isAlreadyPartner: acceptedPartnerIds.has(profile.userId),
        // Partner profile completeness
        partnerProfileComplete: hasMinimumProfileData(partnerProfileData),
      }
    })

    // Fisher-Yates shuffle for unbiased randomization
    const shuffled = [...partnersWithScores]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const randomCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), shuffled.length, 5)
    const selectedPartners = shuffled.slice(0, randomCount)

    return NextResponse.json({
      success: true,
      partners: selectedPartners,
      count: selectedPartners.length,
      // Current user's profile status
      currentUserProfileComplete,
      currentUserFilledCount,
      currentUserMissingFields,
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      }
    })
  } catch (error) {
    console.error('Random partners error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
