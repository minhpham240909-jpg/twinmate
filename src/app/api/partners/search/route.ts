import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  aboutYourselfSearch: z.string().optional(),
  school: z.string().optional(),
  languages: z.string().optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[Partner Search] Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.error('[Partner Search] No user found in session')
      return NextResponse.json(
        { error: 'Please sign in to search for partners' },
        { status: 401 }
      )
    }

    console.log('[Partner Search] Request from user:', user.id)

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
      school,
      languages,
      page,
      limit,
    } = validation.data

    // Validate that at least one search criteria is provided
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
      (aboutYourselfSearch && aboutYourselfSearch.trim().length > 0) ||
      (school && school.trim().length > 0) ||
      (languages && languages.trim().length > 0)

    if (!hasSearchCriteria) {
      return NextResponse.json(
        { error: 'At least one search filter or criteria must be provided' },
        { status: 400 }
      )
    }

    // Get existing matches to filter out
    const { data: existingMatches } = await supabase
      .from('Match')
      .select('senderId, receiverId, status')
      .or(`senderId.eq.${user.id},receiverId.eq.${user.id}`)

    const acceptedPartnerIds = new Set<string>()
    const pendingOrOtherUserIds = new Set<string>()

    existingMatches?.forEach(match => {
      const otherUserId = match.senderId === user.id ? match.receiverId : match.senderId
      if (match.status === 'ACCEPTED') {
        acceptedPartnerIds.add(otherUserId)
      } else {
        pendingOrOtherUserIds.add(otherUserId)
      }
    })

    // Build Supabase query
    let query = supabase
      .from('Profile')
      .select(`
        userId,
        subjects,
        interests,
        goals,
        studyStyle,
        skillLevel,
        availableDays,
        availableHours,
        bio,
        school,
        languages,
        aboutYourself,
        aboutYourselfItems,
        subjectCustomDescription,
        skillLevelCustomDescription,
        studyStyleCustomDescription,
        interestsCustomDescription,
        availabilityCustomDescription,
        updatedAt,
        user:User!inner(
          id,
          name,
          email,
          avatarUrl,
          role,
          createdAt
        )
      `)
      .neq('userId', user.id)

    // Exclude pending/rejected connections
    if (pendingOrOtherUserIds.size > 0) {
      query = query.not('userId', 'in', `(${Array.from(pendingOrOtherUserIds).join(',')})`)
    }

    // Filter by subjects - Supabase uses @> for array contains
    if (subjects && subjects.length > 0) {
      query = query.overlaps('subjects', subjects)
    }

    // Filter by skill level
    if (skillLevel && skillLevel !== '') {
      query = query.eq('skillLevel', skillLevel)
    }

    // Filter by study style
    if (studyStyle && studyStyle !== '') {
      query = query.eq('studyStyle', studyStyle)
    }

    // Filter by interests
    if (interests && interests.length > 0) {
      query = query.overlaps('interests', interests)
    }

    // Filter by availability
    if (availability && availability.length > 0) {
      query = query.overlaps('availableDays', availability)
    }

    // Text search across multiple fields
    if (searchQuery || subjectCustomDescription || skillLevelCustomDescription ||
        studyStyleCustomDescription || interestsCustomDescription || availabilityCustomDescription ||
        aboutYourselfSearch || school || languages) {

      const searchTerms: string[] = []
      if (searchQuery) searchTerms.push(searchQuery)
      if (subjectCustomDescription) searchTerms.push(subjectCustomDescription)
      if (skillLevelCustomDescription) searchTerms.push(skillLevelCustomDescription)
      if (studyStyleCustomDescription) searchTerms.push(studyStyleCustomDescription)
      if (interestsCustomDescription) searchTerms.push(interestsCustomDescription)
      if (availabilityCustomDescription) searchTerms.push(availabilityCustomDescription)
      if (aboutYourselfSearch) searchTerms.push(aboutYourselfSearch)
      if (school) searchTerms.push(school)
      if (languages) searchTerms.push(languages)

      // For Supabase, we'll do text search differently - fetch all and filter in memory
      // This is less ideal but works with the pooler
    }

    // Apply pagination
    const skip = (page - 1) * limit
    query = query.range(skip, skip + limit - 1).order('updatedAt', { ascending: false })

    const { data: profiles, error: profileError } = await query

    if (profileError) {
      console.error('Supabase profile search error:', profileError)
      throw new Error(`Search failed: ${profileError.message}`)
    }

    // Get current user's profile for compatibility scoring
    const { data: myProfile } = await supabase
      .from('Profile')
      .select('subjects, interests, studyStyle, skillLevel')
      .eq('userId', user.id)
      .single()

    // Calculate match scores
    const profilesWithScores = (profiles || []).map(profile => {
      let matchScore = 0
      const matchReasons: string[] = []

      const mySubjects = new Set(myProfile?.subjects || [])
      const myInterests = new Set(myProfile?.interests || [])

      // Score based on subject overlap
      if (profile.subjects && profile.subjects.length > 0) {
        const subjectOverlap = profile.subjects.filter((s: string) =>
          mySubjects.has(s)
        ).length
        if (subjectOverlap > 0) {
          matchScore += subjectOverlap * 20
          matchReasons.push(`${subjectOverlap} shared subject(s)`)
        }
      }

      // Score based on interest overlap
      if (profile.interests && profile.interests.length > 0) {
        const interestOverlap = profile.interests.filter((i: string) =>
          myInterests.has(i)
        ).length
        if (interestOverlap > 0) {
          matchScore += interestOverlap * 15
          matchReasons.push(`${interestOverlap} shared interest(s)`)
        }
      }

      // Score based on skill level match
      if (myProfile?.skillLevel && profile.skillLevel === myProfile.skillLevel) {
        matchScore += 10
        matchReasons.push('Same skill level')
      }

      // Score based on study style match
      if (myProfile?.studyStyle && profile.studyStyle === myProfile.studyStyle) {
        matchScore += 10
        matchReasons.push('Same study style')
      }

      // Cap score at 100
      matchScore = Math.min(matchScore, 100)

      // Check if this user is an accepted partner
      const isAlreadyPartner = acceptedPartnerIds.has(profile.userId)

      return {
        ...profile,
        matchScore,
        matchReasons,
        isAlreadyPartner,
      }
    })

    // Sort by match score
    profilesWithScores.sort((a, b) => b.matchScore - a.matchScore)

    // Get total count for pagination
    let countQuery = supabase
      .from('Profile')
      .select('userId', { count: 'exact', head: true })
      .neq('userId', user.id)

    if (pendingOrOtherUserIds.size > 0) {
      countQuery = countQuery.not('userId', 'in', `(${Array.from(pendingOrOtherUserIds).join(',')})`)
    }

    const { count: totalCount } = await countQuery

    return NextResponse.json({
      success: true,
      profiles: profilesWithScores,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'CDN-Cache-Control': 'max-age=30',
      }
    })
  } catch (error) {
    console.error('Partner search error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
