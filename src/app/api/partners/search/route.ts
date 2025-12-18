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
import {
  sanitizeSearchQuery,
  sanitizeArrayInput,
  validateSkillLevel,
  validateStudyStyle,
  validateAgeRange,
  escapeLikePattern,
} from '@/lib/security/search-sanitization'

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

    const rawData = validation.data

    // SECURITY: Sanitize all search inputs to prevent injection and abuse
    const sanitizedSearch = sanitizeSearchQuery(rawData.searchQuery)
    const searchQuery = sanitizedSearch.sanitized || undefined
    const searchType = rawData.searchType
    
    // Sanitize array inputs
    const subjects = sanitizeArrayInput(rawData.subjects, { maxItems: 10 })
    const interests = sanitizeArrayInput(rawData.interests, { maxItems: 10 })
    const availability = sanitizeArrayInput(rawData.availability, { maxItems: 7 })
    const goals = sanitizeArrayInput(rawData.goals, { maxItems: 10 })
    const role = sanitizeArrayInput(rawData.role, { maxItems: 5 })
    
    // Validate enum values
    const skillLevel = validateSkillLevel(rawData.skillLevel)
    const studyStyle = validateStudyStyle(rawData.studyStyle)
    const ageRangeValues = validateAgeRange(rawData.ageRange)
    const ageRange = rawData.ageRange // Keep original for hasSearchCriteria check
    
    // Sanitize text search fields
    const availableHours = sanitizeSearchQuery(rawData.availableHours).sanitized || undefined
    const subjectCustomDescription = sanitizeSearchQuery(rawData.subjectCustomDescription).sanitized || undefined
    const skillLevelCustomDescription = sanitizeSearchQuery(rawData.skillLevelCustomDescription).sanitized || undefined
    const studyStyleCustomDescription = sanitizeSearchQuery(rawData.studyStyleCustomDescription).sanitized || undefined
    const interestsCustomDescription = sanitizeSearchQuery(rawData.interestsCustomDescription).sanitized || undefined
    const aboutYourselfSearch = sanitizeSearchQuery(rawData.aboutYourselfSearch).sanitized || undefined
    const school = sanitizeSearchQuery(rawData.school).sanitized || undefined
    const languages = sanitizeSearchQuery(rawData.languages).sanitized || undefined
    const locationCity = sanitizeSearchQuery(rawData.locationCity).sanitized || undefined
    const locationState = sanitizeSearchQuery(rawData.locationState).sanitized || undefined
    const locationCountry = sanitizeSearchQuery(rawData.locationCountry).sanitized || undefined
    
    const page = rawData.page
    const limit = rawData.limit

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

    // Filter by age range (using pre-validated values)
    if (ageRangeValues) {
      query = query.gte('age', ageRangeValues.min).lte('age', ageRangeValues.max)
    }

    // Filter by location - case-insensitive partial match with OR logic
    // SECURITY: Only filter users whose location visibility is PUBLIC
    // Users with 'private' or 'match-only' location settings should not be searchable by location
    // SECURITY: Escape LIKE pattern special characters to prevent pattern injection
    const locationFilters: string[] = []

    if (locationCity) {
      const escapedCity = escapeLikePattern(locationCity)
      locationFilters.push(`location_city.ilike.%${escapedCity}%`)
    }

    if (locationState) {
      const escapedState = escapeLikePattern(locationState)
      locationFilters.push(`location_state.ilike.%${escapedState}%`)
    }

    if (locationCountry) {
      const escapedCountry = escapeLikePattern(locationCountry)
      locationFilters.push(`location_country.ilike.%${escapedCountry}%`)
    }

    // Apply location filters with OR logic (match any location field)
    if (locationFilters.length > 0) {
      query = query
        .eq('location_visibility', 'public')
        .or(locationFilters.join(','))
    }

    // Text search across multiple fields using ilike for case-insensitive substring matching
    // SECURITY: All text inputs are already sanitized and escaped
    // NOTE: For searchQuery with spaces, we need to use textSearch or filter in JS
    // because Supabase .or() doesn't handle spaces well in the filter string

    // Track if we're doing a searchQuery search (will filter in JS for better results)
    let useJSFiltering = false
    let jsSearchQuery = ''

    if (searchQuery || subjectCustomDescription || skillLevelCustomDescription ||
        studyStyleCustomDescription || interestsCustomDescription ||
        aboutYourselfSearch || school || languages || availableHours) {

      const searchFilters: string[] = []

      if (searchQuery) {
        // For queries with spaces or special characters, use JS filtering for accuracy
        // This is more reliable than trying to escape for Supabase .or() syntax
        if (searchQuery.includes(' ') || searchQuery.length > 50) {
          useJSFiltering = true
          jsSearchQuery = searchQuery.toLowerCase()
        } else {
          // Simple single-word search can use database filtering
          const escaped = escapeLikePattern(searchQuery)

          // === TEXT FIELDS (using ilike for partial match) ===
          // Note: Supabase uses % for wildcards in ilike patterns
          searchFilters.push(`user.name.ilike.%${escaped}%`)
          searchFilters.push(`bio.ilike.%${escaped}%`)
          searchFilters.push(`school.ilike.%${escaped}%`)
          searchFilters.push(`languages.ilike.%${escaped}%`)
          searchFilters.push(`aboutYourself.ilike.%${escaped}%`)
          searchFilters.push(`timezone.ilike.%${escaped}%`)
          searchFilters.push(`role.ilike.%${escaped}%`)
          searchFilters.push(`location_city.ilike.%${escaped}%`)
          searchFilters.push(`location_state.ilike.%${escaped}%`)
          searchFilters.push(`location_country.ilike.%${escaped}%`)
          searchFilters.push(`subjectCustomDescription.ilike.%${escaped}%`)
          searchFilters.push(`skillLevelCustomDescription.ilike.%${escaped}%`)
          searchFilters.push(`studyStyleCustomDescription.ilike.%${escaped}%`)
          searchFilters.push(`interestsCustomDescription.ilike.%${escaped}%`)
          searchFilters.push(`availabilityCustomDescription.ilike.%${escaped}%`)

          // === ENUM FIELDS (exact match for skillLevel and studyStyle) ===
          const skillLevelMatch = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].find(
            level => level.toLowerCase().includes(searchQuery.toLowerCase())
          )
          if (skillLevelMatch) {
            searchFilters.push(`skillLevel.eq.${skillLevelMatch}`)
          }

          const studyStyleMatch = ['VISUAL', 'AUDITORY', 'KINESTHETIC', 'READING_WRITING', 'COLLABORATIVE', 'INDEPENDENT', 'SOLO', 'MIXED'].find(
            style => style.toLowerCase().replace('_', ' ').includes(searchQuery.toLowerCase()) ||
                     style.toLowerCase().includes(searchQuery.toLowerCase())
          )
          if (studyStyleMatch) {
            searchFilters.push(`studyStyle.eq.${studyStyleMatch}`)
          }
        }
      }

      // These specific field filters can still use database filtering
      if (subjectCustomDescription) {
        const escaped = escapeLikePattern(subjectCustomDescription)
        searchFilters.push(`subjectCustomDescription.ilike.%${escaped}%`)
      }
      if (skillLevelCustomDescription) {
        const escaped = escapeLikePattern(skillLevelCustomDescription)
        searchFilters.push(`skillLevelCustomDescription.ilike.%${escaped}%`)
      }
      if (studyStyleCustomDescription) {
        const escaped = escapeLikePattern(studyStyleCustomDescription)
        searchFilters.push(`studyStyleCustomDescription.ilike.%${escaped}%`)
      }
      if (interestsCustomDescription) {
        const escaped = escapeLikePattern(interestsCustomDescription)
        searchFilters.push(`interestsCustomDescription.ilike.%${escaped}%`)
      }
      if (aboutYourselfSearch) {
        const escaped = escapeLikePattern(aboutYourselfSearch)
        searchFilters.push(`aboutYourself.ilike.%${escaped}%`)
      }
      if (school) {
        const escaped = escapeLikePattern(school)
        searchFilters.push(`school.ilike.%${escaped}%`)
      }
      if (languages) {
        const escaped = escapeLikePattern(languages)
        searchFilters.push(`languages.ilike.%${escaped}%`)
      }
      if (availableHours) {
        const escaped = escapeLikePattern(availableHours)
        searchFilters.push(`availabilityCustomDescription.ilike.%${escaped}%`)
      }

      // Apply OR logic for database-side text search (only if not using JS filtering)
      if (searchFilters.length > 0 && !useJSFiltering) {
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
    if (ageRangeValues) {
      countQuery = countQuery.gte('age', ageRangeValues.min).lte('age', ageRangeValues.max)
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

    // Apply JS-side filtering for complex search queries (with spaces)
    // This provides more accurate matching for multi-word searches
    let filteredProfiles = sanitizedProfiles

    if (useJSFiltering && jsSearchQuery) {
      const searchTermLower = jsSearchQuery.toLowerCase()

      filteredProfiles = sanitizedProfiles.filter(profile => {
        // Helper to check if a string field contains the search term
        const matchesText = (field: string | null | undefined): boolean => {
          return field ? field.toLowerCase().includes(searchTermLower) : false
        }

        // Helper to check if an array field contains the search term
        const matchesArray = (arr: string[] | null | undefined): boolean => {
          if (!arr || !Array.isArray(arr)) return false
          return arr.some(item => item.toLowerCase().includes(searchTermLower))
        }

        // Search across ALL profile fields
        // Note: profile.user is the joined User object from Supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userObj = profile.user as any
        const userName = Array.isArray(userObj) ? userObj[0]?.name : userObj?.name

        return (
          // User fields
          matchesText(userName) ||

          // Profile text fields
          matchesText(profile.bio) ||
          matchesText(profile.school) ||
          matchesText(profile.languages) ||
          matchesText(profile.aboutYourself) ||
          matchesText(profile.timezone) ||
          matchesText(profile.role) ||

          // Location fields
          matchesText(profile.location_city) ||
          matchesText(profile.location_state) ||
          matchesText(profile.location_country) ||

          // Custom description fields
          matchesText(profile.subjectCustomDescription) ||
          matchesText(profile.skillLevelCustomDescription) ||
          matchesText(profile.studyStyleCustomDescription) ||
          matchesText(profile.interestsCustomDescription) ||
          matchesText(profile.availabilityCustomDescription) ||

          // Enum fields (skill level and study style)
          matchesText(profile.skillLevel) ||
          matchesText(profile.studyStyle) ||

          // Array fields
          matchesArray(profile.subjects) ||
          matchesArray(profile.interests) ||
          matchesArray(profile.goals) ||
          matchesArray(profile.availableDays) ||
          matchesArray(profile.availableHours) ||
          matchesArray(profile.aboutYourselfItems)
        )
      })
    }

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
