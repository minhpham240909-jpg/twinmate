/**
 * Semantic Search Service
 *
 * Enterprise-level smart search like YouTube:
 * - "CS" matches "Computer Science"
 * - "math" matches "Mathematics", "Calculus", "Algebra"
 * - "saginaw" matches "Saginaw High School"
 *
 * Features:
 * - OpenAI embeddings for semantic understanding
 * - Hybrid search (vector + text) for best results
 * - Synonym expansion for concept matching
 * - Caching for performance at scale
 * - N+1 query prevention
 */

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { generateEmbedding, normalizeText, buildProfileSearchText, buildGroupSearchText } from '@/lib/embeddings'
import { expandSearchTerms, calculateRelevanceScore } from '@/lib/matching/smart-search'
import logger from '@/lib/logger'

// ============================================
// Configuration
// ============================================

const VECTOR_WEIGHT = 0.7
const TEXT_WEIGHT = 0.3
const MIN_SIMILARITY_THRESHOLD = 0.35 // Lower threshold for broader matching
const CACHE_TTL_MS = 60 * 1000 // 1 minute cache

// ============================================
// Types
// ============================================

export interface SemanticSearchParams {
  query: string
  excludeUserId: string
  excludeUserIds?: string[]
  filters?: {
    subjects?: string[] | null
    skillLevel?: string | null
    studyStyle?: string | null
    interests?: string[] | null
    goals?: string[] | null
    ageMin?: number | null
    ageMax?: number | null
    locationCity?: string | null
    locationState?: string | null
    locationCountry?: string | null
  }
  limit?: number
  offset?: number
}

export interface GroupSearchParams {
  query: string
  filters?: {
    skillLevel?: string | null
    subject?: string | null
    privacy?: string | null
  }
  excludeGroupIds?: string[]
  limit?: number
  offset?: number
}

export interface PartnerSearchResult {
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
    // Additional fields for consistent match scoring with /api/users/[userId]
    location_lat: number | null
    location_lng: number | null
    availableDays: string[] | null
    availableHours: string[] | null
    timezone: string | null
    role: string | null
    aboutYourself: string | null
    subjectCustomDescription: string | null
    skillLevelCustomDescription?: string | null
    studyStyleCustomDescription?: string | null
    interestsCustomDescription?: string | null
    user: {
      id: string
      name: string | null
      avatarUrl: string | null
      lastLoginAt: Date | null
    }
  }
}

export interface GroupSearchResult {
  id: string
  similarity: number
  hybridScore: number
  group: {
    id: string
    name: string
    description: string | null
    subject: string | null
    subjectCustomDescription: string | null
    skillLevel: string | null
    skillLevelCustomDescription: string | null
    maxMembers: number
    memberCount: number
    ownerId: string
    ownerName: string
    privacy: string
    createdAt: Date
    isMember: boolean
    isOwner: boolean
  }
}

// ============================================
// In-Memory Cache with LRU-like behavior
// ============================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
  hits: number
}

const searchCache = new Map<string, CacheEntry<unknown>>()
const MAX_CACHE_SIZE = 500

function getCacheKey(type: string, params: unknown): string {
  return `semantic:${type}:${JSON.stringify(params)}`
}

function getFromCache<T>(key: string): T | null {
  const entry = searchCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key)
    return null
  }
  entry.hits++
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  // Evict least-used entries if cache is full
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(searchCache.entries())
    entries.sort((a, b) => a[1].hits - b[1].hits)
    const toDelete = entries.slice(0, MAX_CACHE_SIZE / 4)
    toDelete.forEach(([k]) => searchCache.delete(k))
  }

  searchCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
    hits: 1
  })
}

// ============================================
// Supabase Admin Client (for RPC calls)
// ============================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase configuration missing')
  }

  return createSupabaseAdmin(url, key)
}

// ============================================
// Smart Query Expansion
// ============================================

/**
 * Expand user query with synonyms and related concepts
 * This is the "YouTube-like" smart understanding
 */
