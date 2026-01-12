/**
 * Partner Search API - Smart Semantic Search
 *
 * Enterprise-level search like YouTube:
 * - "CS" matches "Computer Science"
 * - "math" matches "Mathematics", "Calculus", "Algebra"
 * - "saginaw" matches "Saginaw High School"
 *
 * Features:
 * - Vector semantic search with OpenAI embeddings
 * - Hybrid scoring (vector + text)
 * - Synonym expansion
 * - N+1 query prevention
 * - Caching for scale
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { getBlockedUserIds } from '@/lib/blocked-users'
import { getOrSetCached, CACHE_TTL, CACHE_PREFIX } from '@/lib/cache'
import {
  calculateMatchScore,
  countFilledFields,
  getMissingFields,
  hasMinimumProfileData,
  type ProfileData
} from '@/lib/matching'
import {
  sanitizeSearchQuery,
  sanitizeArrayInput,
  validateSkillLevel,
  validateStudyStyle,
  validateAgeRange,
} from '@/lib/security/search-sanitization'
import { searchPartnersSmartly } from '@/lib/search'

// ============================================
// Input Validation Schema
// ============================================

const searchSchema = z.object({
  searchQuery: z.string().optional(),
  // searchType kept for backward compatibility but now defaults to smart semantic search
  searchType: z.enum(['simple', 'full', 'smart']).optional().default('smart'),
  useSemanticSearch: z.boolean().optional().default(true),
  subjects: z.array(z.string()).optional(),
  skillLevel: z.string().optional(),
  studyStyle: z.string().optional(),
  interests: z.array(z.string()).optional(),
  availability: z.array(z.string()).optional(),
  availableHours: z.string().optional(),
  subjectCustomDescription: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  studyStyleCustomDescription: z.string().optional(),
  interestsCustomDescription: z.string().optional(),
  aboutYourselfSearch: z.string().optional(),
  school: z.string().optional(),
  languages: z.string().optional(),
  ageRange: z.string().optional(),
  role: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  locationCountry: z.string().optional(),
  // Strengths and Weaknesses filters (search in LearningProfile)
  strengthsFilter: z.string().optional(),
  weaknessesFilter: z.string().optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

// ============================================
// Main API Handler
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimit(request, RateLimitPresets.expensiveSearch)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many search requests. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('Partner search - authentication failed')
      return NextResponse.json(
        { error: 'Please sign in to search for partners' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validation = searchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const rawData = validation.data

    // Sanitize inputs
    const sanitizedSearch = sanitizeSearchQuery(rawData.searchQuery)
    const searchQuery = sanitizedSearch.sanitized || undefined
    const subjects = sanitizeArrayInput(rawData.subjects, { maxItems: 10 })
    const interests = sanitizeArrayInput(rawData.interests, { maxItems: 10 })
    const goals = sanitizeArrayInput(rawData.goals, { maxItems: 10 })
    const skillLevel = validateSkillLevel(rawData.skillLevel)
    const studyStyle = validateStudyStyle(rawData.studyStyle)
    const ageRangeValues = validateAgeRange(rawData.ageRange)

    const locationCity = sanitizeSearchQuery(rawData.locationCity).sanitized || undefined
    const locationState = sanitizeSearchQuery(rawData.locationState).sanitized || undefined
    const locationCountry = sanitizeSearchQuery(rawData.locationCountry).sanitized || undefined

    // Sanitize strengths and weaknesses filters
    const strengthsFilter = sanitizeSearchQuery(rawData.strengthsFilter).sanitized || undefined
    const weaknessesFilter = sanitizeSearchQuery(rawData.weaknessesFilter).sanitized || undefined

    const page = rawData.page
    const limit = rawData.limit
    const useSemanticSearch = rawData.useSemanticSearch

    // Validate at least one search criteria
    // Include ALL filters that the frontend can send
    const hasSearchCriteria =
      (searchQuery && searchQuery.trim().length > 0) ||
      (subjects && subjects.length > 0) ||
      (skillLevel && skillLevel !== '') ||
      (studyStyle && studyStyle !== '') ||
      (interests && interests.length > 0) ||
      (goals && goals.length > 0) ||
      (rawData.ageRange && rawData.ageRange !== '') ||
      (locationCity && locationCity.trim().length > 0) ||
      (locationState && locationState.trim().length > 0) ||
      (locationCountry && locationCountry.trim().length > 0) ||
      (rawData.school && rawData.school.trim().length > 0) ||
      (strengthsFilter && strengthsFilter.trim().length > 0) ||
      (weaknessesFilter && weaknessesFilter.trim().length > 0) ||
      // Additional filters from frontend that were missing
      (rawData.skillLevelCustomDescription && rawData.skillLevelCustomDescription.trim().length > 0) ||
      (rawData.studyStyleCustomDescription && rawData.studyStyleCustomDescription.trim().length > 0) ||
      (rawData.availability && rawData.availability.length > 0) ||
      (rawData.availableHours && rawData.availableHours.trim().length > 0) ||
      (rawData.interestsCustomDescription && rawData.interestsCustomDescription.trim().length > 0) ||
      (rawData.languages && rawData.languages.trim().length > 0) ||
      (rawData.role && rawData.role.length > 0) ||
      (rawData.subjectCustomDescription && rawData.subjectCustomDescription.trim().length > 0) ||
      (rawData.aboutYourselfSearch && rawData.aboutYourselfSearch.trim().length > 0)

    if (!hasSearchCriteria) {
      return NextResponse.json(
        { error: 'At least one search filter or criteria must be provided' },
        { status: 400 }
      )
    }

    // Get blocked users and existing connections to exclude
    const blockedUserIds = await getBlockedUserIds(user.id)

    // Get existing matches (to show status)
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

    const acceptedPartnerIds = new Set<string>()
    const pendingOrOtherUserIds = new Set<string>()

    existingMatches.forEach(match => {
      const otherUserId = match.senderId === user.id ? match.receiverId : match.senderId
      if (match.status === 'ACCEPTED') {
        acceptedPartnerIds.add(otherUserId)
      } else {
        pendingOrOtherUserIds.add(otherUserId)
      }
    })

    // Combine exclusion lists
    const excludeUserIds = [...new Set([...blockedUserIds, ...pendingOrOtherUserIds])]

    // Build cache key - include ALL filters for proper cache invalidation
    const cacheKey = `${CACHE_PREFIX.SEARCH_PARTNERS}:${user.id}:${JSON.stringify({
      searchQuery, subjects, skillLevel, studyStyle, interests, goals,
      ageRange: rawData.ageRange, locationCity, locationState, locationCountry,
      strengthsFilter, weaknessesFilter,
      // Include additional filters in cache key
      availability: rawData.availability,
      availableHours: rawData.availableHours,
      languages: rawData.languages,
      role: rawData.role,
      skillLevelCustomDescription: rawData.skillLevelCustomDescription,
      studyStyleCustomDescription: rawData.studyStyleCustomDescription,
      interestsCustomDescription: rawData.interestsCustomDescription,
      page, limit, useSemanticSearch
    })}`

    // Try cache first
    return await getOrSetCached(
      cacheKey,
      CACHE_TTL.SEARCH_PARTNERS,
      async () => {
        // Build combined search query for semantic search
        const combinedSearchQuery = [
          searchQuery,
          rawData.school,
          rawData.subjectCustomDescription,
          rawData.skillLevelCustomDescription,
          rawData.studyStyleCustomDescription,
          rawData.interestsCustomDescription,
          rawData.aboutYourselfSearch,
          locationCity,
          locationState,
          locationCountry,
          // Include strengths and weaknesses in semantic search
          strengthsFilter,
          weaknessesFilter,
        ].filter(Boolean).join(' ').trim()

        let profiles: Array<{
          id: string
          userId: string
          similarity: number
          hybridScore: number
          textScore: number
          profile: {
            id: string
            userId: string
            bio: string | null
            school: string | null
            languages: string | null
            subjects: string[]
            interests: string[]
            goals: string[]
            skillLevel: string | null
            studyStyle: string | null
            age: number | null
            location_city: string | null
            location_state: string | null
            location_country: string | null
            // Additional fields for consistent match scoring
            location_lat?: number | null
            location_lng?: number | null
            availableDays?: string[] | null
            availableHours?: string[] | null
            timezone?: string | null
            role?: string | null
            aboutYourself: string | null
            subjectCustomDescription: string | null
            user: {
              id: string
              name: string | null
              avatarUrl: string | null
              lastLoginAt: Date | null
            }
          }
        }> = []
        let totalCount = 0
        let searchMetadata = { usedVectorSearch: false, tokensUsed: 0 }

        // Use semantic search if query provided and enabled
        if (combinedSearchQuery && useSemanticSearch) {
          try {
            const semanticResults = await searchPartnersSmartly({
              query: combinedSearchQuery,
              excludeUserId: user.id,
              excludeUserIds,
              filters: {
                subjects,
                skillLevel,
                studyStyle,
                interests,
                goals,
                ageMin: ageRangeValues?.min,
                ageMax: ageRangeValues?.max,
                locationCity,
                locationState,
                locationCountry,
              },
              limit: limit * 2, // Fetch extra for filtering
              offset: 0
            })

            profiles = semanticResults.results
            totalCount = semanticResults.total
            searchMetadata = {
              usedVectorSearch: semanticResults.searchMetadata.usedVectorSearch,
              tokensUsed: semanticResults.searchMetadata.tokensUsed
            }

            logger.debug('Semantic partner search completed', {
              query: combinedSearchQuery,
              resultsCount: profiles.length,
              usedVectorSearch: searchMetadata.usedVectorSearch
            })
          } catch (error) {
            logger.warn('Semantic search failed, falling back to traditional search', { error })
            // Fall through to traditional search
          }
        }

        // Fallback to traditional search if semantic search wasn't used or failed
        if (profiles.length === 0) {
          const traditionalResults = await performTraditionalSearch({
            userId: user.id,
            excludeUserIds,
            searchQuery: combinedSearchQuery,
            subjects,
            skillLevel,
            studyStyle,
            interests,
            goals,
            ageRangeValues,
            locationCity,
            locationState,
            locationCountry,
            strengthsFilter,
            weaknessesFilter,
            // Additional filters
            availability: rawData.availability,
            availableHours: rawData.availableHours,
            languages: rawData.languages,
            role: rawData.role,
            limit: limit * 2,
            offset: 0
          })

          profiles = traditionalResults.profiles
          totalCount = traditionalResults.total
        }

        // Get current user's profile for compatibility scoring
        const myProfile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: {
            subjects: true,
            interests: true,
            studyStyle: true,
            skillLevel: true,
            goals: true,
            availableDays: true,
            availableHours: true,
            school: true,
            timezone: true,
            languages: true,
            role: true,
            location_lat: true,
            location_lng: true,
            location_city: true,
            location_country: true,
          }
        })

        // Prepare current user profile data for match scoring
        const currentUserProfileData: ProfileData = {
          subjects: myProfile?.subjects,
          interests: myProfile?.interests,
          goals: myProfile?.goals,
          availableDays: myProfile?.availableDays,
          availableHours: myProfile?.availableHours,
          skillLevel: myProfile?.skillLevel?.toString(),
          studyStyle: myProfile?.studyStyle?.toString(),
          school: myProfile?.school,
          timezone: myProfile?.timezone,
          languages: myProfile?.languages ? myProfile.languages.split(',').map(l => l.trim()) : null,
          role: myProfile?.role,
          location_lat: myProfile?.location_lat,
          location_lng: myProfile?.location_lng,
          location_city: myProfile?.location_city,
          location_country: myProfile?.location_country,
        }

        const currentUserFilledCount = countFilledFields(currentUserProfileData)
        const currentUserMissingFields = getMissingFields(currentUserProfileData)
        const currentUserProfileComplete = hasMinimumProfileData(currentUserProfileData)

        // Calculate comprehensive match scores
        const profilesWithScores = profiles.map(result => {
          const profile = result.profile as any // Cast to any to access additional fields from updated queries

          // IMPORTANT: Include ALL the same fields used in /api/users/[userId] for consistent match scores
          const partnerProfileData: ProfileData = {
            subjects: profile.subjects,
            interests: profile.interests,
            goals: profile.goals,
            availableDays: profile.availableDays ?? null,
            availableHours: profile.availableHours ?? null,
            skillLevel: profile.skillLevel?.toString() ?? null,
            studyStyle: profile.studyStyle?.toString() ?? null,
            school: profile.school,
            timezone: profile.timezone ?? null,
            languages: profile.languages ? String(profile.languages).split(',').map((l: string) => l.trim()) : null,
            role: profile.role ?? null,
            location_lat: profile.location_lat ?? null,
            location_lng: profile.location_lng ?? null,
            location_city: profile.location_city,
            location_country: profile.location_country,
          }

          // Calculate match using existing algorithm
          const matchResult = calculateMatchScore(currentUserProfileData, partnerProfileData)

          // Combine semantic similarity with match score
          const combinedScore = (result.hybridScore * 0.6) + ((matchResult.matchScore ?? 0) / 100 * 0.4)

          return {
            // Profile data
            ...profile,
            user: profile.user,
            // Search scores
            similarity: result.similarity,
            hybridScore: result.hybridScore,
            textScore: result.textScore,
            // Match scores from algorithm
            matchScore: matchResult.matchScore,
            matchReasons: matchResult.matchReasons,
            matchDataInsufficient: matchResult.matchDataInsufficient,
            matchDetails: matchResult.matchDetails,
            matchTier: matchResult.matchTier,
            componentScores: matchResult.componentScores,
            summary: matchResult.summary,
            partnerMissingFields: matchResult.partnerMissingFields,
            // Combined ranking score
            combinedScore,
            // Partner status
            isAlreadyPartner: acceptedPartnerIds.has(profile.userId),
            partnerProfileComplete: hasMinimumProfileData(partnerProfileData),
          }
        })

        // Sort by combined score (highest first)
        profilesWithScores.sort((a, b) => b.combinedScore - a.combinedScore)

        // Apply pagination
        const skip = (page - 1) * limit
        const paginatedResults = profilesWithScores.slice(skip, skip + limit)

        return {
          success: true,
          profiles: paginatedResults,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
          },
          currentUserProfileComplete,
          currentUserFilledCount,
          currentUserMissingFields,
          searchMetadata: {
            usedSemanticSearch: searchMetadata.usedVectorSearch,
            tokensUsed: searchMetadata.tokensUsed,
          }
        }
      }
    ).then(data => {
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        }
      })
    })
  } catch (error) {
    logger.error('Partner search error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// Traditional Search Fallback
// ============================================

interface TraditionalSearchParams {
  userId: string
  excludeUserIds: string[]
  searchQuery?: string
  subjects?: string[] | null
  skillLevel?: string | null
  studyStyle?: string | null
  interests?: string[] | null
  goals?: string[] | null
  ageRangeValues?: { min: number; max: number } | null
  locationCity?: string | null
  locationState?: string | null
  locationCountry?: string | null
  // Strengths and Weaknesses filters
  strengthsFilter?: string | null
  weaknessesFilter?: string | null
  // Additional filters for availability, languages, and role
  availability?: string[] | null
  availableHours?: string | null
  languages?: string | null
  role?: string[] | null
  limit: number
  offset: number
}

async function performTraditionalSearch(params: TraditionalSearchParams) {
  const {
    userId,
    excludeUserIds,
    searchQuery,
    subjects,
    skillLevel,
    studyStyle,
    interests,
    goals,
    ageRangeValues,
    locationCity,
    locationState,
    locationCountry,
    strengthsFilter,
    weaknessesFilter,
    // Additional filters
    availability,
    availableHours,
    languages,
    role,
    limit,
    offset
  } = params

  // Build where conditions
  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { userId: { not: userId } },
      ...(excludeUserIds.length > 0 ? [{ userId: { notIn: excludeUserIds } }] : [])
    ]
  }

  // Filters
  if (subjects && subjects.length > 0) {
    whereConditions.AND.push({ subjects: { hasSome: subjects } })
  }
  if (skillLevel) {
    whereConditions.AND.push({ skillLevel: skillLevel as unknown as undefined })
  }
  if (studyStyle) {
    whereConditions.AND.push({ studyStyle: studyStyle as unknown as undefined })
  }
  if (interests && interests.length > 0) {
    whereConditions.AND.push({ interests: { hasSome: interests } })
  }
  if (goals && goals.length > 0) {
    whereConditions.AND.push({ goals: { hasSome: goals } })
  }
  if (ageRangeValues) {
    whereConditions.AND.push({ age: { gte: ageRangeValues.min, lte: ageRangeValues.max } })
  }

  // Location filters
  if (locationCity) {
    whereConditions.AND.push({
      location_city: { contains: locationCity, mode: 'insensitive' }
    })
  }
  if (locationState) {
    whereConditions.AND.push({
      location_state: { contains: locationState, mode: 'insensitive' }
    })
  }
  if (locationCountry) {
    whereConditions.AND.push({
      location_country: { contains: locationCountry, mode: 'insensitive' }
    })
  }

  // Availability filters (days of week)
  if (availability && availability.length > 0) {
    whereConditions.AND.push({ availableDays: { hasSome: availability } })
  }

  // Available hours filter (text search in availableHours array)
  if (availableHours && availableHours.trim()) {
    // Search for overlap - user might type "morning", "9am", etc.
    const hourTerms = availableHours.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1)
    if (hourTerms.length > 0) {
      // Use OR to find profiles with any matching hour term
      whereConditions.AND.push({
        OR: hourTerms.map(term => ({
          availableHours: { has: term }
        }))
      })
    }
  }

  // Languages filter (comma-separated text field)
  if (languages && languages.trim()) {
    whereConditions.AND.push({
      languages: { contains: languages.trim(), mode: 'insensitive' }
    })
  }

  // Role filter (array of roles)
  if (role && role.length > 0) {
    // Match any of the selected roles (case-insensitive)
    whereConditions.AND.push({
      OR: role.map(r => ({
        role: { equals: r, mode: 'insensitive' }
      }))
    })
  }

  // Text search - search in text fields INCLUDING user name
  const searchTerms: string[] = []
  if (searchQuery && searchQuery.trim()) {
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 1)
    searchTerms.push(...terms)
    if (terms.length > 0) {
      const searchConditions = terms.slice(0, 10).map(term => ({
        OR: [
          { bio: { contains: term, mode: 'insensitive' as const } },
          { school: { contains: term, mode: 'insensitive' as const } },
          { aboutYourself: { contains: term, mode: 'insensitive' as const } },
          { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
          { location_city: { contains: term, mode: 'insensitive' as const } },
          { location_state: { contains: term, mode: 'insensitive' as const } },
          // Search by user name - this allows searching by partner's name
          { user: { name: { contains: term, mode: 'insensitive' as const } } },
        ]
      }))
      whereConditions.AND.push({ OR: searchConditions })
    }
  }

  // Execute queries in parallel (NO N+1!)
  // Also do a raw SQL search for array fields (subjects, interests, goals)
  const [textMatchProfiles, arrayMatchProfileIds] = await Promise.all([
    prisma.profile.findMany({
      where: whereConditions,
      select: {
        id: true,
        userId: true,
        bio: true,
        school: true,
        languages: true,
        subjects: true,
        interests: true,
        goals: true,
        skillLevel: true,
        studyStyle: true,
        age: true,
        location_city: true,
        location_state: true,
        location_country: true,
        // Additional fields for consistent match scoring with /api/users/[userId]
        location_lat: true,
        location_lng: true,
        availableDays: true,
        availableHours: true,
        timezone: true,
        role: true,
        aboutYourself: true,
        subjectCustomDescription: true,
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            lastLoginAt: true
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { updatedAt: 'desc' }
    }),
    // Raw SQL for array field substring search AND user name search
    (async () => {
      if (searchTerms.length === 0) return []

      try {
        const { Prisma } = await import('@prisma/client')

        // Build LIKE patterns for each term
        const patterns = searchTerms.slice(0, 10).map(t => `%${t.toLowerCase()}%`)

        const results = await prisma.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT DISTINCT p.id
            FROM "Profile" p
            INNER JOIN "User" u ON p."userId" = u.id
            WHERE p."userId" != ${userId}
            ${excludeUserIds.length > 0 ? Prisma.sql`AND p."userId" NOT IN (${Prisma.join(excludeUserIds)})` : Prisma.empty}
            AND (
              LOWER(array_to_string(p.subjects, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
              OR LOWER(array_to_string(p.interests, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
              OR LOWER(array_to_string(p.goals, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
              OR LOWER(u.name) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
            )
            LIMIT ${limit}
          `
        )

        return results.map(r => r.id)
      } catch (error) {
        console.warn('Array search query failed, skipping', error)
        return []
      }
    })()
  ])

  // Fetch full profile data for array-matched profiles not in text matches
  const textMatchIds = new Set(textMatchProfiles.map(p => p.id))
  const additionalIds = arrayMatchProfileIds.filter(id => !textMatchIds.has(id))

  let additionalProfiles: typeof textMatchProfiles = []
  if (additionalIds.length > 0) {
    additionalProfiles = await prisma.profile.findMany({
      where: { id: { in: additionalIds } },
      select: {
        id: true,
        userId: true,
        bio: true,
        school: true,
        languages: true,
        subjects: true,
        interests: true,
        goals: true,
        skillLevel: true,
        studyStyle: true,
        age: true,
        location_city: true,
        location_state: true,
        location_country: true,
        // Additional fields for consistent match scoring
        location_lat: true,
        location_lng: true,
        availableDays: true,
        availableHours: true,
        timezone: true,
        role: true,
        aboutYourself: true,
        subjectCustomDescription: true,
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            lastLoginAt: true
          }
        }
      }
    })
  }

  let profiles = [...textMatchProfiles, ...additionalProfiles]

  // Filter by LearningProfile (strengths and weaknesses) if filters provided
  // This queries the LearningProfile table separately and filters profiles
  if (strengthsFilter || weaknessesFilter) {
    const userIdsToCheck = profiles.map(p => p.userId)

    if (userIdsToCheck.length > 0) {
      // Build LearningProfile where conditions
      const learningProfileConditions: Record<string, unknown>[] = []

      // Split the filter text into search terms
      if (strengthsFilter) {
        const strengthTerms = strengthsFilter.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1)
        if (strengthTerms.length > 0) {
          // Search for any term in the strengths array
          learningProfileConditions.push({
            strengths: {
              hasSome: strengthTerms.map(t => t.charAt(0).toUpperCase() + t.slice(1)) // Try capitalized
            }
          })
        }
      }

      if (weaknessesFilter) {
        const weaknessTerms = weaknessesFilter.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1)
        if (weaknessTerms.length > 0) {
          // Search for any term in the weaknesses array
          learningProfileConditions.push({
            weaknesses: {
              hasSome: weaknessTerms.map(t => t.charAt(0).toUpperCase() + t.slice(1)) // Try capitalized
            }
          })
        }
      }

      if (learningProfileConditions.length > 0) {
        // Query LearningProfile to find matching user IDs
        const matchingLearningProfiles = await prisma.learningProfile.findMany({
          where: {
            userId: { in: userIdsToCheck },
            OR: learningProfileConditions,
          },
          select: {
            userId: true,
          },
        })

        const matchingUserIds = new Set(matchingLearningProfiles.map(lp => lp.userId))

        // Also try raw SQL for case-insensitive array search
        if (matchingUserIds.size === 0) {
          try {
            const { Prisma } = await import('@prisma/client')
            const allTerms = [
              ...(strengthsFilter?.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1) || []),
              ...(weaknessesFilter?.toLowerCase().split(/[\s,]+/).filter(t => t.length > 1) || []),
            ]
            const patterns = allTerms.map(t => `%${t}%`)

            if (patterns.length > 0) {
              const rawResults = await prisma.$queryRaw<Array<{ userId: string }>>(
                Prisma.sql`
                  SELECT DISTINCT lp."userId"
                  FROM "LearningProfile" lp
                  WHERE lp."userId" = ANY(ARRAY[${Prisma.join(userIdsToCheck)}]::text[])
                  AND (
                    LOWER(array_to_string(lp.strengths, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
                    OR LOWER(array_to_string(lp.weaknesses, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
                  )
                `
              )

              rawResults.forEach(r => matchingUserIds.add(r.userId))
            }
          } catch (error) {
            console.warn('LearningProfile array search failed, skipping:', error)
          }
        }

        // Filter profiles to only include those with matching LearningProfile
        profiles = profiles.filter(p => matchingUserIds.has(p.userId))
      }
    }
  }

  const total = profiles.length

  // Transform to match semantic search result format
  const formattedProfiles = profiles.map(profile => ({
    id: profile.id,
    userId: profile.userId,
    similarity: 0.5, // Default for non-semantic search
    hybridScore: 0.5,
    textScore: 0.5,
    profile: {
      id: profile.id,
      userId: profile.userId,
      bio: profile.bio,
      school: profile.school,
      languages: profile.languages,
      subjects: profile.subjects,
      interests: profile.interests,
      goals: profile.goals,
      skillLevel: profile.skillLevel?.toString() || null,
      studyStyle: profile.studyStyle?.toString() || null,
      age: profile.age,
      location_city: profile.location_city,
      location_state: profile.location_state,
      location_country: profile.location_country,
      // Additional fields for consistent match scoring
      location_lat: profile.location_lat,
      location_lng: profile.location_lng,
      availableDays: profile.availableDays,
      availableHours: profile.availableHours,
      timezone: profile.timezone,
      role: profile.role,
      aboutYourself: profile.aboutYourself,
      subjectCustomDescription: profile.subjectCustomDescription,
      user: profile.user
    }
  }))

  return { profiles: formattedProfiles, total }
}
