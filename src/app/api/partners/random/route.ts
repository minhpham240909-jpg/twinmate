import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getBlockedUserIds } from '@/lib/blocked-users'

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

    // Get current user's profile for match calculation - secure query using Prisma
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

    // Check if user's profile is complete enough for meaningful matching
    const hasSubjects = Array.isArray(currentUserProfile?.subjects) && currentUserProfile.subjects.length > 0
    const hasInterests = Array.isArray(currentUserProfile?.interests) && currentUserProfile.interests.length > 0
    const hasGoals = Array.isArray(currentUserProfile?.goals) && currentUserProfile.goals.length > 0
    const hasSkillLevel = !!currentUserProfile?.skillLevel
    const hasStudyStyle = !!currentUserProfile?.studyStyle

    // Profile is incomplete if missing ALL key matching criteria
    const profileIncomplete = !hasSubjects && !hasInterests && !hasGoals && !hasSkillLevel && !hasStudyStyle
    const missingFields: string[] = []
    if (!hasSubjects) missingFields.push('subjects')
    if (!hasInterests) missingFields.push('interests')
    if (!hasGoals) missingFields.push('goals')
    if (!hasSkillLevel) missingFields.push('skill level')
    if (!hasStudyStyle) missingFields.push('study style')

    // Calculate match scores for each partner (same improved algorithm as search API)
    const partnersWithScores = randomPartners.map(profile => {
      let matchScore = 0
      const matchReasons: string[] = []

      // Check if partner's profile has enough data for meaningful matching
      const partnerHasSubjects = Array.isArray(profile.subjects) && profile.subjects.length > 0
      const partnerHasInterests = Array.isArray(profile.interests) && profile.interests.length > 0
      const partnerHasGoals = Array.isArray(profile.goals) && profile.goals.length > 0
      const partnerHasSkillLevel = !!profile.skillLevel
      const partnerHasStudyStyle = !!profile.studyStyle

      // Count how many matching criteria the partner has filled
      const partnerFilledCount = [partnerHasSubjects, partnerHasInterests, partnerHasGoals, partnerHasSkillLevel, partnerHasStudyStyle].filter(Boolean).length

      // Count how many matching criteria the current user has filled
      const currentUserFilledCount = [hasSubjects, hasInterests, hasGoals, hasSkillLevel, hasStudyStyle].filter(Boolean).length

      // Only calculate meaningful match if BOTH users have at least 2 criteria filled
      const canCalculateMeaningfulMatch = partnerFilledCount >= 2 && currentUserFilledCount >= 2

      // Flag to indicate if this specific match can be calculated
      const matchDataInsufficient = !canCalculateMeaningfulMatch

      if (currentUserProfile && canCalculateMeaningfulMatch) {
        // Match subjects with diminishing returns (first 2 = 12pts each, rest = 4pts each, max 32)
        const profileSubjects = Array.isArray(profile.subjects) ? profile.subjects : []
        const currentSubjects = Array.isArray(currentUserProfile.subjects) ? currentUserProfile.subjects : []
        const commonSubjects = profileSubjects.filter((subject: string) =>
          currentSubjects.includes(subject)
        )
        if (commonSubjects.length > 0) {
          const firstTwo = Math.min(commonSubjects.length, 2) * 12
          const additional = Math.max(0, commonSubjects.length - 2) * 4
          const subjectScore = Math.min(firstTwo + additional, 32)
          matchScore += subjectScore
          matchReasons.push(`${commonSubjects.length} shared subject(s)`)
        }

        // Match interests with diminishing returns (first 2 = 8pts each, rest = 3pts each, max 22)
        const profileInterests = Array.isArray(profile.interests) ? profile.interests : []
        const currentInterests = Array.isArray(currentUserProfile.interests) ? currentUserProfile.interests : []
        const commonInterests = profileInterests.filter((interest: string) =>
          currentInterests.includes(interest)
        )
        if (commonInterests.length > 0) {
          const firstTwo = Math.min(commonInterests.length, 2) * 8
          const additional = Math.max(0, commonInterests.length - 2) * 3
          const interestScore = Math.min(firstTwo + additional, 22)
          matchScore += interestScore
          matchReasons.push(`${commonInterests.length} shared interest(s)`)
        }

        // Match goals (max 16 points)
        const profileGoals = Array.isArray(profile.goals) ? profile.goals : []
        const currentGoals = Array.isArray(currentUserProfile.goals) ? currentUserProfile.goals : []
        const commonGoals = profileGoals.filter((goal: string) =>
          currentGoals.includes(goal)
        )
        if (commonGoals.length > 0) {
          const goalScore = Math.min(commonGoals.length * 8, 16)
          matchScore += goalScore
          matchReasons.push(`${commonGoals.length} shared goal(s)`)
        }

        // Match availability/days (max 15 points)
        const profileDays = Array.isArray(profile.availableDays) ? profile.availableDays : []
        const currentDays = Array.isArray(currentUserProfile.availableDays) ? currentUserProfile.availableDays : []
        const commonDays = profileDays.filter((day: string) =>
          currentDays.includes(day)
        )
        if (commonDays.length > 0) {
          const dayScore = Math.min(commonDays.length * 3, 15)
          matchScore += dayScore
          matchReasons.push(`${commonDays.length} matching day(s)`)
        }

        // Match skill level - 10 points if matches
        if (currentUserProfile.skillLevel &&
            profile.skillLevel &&
            profile.skillLevel === currentUserProfile.skillLevel) {
          matchScore += 10
          matchReasons.push('Same skill level')
        }

        // Match study style - 5 points if matches
        if (currentUserProfile.studyStyle &&
            profile.studyStyle &&
            profile.studyStyle === currentUserProfile.studyStyle) {
          matchScore += 5
          matchReasons.push('Same study style')
        }

        // Cap score at 100
        matchScore = Math.min(matchScore, 100)
      }

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
        matchScore: matchDataInsufficient ? null : matchScore, // null = not enough data
        matchReasons: matchDataInsufficient ? [] : matchReasons,
        matchDataInsufficient, // Flag for UI to show "Complete profile for match %" message
        isAlreadyPartner: acceptedPartnerIds.has(profile.userId)
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
      // Flag to indicate if user's profile is incomplete for meaningful matching
      profileIncomplete,
      missingFields: profileIncomplete ? missingFields : [],
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