function expandQueryForEmbedding(query: string): string {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0)
  const expandedTerms = expandSearchTerms(terms)

  // Deduplicate and limit to prevent too-long queries
  const uniqueTerms = [...new Set(expandedTerms)]
  const limitedTerms = uniqueTerms.slice(0, 30) // Limit to 30 terms

  return limitedTerms.join(' ')
}

// ============================================
// Partner Semantic Search
// ============================================

/**
 * Search for partners using semantic understanding
 * Combines vector similarity with text matching for best results
 */
export async function searchPartnersSmartly(
  params: SemanticSearchParams
): Promise<{
  results: PartnerSearchResult[]
  total: number
  searchMetadata: {
    originalQuery: string
    expandedQuery: string
    usedVectorSearch: boolean
    tokensUsed: number
  }
}> {
  const { query, excludeUserId, excludeUserIds = [], filters, limit = 20, offset = 0 } = params

  // Check cache first
  const cacheKey = getCacheKey('partners', params)
  const cached = getFromCache<{
    results: PartnerSearchResult[]
    total: number
    searchMetadata: { originalQuery: string; expandedQuery: string; usedVectorSearch: boolean; tokensUsed: number }
  }>(cacheKey)

  if (cached) {
    logger.debug('Partner search cache hit', { query })
    return cached
  }

  // Normalize and expand query for semantic understanding
  const normalizedQuery = normalizeText(query)
  const expandedQuery = expandQueryForEmbedding(query)

  logger.debug('Partner search', { originalQuery: query, expandedQuery })

  let usedVectorSearch = false
  let tokensUsed = 0
  let vectorResults: Array<{
    id: string
    user_id: string
    similarity: number
  }> = []

  // Try vector search first
  try {
    const { embedding, tokensUsed: tokens } = await generateEmbedding(
      expandedQuery,
      `partner-search:${excludeUserId}`
    )
    tokensUsed = tokens

    const supabase = getSupabaseAdmin()

    // Combine exclude lists
    const allExcludeIds = [excludeUserId, ...excludeUserIds].filter(Boolean)

    const { data, error } = await supabase.rpc('search_profiles_semantic', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: MIN_SIMILARITY_THRESHOLD,
      match_count: (limit + offset) * 3, // Fetch extra for filtering
      filter_subjects: filters?.subjects || null,
      filter_skill_level: filters?.skillLevel || null,
      filter_study_style: filters?.studyStyle || null,
      filter_interests: filters?.interests || null,
      filter_goals: filters?.goals || null,
      filter_age_min: filters?.ageMin || null,
      filter_age_max: filters?.ageMax || null,
      filter_location_city: filters?.locationCity || null,
      filter_location_state: filters?.locationState || null,
      filter_location_country: filters?.locationCountry || null,
      exclude_user_id: excludeUserId,
      exclude_user_ids: allExcludeIds.length > 1 ? allExcludeIds : null
    })

    if (error) {
      logger.warn('Vector search failed, falling back to text search', { error: error.message })
    } else if (data && data.length > 0) {
      vectorResults = data
      usedVectorSearch = true
    }
  } catch (error) {
    logger.warn('Vector search error, falling back to text search', { error })
  }

  // If vector search failed or returned no results, use text search
  if (!usedVectorSearch || vectorResults.length === 0) {
    return searchPartnersFallback(params, expandedQuery)
  }

  // Batch fetch full profile data (NO N+1!)
  const profileIds = vectorResults.map(r => r.id)

  const profiles = await prisma.profile.findMany({
    where: {
      id: { in: profileIds }
    },
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
      skillLevelCustomDescription: true,
      studyStyleCustomDescription: true,
      interestsCustomDescription: true,
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

  // Create lookup map for O(1) access
  const profileMap = new Map(profiles.map(p => [p.id, p]))

  // Calculate hybrid scores and build results
  const results: PartnerSearchResult[] = vectorResults
    .map(vr => {
      const profile = profileMap.get(vr.id)
      if (!profile) return null

      // Calculate text relevance score
      const textScore = calculateRelevanceScore(normalizedQuery, {
        name: profile.user.name,
        description: profile.bio,
        subject: profile.subjects?.[0],
        subjectCustomDescription: profile.subjectCustomDescription,
        skillLevel: profile.skillLevel?.toString(),
        skillLevelCustomDescription: profile.skillLevelCustomDescription,
      }) / 100 // Normalize to 0-1

      const hybridScore = (vr.similarity * VECTOR_WEIGHT) + (textScore * TEXT_WEIGHT)

      const result: PartnerSearchResult = {
        id: profile.id,
        userId: profile.userId,
        similarity: vr.similarity,
        hybridScore,
        textScore,
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
          skillLevelCustomDescription: profile.skillLevelCustomDescription,
          studyStyleCustomDescription: profile.studyStyleCustomDescription,
          interestsCustomDescription: profile.interestsCustomDescription,
          user: profile.user
        }
      }
      return result
    })
    .filter((r): r is PartnerSearchResult => r !== null)
    .sort((a, b) => b.hybridScore - a.hybridScore)

  // Apply pagination
  const paginatedResults = results.slice(offset, offset + limit)

  const response = {
    results: paginatedResults,
    total: results.length,
    searchMetadata: {
      originalQuery: query,
      expandedQuery,
      usedVectorSearch,
      tokensUsed
    }
  }

  // Cache the results
  setCache(cacheKey, response)

  return response
}

