import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getBlockedUserIds } from '@/lib/blocked-users'
import {
  calculateMatchScore,
  countFilledFields,
  getMissingFields,
  hasMinimumProfileData,
  weightedRandomSelect,
  type ProfileData
} from '@/lib/matching'

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

    // Get random partners excluding current user and pending/rejected connections
    // Include all fields needed for enhanced matching algorithm
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
            // Include learning profile for strengths/weaknesses matching
            learningProfile: {
              select: {
                strengths: true,
                weaknesses: true,
              }
            }
          }
        }
      },
      take: 100 // Get more to randomize from
    })

    // Get current user's profile with all matching fields
    const currentUserProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        subjects: true,
        interests: true,
        goals: true,
        availableDays: true,
        availableHours: true,
        skillLevel: true,
        studyStyle: true,
        school: true,
        timezone: true,
        isLookingForPartner: true,
      }
    })

    // Get current user's learning profile for strengths/weaknesses
    const currentUserLearningProfile = await prisma.learningProfile.findUnique({
      where: { userId: user.id },
      select: {
        strengths: true,
        weaknesses: true,
      }
    })

    // Prepare current user's profile data for matching
    const currentUserProfileData: ProfileData = {
      subjects: currentUserProfile?.subjects as string[] | null,
      interests: currentUserProfile?.interests as string[] | null,
      goals: currentUserProfile?.goals as string[] | null,
      availableDays: currentUserProfile?.availableDays as string[] | null,
      availableHours: currentUserProfile?.availableHours as string[] | null,
      skillLevel: currentUserProfile?.skillLevel,
      studyStyle: currentUserProfile?.studyStyle,
      school: currentUserProfile?.school,
      timezone: currentUserProfile?.timezone,
      isLookingForPartner: currentUserProfile?.isLookingForPartner,
      strengths: currentUserLearningProfile?.strengths as string[] | null,
      weaknesses: currentUserLearningProfile?.weaknesses as string[] | null,
    }

    // Check current user's profile completeness
    const currentUserFilledCount = countFilledFields(currentUserProfileData)
    const currentUserMissingFields = getMissingFields(currentUserProfileData)
    const currentUserProfileComplete = hasMinimumProfileData(currentUserProfileData)

    // Calculate match scores for each partner using the enhanced algorithm
    const partnersWithScores = randomPartners.map(profile => {
      // Get partner's learning profile for strengths/weaknesses
      const partnerLearningProfile = (profile.user as any)?.learningProfile

      // Prepare partner profile data for matching
      const partnerProfileData: ProfileData = {
        subjects: profile.subjects as string[] | null,
        interests: profile.interests as string[] | null,
        goals: profile.goals as string[] | null,
        availableDays: profile.availableDays as string[] | null,
        availableHours: profile.availableHours as string[] | null,
        skillLevel: profile.skillLevel,
        studyStyle: profile.studyStyle,
        school: profile.school,
        timezone: profile.timezone,
        isLookingForPartner: profile.isLookingForPartner,
        strengths: partnerLearningProfile?.strengths as string[] | null,
        weaknesses: partnerLearningProfile?.weaknesses as string[] | null,
      }

      // Calculate match using the enhanced algorithm
      const matchResult = calculateMatchScore(currentUserProfileData, partnerProfileData)

      // SECURITY: Sanitize location data based on privacy settings
      const locationVisibility = profile.location_visibility || 'private'
      const sanitizedProfile: any = { ...profile }

      // Remove learning profile from user object (we've already extracted what we need)
      if (sanitizedProfile.user) {
        const { learningProfile, ...userWithoutLearning } = sanitizedProfile.user
        sanitizedProfile.user = userWithoutLearning
      }

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
        // Match data from enhanced algorithm
        matchScore: matchResult.matchScore,
        matchReasons: matchResult.matchReasons,
        matchDataInsufficient: matchResult.matchDataInsufficient,
        matchDetails: matchResult.matchDetails,
        matchTier: matchResult.matchTier,
        componentScores: matchResult.componentScores,
        summary: matchResult.summary,
        partnerMissingFields: matchResult.partnerMissingFields,
        // Partner status
        isAlreadyPartner: acceptedPartnerIds.has(profile.userId),
        // Partner profile completeness
        partnerProfileComplete: hasMinimumProfileData(partnerProfileData),
      }
    })

    // Use weighted-random selection to prefer better matches while still being random
    // This shows mostly good matches but maintains discovery of new partners
    const selectedPartners = weightedRandomSelect(
      partnersWithScores,
      Math.min(5, partnersWithScores.length)
    )

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
