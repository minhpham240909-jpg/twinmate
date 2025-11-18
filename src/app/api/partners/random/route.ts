import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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
        skillLevel: true,
        studyStyle: true,
      }
    })

    // Calculate match scores for each partner (same logic as search API)
    const partnersWithScores = randomPartners.map(profile => {
      let matchScore = 0
      const matchReasons: string[] = []

      if (currentUserProfile) {
        // Match subjects - ensure arrays exist and sanitize
        const profileSubjects = Array.isArray(profile.subjects) ? profile.subjects : []
        const currentSubjects = Array.isArray(currentUserProfile.subjects) ? currentUserProfile.subjects : []
        const commonSubjects = profileSubjects.filter((subject: string) =>
          currentSubjects.includes(subject)
        )
        if (commonSubjects.length > 0) {
          const subjectScore = commonSubjects.length * 20
          matchScore += subjectScore
          matchReasons.push(`${commonSubjects.length} shared subject(s)`)
        }

        // Match interests - ensure arrays exist and sanitize
        const profileInterests = Array.isArray(profile.interests) ? profile.interests : []
        const currentInterests = Array.isArray(currentUserProfile.interests) ? currentUserProfile.interests : []
        const commonInterests = profileInterests.filter((interest: string) =>
          currentInterests.includes(interest)
        )
        if (commonInterests.length > 0) {
          const interestScore = commonInterests.length * 15
          matchScore += interestScore
          matchReasons.push(`${commonInterests.length} shared interest(s)`)
        }

        // Match skill level - 10 points if matches
        if (currentUserProfile.skillLevel &&
            profile.skillLevel &&
            profile.skillLevel === currentUserProfile.skillLevel) {
          matchScore += 10
          matchReasons.push('Same skill level')
        }

        // Match study style - 10 points if matches
        if (currentUserProfile.studyStyle &&
            profile.studyStyle &&
            profile.studyStyle === currentUserProfile.studyStyle) {
          matchScore += 10
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
        matchScore,
        matchReasons,
        isAlreadyPartner: acceptedPartnerIds.has(profile.userId)
      }
    })

    // Shuffle and take 3-5 random partners
    const shuffled = partnersWithScores.sort(() => 0.5 - Math.random())
    const randomCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), shuffled.length, 5)
    const selectedPartners = shuffled.slice(0, randomCount)

    return NextResponse.json({
      success: true,
      partners: selectedPartners,
      count: selectedPartners.length
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