/**
 * Fallback to text-based search when vector search is unavailable
 * Uses a hybrid approach: Prisma for text fields + raw SQL for array substring matching
 */
async function searchPartnersFallback(
  params: SemanticSearchParams,
  expandedQuery: string
): Promise<{
  results: PartnerSearchResult[]
  total: number
  searchMetadata: {
    originalQuery: string
    expandedQuery: string
    usedVectorSearch: boolean
    tokensUsed: number
  }
}> {
  const { query, excludeUserId, excludeUserIds = [], filters, limit = 20, offset = 0 } = params

  // Get expanded search terms
  const searchTerms = expandedQuery.split(/\s+/).filter(t => t.length > 1)
  const uniqueTerms = [...new Set(searchTerms)].slice(0, 15) // Limit terms

  // Build where conditions
  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { userId: { not: excludeUserId } },
      ...(excludeUserIds.length > 0 ? [{ userId: { notIn: excludeUserIds } }] : [])
    ]
  }

  // Add text search conditions (OR across all terms)
  if (uniqueTerms.length > 0) {
    // For each term, create OR conditions across all searchable fields
    // We flatten the conditions so ANY term matching ANY field is a match
    const allSearchConditions: Array<Record<string, unknown>> = []

    for (const term of uniqueTerms) {
      // Text field searches
      allSearchConditions.push(
        { bio: { contains: term, mode: 'insensitive' as const } },
        { school: { contains: term, mode: 'insensitive' as const } },
        { aboutYourself: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { skillLevelCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { studyStyleCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { interestsCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { location_city: { contains: term, mode: 'insensitive' as const } },
        { location_state: { contains: term, mode: 'insensitive' as const } },
      )
    }

    whereConditions.AND.push({ OR: allSearchConditions })
  }

  // Add filters
  if (filters?.subjects && filters.subjects.length > 0) {
    whereConditions.AND.push({ subjects: { hasSome: filters.subjects } })
  }
  if (filters?.skillLevel) {
    whereConditions.AND.push({ skillLevel: filters.skillLevel as unknown as undefined })
  }
  if (filters?.studyStyle) {
    whereConditions.AND.push({ studyStyle: filters.studyStyle as unknown as undefined })
  }
  if (filters?.interests && filters.interests.length > 0) {
    whereConditions.AND.push({ interests: { hasSome: filters.interests } })
  }
  if (filters?.goals && filters.goals.length > 0) {
    whereConditions.AND.push({ goals: { hasSome: filters.goals } })
  }
  if (filters?.ageMin) {
    whereConditions.AND.push({ age: { gte: filters.ageMin } })
  }
  if (filters?.ageMax) {
    whereConditions.AND.push({ age: { lte: filters.ageMax } })
  }

  // Execute queries in parallel (no N+1!)
  // For array field searches, we use a separate raw SQL query since Prisma doesn't support
  // substring search within array elements
  const [textMatchProfiles, arrayMatchProfileIds] = await Promise.all([
    // Standard text field search
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
        // Additional fields for consistent match scoring
        location_lat: true,
        location_lng: true,
        availableDays: true,
        availableHours: true,
        timezone: true,
        role: true,
        aboutYourself: true,
        subjectCustomDescription: true,
        skillLevelCustomDescription: true,
        studyStyleCustomDescription: true,
        interestsCustomDescription: true,
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            lastLoginAt: true
          }
        }
      },
      take: limit * 3, // Fetch extra for scoring
      orderBy: { updatedAt: 'desc' }
    }),
    // Raw SQL for array field substring search
    // This finds profiles where any subject/interest contains the search term
    (async () => {
      if (uniqueTerms.length === 0) return []

      try {
        // Use Prisma.sql for proper parameter interpolation
        const { Prisma } = await import('@prisma/client')

        // Build LIKE patterns for each term (limit to first 10 to avoid huge queries)
        // For "math", this creates patterns like ['%math%', '%mathematics%', '%algebra%']
        const patterns = uniqueTerms.slice(0, 10).map(t => `%${t.toLowerCase()}%`)

        // Build the query based on whether we have exclude IDs
        let results: Array<{ id: string }>

        if (excludeUserIds.length > 0) {
          results = await prisma.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
              SELECT DISTINCT p.id
              FROM "Profile" p
              WHERE p."userId" != ${excludeUserId}
              AND p."userId" NOT IN (${Prisma.join(excludeUserIds)})
              AND (
                LOWER(array_to_string(p.subjects, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
                OR LOWER(array_to_string(p.interests, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
                OR LOWER(array_to_string(p.goals, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
              )
              LIMIT ${limit * 3}
            `
          )
        } else {
          results = await prisma.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
              SELECT DISTINCT p.id
              FROM "Profile" p
              WHERE p."userId" != ${excludeUserId}
              AND (
                LOWER(array_to_string(p.subjects, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
                OR LOWER(array_to_string(p.interests, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
                OR LOWER(array_to_string(p.goals, ' ')) LIKE ANY(ARRAY[${Prisma.join(patterns)}]::text[])
              )
              LIMIT ${limit * 3}
            `
          )
        }

        return results.map(r => r.id)
      } catch (error) {
        logger.warn('Array search query failed, skipping', { error })
        return []
      }
    })()
  ])

  // Fetch full profile data for array-matched profiles that weren't in text matches
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
        skillLevelCustomDescription: true,
        studyStyleCustomDescription: true,
        interestsCustomDescription: true,
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

  // Combine all profiles
  const profiles = [...textMatchProfiles, ...additionalProfiles]
  const total = profiles.length

  // Calculate relevance scores
  const scoredResults: PartnerSearchResult[] = profiles.map(profile => {
    const textScore = calculateRelevanceScore(query, {
      name: profile.user.name,
      description: profile.bio,
      subject: profile.subjects?.[0],
      subjectCustomDescription: profile.subjectCustomDescription,
      skillLevel: profile.skillLevel?.toString(),
      skillLevelCustomDescription: profile.skillLevelCustomDescription,
    }) / 100

    return {
      id: profile.id,
      userId: profile.userId,
      similarity: textScore, // Use text score as similarity in fallback
      hybridScore: textScore,
      textScore,
      profile: {
        ...profile,
        skillLevel: profile.skillLevel?.toString() || null,
        studyStyle: profile.studyStyle?.toString() || null,
      }
    }
  })

  // Sort by score and paginate
  scoredResults.sort((a, b) => b.hybridScore - a.hybridScore)
  const paginatedResults = scoredResults.slice(offset, offset + limit)

  return {
    results: paginatedResults,
    total,
    searchMetadata: {
      originalQuery: query,
      expandedQuery,
      usedVectorSearch: false,
      tokensUsed: 0
    }
  }
}

// ============================================
// Group Semantic Search
// ============================================

/**
 * Search for groups using semantic understanding
 */
export async function searchGroupsSmartly(
  params: GroupSearchParams
): Promise<{
  results: GroupSearchResult[]
  total: number
  searchMetadata: {
    originalQuery: string
    expandedQuery: string
    usedVectorSearch: boolean
    tokensUsed: number
  }
}> {
  const { query, filters, excludeGroupIds = [], limit = 20, offset = 0 } = params

  // Check cache first
  const cacheKey = getCacheKey('groups', params)
  const cached = getFromCache<{
    results: GroupSearchResult[]
    total: number
    searchMetadata: { originalQuery: string; expandedQuery: string; usedVectorSearch: boolean; tokensUsed: number }
  }>(cacheKey)

  if (cached) {
    logger.debug('Group search cache hit', { query })
    return cached
  }

  // Normalize and expand query
  const normalizedQuery = normalizeText(query)
  const expandedQuery = expandQueryForEmbedding(query)

  logger.debug('Group search', { originalQuery: query, expandedQuery })

  let usedVectorSearch = false
  let tokensUsed = 0
  let vectorResults: Array<{
    id: string
    similarity: number
    owner_id: string
  }> = []

  // Try vector search first
  try {
    const { embedding, tokensUsed: tokens } = await generateEmbedding(
      expandedQuery,
      'group-search:global'
    )
    tokensUsed = tokens

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase.rpc('search_groups_semantic', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: MIN_SIMILARITY_THRESHOLD,
      match_count: (limit + offset) * 3,
      filter_privacy: filters?.privacy || 'PUBLIC',
      filter_skill_level: filters?.skillLevel || null,
      filter_subject: filters?.subject || null,
      exclude_group_ids: excludeGroupIds.length > 0 ? excludeGroupIds : null
    })

    if (error) {
      logger.warn('Vector group search failed, falling back to text search', { error: error.message })
    } else if (data && data.length > 0) {
      vectorResults = data
      usedVectorSearch = true
    }
  } catch (error) {
    logger.warn('Vector group search error, falling back to text search', { error })
  }

  // If vector search failed, use text search
  if (!usedVectorSearch || vectorResults.length === 0) {
    return searchGroupsFallback(params, expandedQuery)
  }

  // Batch fetch full group data (NO N+1!)
  const groupIds = vectorResults.map(r => r.id)

  const groups = await prisma.group.findMany({
    where: {
      id: { in: groupIds },
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      description: true,
      subject: true,
      subjectCustomDescription: true,
      skillLevel: true,
      skillLevelCustomDescription: true,
      maxMembers: true,
      ownerId: true,
      privacy: true,
      createdAt: true,
      members: {
        select: {
          userId: true,
          role: true
        }
      }
    }
  })

  // Batch fetch owner names (NO N+1!)
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true }
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name || 'Unknown']))

  // Create lookup map
  const groupMap = new Map(groups.map(g => [g.id, g]))

  // Build results with scores
  const mappedResults = vectorResults.map(vr => {
    const group = groupMap.get(vr.id)
    if (!group) return null

    // Calculate text score
    const textScore = calculateRelevanceScore(normalizedQuery, {
      name: group.name,
      description: group.description,
      subject: group.subject,
      subjectCustomDescription: group.subjectCustomDescription,
      skillLevel: group.skillLevel,
      skillLevelCustomDescription: group.skillLevelCustomDescription,
    }) / 100

    const hybridScore = (vr.similarity * VECTOR_WEIGHT) + (textScore * TEXT_WEIGHT)

    const result: GroupSearchResult = {
      id: group.id,
      similarity: vr.similarity,
      hybridScore,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        subject: group.subject,
        subjectCustomDescription: group.subjectCustomDescription,
        skillLevel: group.skillLevel,
        skillLevelCustomDescription: group.skillLevelCustomDescription,
        maxMembers: group.maxMembers,
        memberCount: group.members.length,
        ownerId: group.ownerId,
        ownerName: ownerMap.get(group.ownerId) || 'Unknown',
        privacy: group.privacy,
        createdAt: group.createdAt,
        isMember: false, // Will be set by caller
        isOwner: false // Will be set by caller
      }
    }
    return result
  })

  const results: GroupSearchResult[] = mappedResults
    .filter((r): r is GroupSearchResult => r !== null)
    .sort((a, b) => b.hybridScore - a.hybridScore)

  // Apply pagination
  const paginatedResults = results.slice(offset, offset + limit)

  const response = {
    results: paginatedResults,
    total: results.length,
    searchMetadata: {
      originalQuery: query,
      expandedQuery,
      usedVectorSearch,
      tokensUsed
    }
  }

  // Cache the results
  setCache(cacheKey, response)

  return response
}

