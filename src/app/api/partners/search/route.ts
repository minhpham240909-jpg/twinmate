import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const searchSchema = z.object({
  searchQuery: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  skillLevel: z.string().optional(),
  studyStyle: z.string().optional(),
  interests: z.array(z.string()).optional(),
  availability: z.array(z.string()).optional(),
  subjectCustomDescription: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  studyStyleCustomDescription: z.string().optional(),
  interestsCustomDescription: z.string().optional(),
  availabilityCustomDescription: z.string().optional(),
  // NEW: Search in aboutYourself field
  aboutYourselfSearch: z.string().optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validation = searchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const {
      searchQuery,
      subjects,
      skillLevel,
      studyStyle,
      interests,
      availability,
      subjectCustomDescription,
      skillLevelCustomDescription,
      studyStyleCustomDescription,
      interestsCustomDescription,
      availabilityCustomDescription,
      aboutYourselfSearch,
      page,
      limit,
    } = validation.data

    // Validate that at least one search criteria is provided (backend validation)
    const hasSearchCriteria =
      (searchQuery && searchQuery.trim().length > 0) ||
      (subjects && subjects.length > 0) ||
      (skillLevel && skillLevel !== '') ||
      (studyStyle && studyStyle !== '') ||
      (interests && interests.length > 0) ||
      (availability && availability.length > 0) ||
      (subjectCustomDescription && subjectCustomDescription.trim().length > 0) ||
      (skillLevelCustomDescription && skillLevelCustomDescription.trim().length > 0) ||
      (studyStyleCustomDescription && studyStyleCustomDescription.trim().length > 0) ||
      (interestsCustomDescription && interestsCustomDescription.trim().length > 0) ||
      (availabilityCustomDescription && availabilityCustomDescription.trim().length > 0) ||
      (aboutYourselfSearch && aboutYourselfSearch.trim().length > 0)

    if (!hasSearchCriteria) {
      return NextResponse.json(
        { error: 'At least one search filter or criteria must be provided' },
        { status: 400 }
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

    // Build WHERE clause for filtering
    const whereConditions: {
      AND: Array<Record<string, unknown>>
    } = {
      AND: [
        // Exclude current user
        { userId: { not: user.id } },
        // Exclude pending/rejected/cancelled connections (but include ACCEPTED partners)
        { userId: { notIn: Array.from(pendingOrOtherUserIds) } }
      ],
    }

    // Filter by subjects
    if (subjects && subjects.length > 0) {
      whereConditions.AND.push({
        subjects: {
          hasSome: subjects,
        },
      })
    }

    // Filter by skill level
    if (skillLevel && skillLevel !== '') {
      whereConditions.AND.push({
        skillLevel: skillLevel,
      })
    }

    // Filter by study style
    if (studyStyle && studyStyle !== '') {
      whereConditions.AND.push({
        studyStyle: studyStyle,
      })
    }

    // Filter by interests
    if (interests && interests.length > 0) {
      whereConditions.AND.push({
        interests: {
          hasSome: interests,
        },
      })
    }

    // Filter by availability
    if (availability && availability.length > 0) {
      whereConditions.AND.push({
        availableDays: {
          hasSome: availability,
        },
      })
    }

    // Custom description search - search in user's bio and fields
    if (searchQuery || subjectCustomDescription || skillLevelCustomDescription ||
        studyStyleCustomDescription || interestsCustomDescription || availabilityCustomDescription ||
        aboutYourselfSearch) {

      const searchTerms: string[] = []

      if (searchQuery) searchTerms.push(searchQuery)
      if (subjectCustomDescription) searchTerms.push(subjectCustomDescription)
      if (skillLevelCustomDescription) searchTerms.push(skillLevelCustomDescription)
      if (studyStyleCustomDescription) searchTerms.push(studyStyleCustomDescription)
      if (interestsCustomDescription) searchTerms.push(interestsCustomDescription)
      if (availabilityCustomDescription) searchTerms.push(availabilityCustomDescription)
      if (aboutYourselfSearch) searchTerms.push(aboutYourselfSearch)

      // Create OR conditions for each search term across multiple fields
      const searchConditions = searchTerms.flatMap(term => {
        const keywords = term.toLowerCase().split(/\s+/).filter(word => word.length > 2)

        // Flatten all keyword conditions into a single OR array
        return keywords.flatMap(keyword => {
          // For text fields, use case-insensitive contains
          // For array fields, we can only search in custom description fields (which are text)
          // Note: PostgreSQL arrays don't support case-insensitive partial matching with Prisma
          // So we rely on exact matches from filter checkboxes and text search in description fields

          return [
            { user: { name: { contains: keyword, mode: 'insensitive' as const } } },
            { bio: { contains: keyword, mode: 'insensitive' as const } },
            { subjectCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { skillLevelCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { studyStyleCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { interestsCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { availabilityCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { aboutYourself: { contains: keyword, mode: 'insensitive' as const } },
          ]
        })
      })

      if (searchConditions.length > 0) {
        whereConditions.AND.push({
          OR: searchConditions,
        })
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch matching profiles with user data
    const profiles = await prisma.profile.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip: skip,
      take: limit,
    })

    // Get total count for pagination
    const totalCount = await prisma.profile.count({
      where: whereConditions,
    })

    // Calculate match scores for each profile
    const profilesWithScores = profiles.map(profile => {
      let matchScore = 0
      const matchReasons: string[] = []

      // Score based on subject overlap
      if (subjects && subjects.length > 0) {
        const subjectOverlap = profile.subjects.filter(s =>
          subjects.some(userSubject => userSubject.toLowerCase() === s.toLowerCase())
        ).length
        if (subjectOverlap > 0) {
          matchScore += subjectOverlap * 20
          matchReasons.push(`${subjectOverlap} shared subject(s)`)
        }
      }

      // Score based on interest overlap
      if (interests && interests.length > 0) {
        const interestOverlap = profile.interests.filter(i =>
          interests.some(userInterest => userInterest.toLowerCase() === i.toLowerCase())
        ).length
        if (interestOverlap > 0) {
          matchScore += interestOverlap * 15
          matchReasons.push(`${interestOverlap} shared interest(s)`)
        }
      }

      // Score based on skill level match
      if (skillLevel && profile.skillLevel === skillLevel) {
        matchScore += 10
        matchReasons.push('Same skill level')
      }

      // Score based on study style match
      if (studyStyle && profile.studyStyle === studyStyle) {
        matchScore += 10
        matchReasons.push('Same study style')
      }

      // Score based on availability overlap
      if (availability && availability.length > 0) {
        const availabilityOverlap = profile.availableDays.filter(day =>
          availability.includes(day)
        ).length
        if (availabilityOverlap > 0) {
          matchScore += availabilityOverlap * 5
          matchReasons.push(`${availabilityOverlap} matching day(s)`)
        }
      }

      // Cap score at 100
      matchScore = Math.min(matchScore, 100)

      // Check if this user is an accepted partner
      const isAlreadyPartner = acceptedPartnerIds.has(profile.userId)

      return {
        ...profile,
        matchScore,
        matchReasons,
        isAlreadyPartner, // Flag to show "Already Partners" in frontend
      }
    })

    // Sort by match score (highest first)
    profilesWithScores.sort((a, b) => b.matchScore - a.matchScore)

    // Add caching headers for search results
    return NextResponse.json({
      success: true,
      profiles: profilesWithScores,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'CDN-Cache-Control': 'max-age=30',
      }
    })
  } catch (error) {
    console.error('Partner search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
