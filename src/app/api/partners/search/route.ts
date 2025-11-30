import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { getBlockedUserIds } from '@/lib/blocked-users'
import {
  calculateMatchScore,
  countFilledFields,
  getMissingFields,
  hasMinimumProfileData,
  sortByMatchScore,
  type ProfileData
} from '@/lib/matching'

const searchSchema = z.object({
  searchQuery: z.string().optional(),
  searchType: z.enum(['simple', 'full']).optional().default('full'),
  subjects: z.array(z.string()).optional(),
  skillLevel: z.string().optional(),
  studyStyle: z.string().optional(),
  interests: z.array(z.string()).optional(),
  availability: z.array(z.string()).optional(),
  availableHours: z.string().optional(), // NEW: Filter by available hours
  subjectCustomDescription: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  studyStyleCustomDescription: z.string().optional(),
  interestsCustomDescription: z.string().optional(),
  aboutYourselfSearch: z.string().optional(),
  school: z.string().optional(),
  languages: z.string().optional(),
  ageRange: z.string().optional(), // NEW: Age range filter
  role: z.array(z.string()).optional(), // NEW: Role filter (can select multiple)
  goals: z.array(z.string()).optional(), // NEW: Goals filter
  locationCity: z.string().optional(), // NEW: Location filter - city
  locationState: z.string().optional(), // NEW: Location filter - state
  locationCountry: z.string().optional(), // NEW: Location filter - country
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 30 searches per minute to prevent abuse
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many search requests. Please slow down.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      logger.error('Partner search auth error', authError)
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      logger.warn('Partner search - no user in session')
      return NextResponse.json(
        { error: 'Please sign in to search for partners' },
        { status: 401 }
      )
    }

    logger.debug('Partner search initiated')

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
      searchType,
      subjects,
      skillLevel,
      studyStyle,
      interests,
      availability,
      availableHours,
      subjectCustomDescription,
      skillLevelCustomDescription,
      studyStyleCustomDescription,
      interestsCustomDescription,
      aboutYourselfSearch,
      school,
      languages,
      ageRange,
      role,
      goals,
      locationCity,
      locationState,
      locationCountry,
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
      (availableHours && availableHours.trim().length > 0) ||
      (subjectCustomDescription && subjectCustomDescription.trim().length > 0) ||
      (skillLevelCustomDescription && skillLevelCustomDescription.trim().length > 0) ||
      (studyStyleCustomDescription && studyStyleCustomDescription.trim().length > 0) ||
      (interestsCustomDescription && interestsCustomDescription.trim().length > 0) ||
      (aboutYourselfSearch && aboutYourselfSearch.trim().length > 0) ||
      (school && school.trim().length > 0) ||
      (languages && languages.trim().length > 0) ||
      (ageRange && ageRange !== '') ||
      (role && role.length > 0) ||
      (goals && goals.length > 0) ||
      (locationCity && locationCity.trim().length > 0) ||
      (locationState && locationState.trim().length > 0) ||
      (locationCountry && locationCountry.trim().length > 0)

    if (!hasSearchCriteria) {
      return NextResponse.json(
        { error: 'At least one search filter or criteria must be provided' },
        { status: 400 }
      )
    }

    // SECURITY: Get blocked user IDs to exclude from search
    const blockedUserIds = await getBlockedUserIds(user.id)

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

    // Add blocked users to exclusion set
    blockedUserIds.forEach(id => pendingOrOtherUserIds.add(id))

    // Build Supabase query - include all fields needed for enhanced matching
    let query = supabase
      .from('Profile')
      .select(`
        userId,
        age,
        role,
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
        timezone,
        aboutYourself,
        aboutYourselfItems,
        subjectCustomDescription,
        skillLevelCustomDescription,
        studyStyleCustomDescription,
        interestsCustomDescription,
        availabilityCustomDescription,
        location_lat,
        location_lng,
        location_city,
        location_state,
        location_country,
        location_visibility,
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

    // Filter by goals
    if (goals && goals.length > 0) {
      query = query.overlaps('goals', goals)
    }

    // Filter by role
    if (role && role.length > 0) {
      query = query.in('role', role)
    }

    // Filter by age range
    if (ageRange && ageRange !== '') {
      // Parse age range and filter accordingly
      const ageRanges: Record<string, { min: number; max: number }> = {
        'under-18': { min: 0, max: 17 },
        '18-24': { min: 18, max: 24 },
        '25-34': { min: 25, max: 34 },
        '35-44': { min: 35, max: 44 },
        '45+': { min: 45, max: 999 }
      }

      const range = ageRanges[ageRange]
      if (range) {
        query = query.gte('age', range.min).lte('age', range.max)
      }
    }

    // Filter by location - case-insensitive partial match with OR logic
    // SECURITY: Only filter users whose location visibility is PUBLIC
    // Users with 'private' or 'match-only' location settings should not be searchable by location
    const locationFilters: string[] = []

    if (locationCity && locationCity.trim() !== '') {
      locationFilters.push(`location_city.ilike.%${locationCity.trim()}%`)
    }

    if (locationState && locationState.trim() !== '') {
      locationFilters.push(`location_state.ilike.%${locationState.trim()}%`)
    }

    if (locationCountry && locationCountry.trim() !== '') {
      locationFilters.push(`location_country.ilike.%${locationCountry.trim()}%`)
    }

    // Apply location filters with OR logic (match any location field)
    if (locationFilters.length > 0) {
      query = query
        .eq('location_visibility', 'public')
        .or(locationFilters.join(','))
    }

    // Text search across multiple fields using ilike for case-insensitive substring matching
    if (searchQuery || subjectCustomDescription || skillLevelCustomDescription ||
        studyStyleCustomDescription || interestsCustomDescription ||
        aboutYourselfSearch || school || languages || availableHours) {

      const searchFilters: string[] = []
      
      if (searchQuery) {
        const term = searchQuery.trim()
        searchFilters.push(`bio.ilike.%${term}%`)
        searchFilters.push(`school.ilike.%${term}%`)
        searchFilters.push(`languages.ilike.%${term}%`)
        searchFilters.push(`aboutYourself.ilike.%${term}%`)
      }
      if (subjectCustomDescription) {
        searchFilters.push(`subjectCustomDescription.ilike.%${subjectCustomDescription.trim()}%`)
      }
      if (skillLevelCustomDescription) {
        searchFilters.push(`skillLevelCustomDescription.ilike.%${skillLevelCustomDescription.trim()}%`)
      }
      if (studyStyleCustomDescription) {
        searchFilters.push(`studyStyleCustomDescription.ilike.%${studyStyleCustomDescription.trim()}%`)
      }
      if (interestsCustomDescription) {
        searchFilters.push(`interestsCustomDescription.ilike.%${interestsCustomDescription.trim()}%`)
      }
      if (aboutYourselfSearch) {
        searchFilters.push(`aboutYourself.ilike.%${aboutYourselfSearch.trim()}%`)
      }
      if (school) {
        searchFilters.push(`school.ilike.%${school.trim()}%`)
      }
      if (languages) {
        searchFilters.push(`languages.ilike.%${languages.trim()}%`)
      }
      if (availableHours) {
        searchFilters.push(`availabilityCustomDescription.ilike.%${availableHours.trim()}%`)
      }

      // Apply OR logic for text search (match any field)
      if (searchFilters.length > 0) {
        query = query.or(searchFilters.join(','))
      }
    }

    // Apply pagination to main query with count
    const skip = (page - 1) * limit

    // Get total count from filtered query (without pagination)
    // Clone the query for counting by rebuilding it
    let countQuery = supabase
      .from('Profile')
      .select('userId', { count: 'exact', head: true })
      .neq('userId', user.id)

    // Apply same exclusions to count query
    if (pendingOrOtherUserIds.size > 0) {
      countQuery = countQuery.not('userId', 'in', `(${Array.from(pendingOrOtherUserIds).join(',')})`)
    }

    // Apply same filters to count query
    if (subjects && subjects.length > 0) {
      countQuery = countQuery.overlaps('subjects', subjects)
    }
    if (skillLevel && skillLevel !== '') {
      countQuery = countQuery.eq('skillLevel', skillLevel)
    }
    if (studyStyle && studyStyle !== '') {
      countQuery = countQuery.eq('studyStyle', studyStyle)
    }
    if (interests && interests.length > 0) {
      countQuery = countQuery.overlaps('interests', interests)
    }
    if (availability && availability.length > 0) {
      countQuery = countQuery.overlaps('availableDays', availability)
    }
    if (goals && goals.length > 0) {
      countQuery = countQuery.overlaps('goals', goals)
    }
    if (role && role.length > 0) {
      countQuery = countQuery.in('role', role)
    }
    if (ageRange && ageRange !== '') {
      const ageRanges: Record<string, { min: number; max: number }> = {
        'under-18': { min: 0, max: 17 },
        '18-24': { min: 18, max: 24 },
        '25-34': { min: 25, max: 34 },
        '35-44': { min: 35, max: 44 },
        '45+': { min: 45, max: 999 }
      }
      const range = ageRanges[ageRange]
      if (range) {
        countQuery = countQuery.gte('age', range.min).lte('age', range.max)
      }
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      logger.error('Partner search count query error', countError)
    }

    // Apply pagination to main query
    query = query.range(skip, skip + limit - 1).order('updatedAt', { ascending: false })

    const { data: profiles, error: profileError } = await query

    if (profileError) {
      logger.error('Partner search query error', profileError)
      throw new Error(`Search failed: ${profileError.message}`)
    }

    // SECURITY: Sanitize location data based on privacy settings
    // Hide location for users who have set their location to private or match-only (if not matched)
    const sanitizedProfiles = (profiles || []).map(profile => {
      const locationVisibility = profile.location_visibility || 'private'

      // If location is private, always hide it
      if (locationVisibility === 'private') {
        return {
          ...profile,
          location_city: null,
          location_state: null,
          location_country: null,
        }
      }

      // If location is match-only, only show to accepted partners
      if (locationVisibility === 'match-only' && !acceptedPartnerIds.has(profile.userId)) {
        return {
          ...profile,
          location_city: null,
          location_state: null,
          location_country: null,
        }
      }

      // Location is public or user is matched partner - show location
      return profile
    })

    // Get current user's profile for compatibility scoring (include all matching fields)
    const { data: myProfile } = await supabase
      .from('Profile')
      .select('subjects, interests, studyStyle, skillLevel, goals, availableDays, availableHours, school, timezone, languages, role, location_lat, location_lng, location_city, location_country')
      .eq('userId', user.id)
      .single()

    // Get current user's learning profile for strengths/weaknesses
    const { data: myLearningProfile } = await supabase
      .from('LearningProfile')
      .select('strengths, weaknesses')
      .eq('userId', user.id)
      .single()

    // Check current user's profile completeness using the enhanced algorithm
    const currentUserProfileData: ProfileData = {
      subjects: myProfile?.subjects,
      interests: myProfile?.interests,
      goals: myProfile?.goals,
      availableDays: myProfile?.availableDays,
      availableHours: myProfile?.availableHours,
      skillLevel: myProfile?.skillLevel,
      studyStyle: myProfile?.studyStyle,
      school: myProfile?.school,
      timezone: myProfile?.timezone,
      languages: myProfile?.languages,
      role: myProfile?.role,
      strengths: myLearningProfile?.strengths,
      weaknesses: myLearningProfile?.weaknesses,
      // Location fields for proximity matching
      location_lat: myProfile?.location_lat,
      location_lng: myProfile?.location_lng,
      location_city: myProfile?.location_city,
      location_country: myProfile?.location_country,
    }
    
    const currentUserFilledCount = countFilledFields(currentUserProfileData)
    const currentUserMissingFields = getMissingFields(currentUserProfileData)
    const currentUserProfileComplete = hasMinimumProfileData(currentUserProfileData)

    // All filtering is now done at database level, so we just use the sanitized profiles
    const filteredProfiles = sanitizedProfiles

    // Calculate match scores using the enhanced algorithm
    const profilesWithScores = filteredProfiles.map(profile => {
      // Prepare partner profile data with all matching fields
      const partnerProfileData: ProfileData = {
        subjects: profile.subjects,
        interests: profile.interests,
        goals: profile.goals,
        availableDays: profile.availableDays,
        availableHours: profile.availableHours,
        skillLevel: profile.skillLevel,
        studyStyle: profile.studyStyle,
        school: profile.school,
        timezone: profile.timezone,
        languages: profile.languages,
        role: profile.role,
        // Location fields for proximity matching
        location_lat: profile.location_lat,
        location_lng: profile.location_lng,
        location_city: profile.location_city,
        location_country: profile.location_country,
      }

      // Calculate match using the enhanced algorithm
      const matchResult = calculateMatchScore(currentUserProfileData, partnerProfileData)

      // Check if this user is an accepted partner
      const isAlreadyPartner = acceptedPartnerIds.has(profile.userId)

      return {
        ...profile,
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
        isAlreadyPartner,
        // Partner profile completeness
        partnerProfileComplete: hasMinimumProfileData(partnerProfileData),
      }
    })

    // Sort by match score using the utility function (highest first, nulls last)
    const sortedProfiles = sortByMatchScore(profilesWithScores)

    return NextResponse.json({
      success: true,
      profiles: sortedProfiles,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      // Current user's profile status
      currentUserProfileComplete,
      currentUserFilledCount,
      currentUserMissingFields,
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