/**
 * Fallback to text-based group search
 */
async function searchGroupsFallback(
  params: GroupSearchParams,
  expandedQuery: string
): Promise<{
  results: GroupSearchResult[]
  total: number
  searchMetadata: {
    originalQuery: string
    expandedQuery: string
    usedVectorSearch: boolean
    tokensUsed: number
  }
}> {
  const { query, filters, excludeGroupIds = [], limit = 20, offset = 0 } = params

  const searchTerms = expandedQuery.split(/\s+/).filter(t => t.length > 1)
  const uniqueTerms = [...new Set(searchTerms)].slice(0, 15)

  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { privacy: filters?.privacy || 'PUBLIC' },
      { isDeleted: false },
      ...(excludeGroupIds.length > 0 ? [{ id: { notIn: excludeGroupIds } }] : [])
    ]
  }

  // Text search conditions
  if (uniqueTerms.length > 0) {
    const searchConditions = uniqueTerms.map(term => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { subject: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { skillLevelCustomDescription: { contains: term, mode: 'insensitive' as const } },
      ]
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  // Filters
  if (filters?.skillLevel) {
    whereConditions.AND.push({ skillLevel: filters.skillLevel })
  }

  // Execute queries in parallel (NO N+1!)
  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        description: true,
        subject: true,
        subjectCustomDescription: true,
        skillLevel: true,
        skillLevelCustomDescription: true,
        maxMembers: true,
        ownerId: true,
        privacy: true,
        createdAt: true,
        members: {
          select: {
            userId: true,
            role: true
          }
        }
      },
      take: limit * 3,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.group.count({ where: whereConditions })
  ])

  // Batch fetch owner names (NO N+1!)
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true }
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name || 'Unknown']))

  // Calculate scores
  const scoredResults: GroupSearchResult[] = groups.map(group => {
    const textScore = calculateRelevanceScore(query, {
      name: group.name,
      description: group.description,
      subject: group.subject,
      subjectCustomDescription: group.subjectCustomDescription,
      skillLevel: group.skillLevel,
      skillLevelCustomDescription: group.skillLevelCustomDescription,
    }) / 100

    return {
      id: group.id,
      similarity: textScore,
      hybridScore: textScore,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        subject: group.subject,
        subjectCustomDescription: group.subjectCustomDescription,
        skillLevel: group.skillLevel,
        skillLevelCustomDescription: group.skillLevelCustomDescription,
        maxMembers: group.maxMembers,
        memberCount: group.members.length,
        ownerId: group.ownerId,
        ownerName: ownerMap.get(group.ownerId) || 'Unknown',
        privacy: group.privacy,
        createdAt: group.createdAt,
        isMember: false,
        isOwner: false
      }
    }
  })

  // Sort and paginate
  scoredResults.sort((a, b) => b.hybridScore - a.hybridScore)
  const paginatedResults = scoredResults.slice(offset, offset + limit)

  return {
    results: paginatedResults,
    total,
    searchMetadata: {
      originalQuery: query,
      expandedQuery,
      usedVectorSearch: false,
      tokensUsed: 0
    }
  }
}

// ============================================
// Embedding Management
// ============================================

/**
 * Generate and store embedding for a profile
 */
export async function generateProfileEmbedding(profileId: string): Promise<boolean> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        bio: true,
        school: true,
        languages: true,
        subjects: true,
        interests: true,
        goals: true,
        skillLevel: true,
        studyStyle: true,
        aboutYourself: true,
        subjectCustomDescription: true,
        skillLevelCustomDescription: true,
        studyStyleCustomDescription: true,
        interestsCustomDescription: true,
        location_city: true,
        location_state: true,
        location_country: true,
        user: {
          select: { name: true }
        }
      }
    })

    if (!profile) {
      logger.warn('Profile not found for embedding generation', { profileId })
      return false
    }

    // Build comprehensive search text
    const searchText = buildProfileSearchText({
      bio: profile.bio,
      subjects: profile.subjects,
      interests: profile.interests,
      goals: profile.goals,
      skillLevel: profile.skillLevel?.toString() || null,
      studyStyle: profile.studyStyle?.toString() || null,
      subjectCustomDescription: profile.subjectCustomDescription,
      skillLevelCustomDescription: profile.skillLevelCustomDescription,
      studyStyleCustomDescription: profile.studyStyleCustomDescription,
      interestsCustomDescription: profile.interestsCustomDescription,
      aboutYourself: profile.aboutYourself,
    })

    if (!searchText || searchText.length < 10) {
      logger.debug('Profile has insufficient data for embedding', { profileId })
      return false
    }

    // Generate embedding
    const { embedding } = await generateEmbedding(searchText, `profile:${profileId}`)

    // Store embedding using raw SQL (Prisma doesn't support vector type)
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('Profile')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', profileId)

    if (error) {
      logger.error('Failed to store profile embedding', { profileId, error: error.message })
      return false
    }

    logger.debug('Profile embedding generated successfully', { profileId })
    return true
  } catch (error) {
    logger.error('Error generating profile embedding', { profileId, error })
    return false
  }
}

/**
 * Generate and store embedding for a group
 */
export async function generateGroupEmbedding(groupId: string): Promise<boolean> {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        subject: true,
        subjectCustomDescription: true,
        skillLevel: true,
        skillLevelCustomDescription: true,
      }
    })

    if (!group) {
      logger.warn('Group not found for embedding generation', { groupId })
      return false
    }

    // Build search text
    const searchText = buildGroupSearchText(group)

    if (!searchText || searchText.length < 5) {
      logger.debug('Group has insufficient data for embedding', { groupId })
      return false
    }

    // Generate embedding
    const { embedding } = await generateEmbedding(searchText, `group:${groupId}`)

    // Store embedding
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('Group')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', groupId)

    if (error) {
      logger.error('Failed to store group embedding', { groupId, error: error.message })
      return false
    }

    logger.debug('Group embedding generated successfully', { groupId })
    return true
  } catch (error) {
    logger.error('Error generating group embedding', { groupId, error })
    return false
  }
}

/**
 * Batch generate embeddings for multiple profiles
 * Used for backfilling existing data
 */
export async function batchGenerateProfileEmbeddings(
  profileIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < profileIds.length; i += batchSize) {
    const batch = profileIds.slice(i, i + batchSize)

    const results = await Promise.allSettled(
      batch.map(id => generateProfileEmbedding(id))
    )

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        success++
      } else {
        failed++
      }
    })

    onProgress?.(i + batch.length, profileIds.length)

    // Small delay between batches to respect rate limits
    if (i + batchSize < profileIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return { success, failed }
}

/**
 * Batch generate embeddings for multiple groups
 */
export async function batchGenerateGroupEmbeddings(
  groupIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  const batchSize = 5
  for (let i = 0; i < groupIds.length; i += batchSize) {
    const batch = groupIds.slice(i, i + batchSize)

    const results = await Promise.allSettled(
      batch.map(id => generateGroupEmbedding(id))
    )

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        success++
      } else {
        failed++
      }
    })

    onProgress?.(i + batch.length, groupIds.length)

    if (i + batchSize < groupIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return { success, failed }
}

// ============================================
// Export
// ============================================

export default {
  searchPartnersSmartly,
  searchGroupsSmartly,
  generateProfileEmbedding,
  generateGroupEmbedding,
  batchGenerateProfileEmbeddings,
  batchGenerateGroupEmbeddings,
}
