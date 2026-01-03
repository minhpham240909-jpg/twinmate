/**
 * Hybrid Search Service
 *
 * Combines vector semantic search with traditional filters for
 * enterprise-level search that understands meaning, not just keywords.
 *
 * Features:
 * - Semantic understanding via OpenAI embeddings
 * - Hybrid scoring (vector similarity + text matching)
 * - Filter integration (skill level, subjects, location, etc.)
 * - Result caching for performance
 * - N+1 query prevention with batch fetching
 */

import { prisma } from '@/lib/prisma'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  generateEmbedding,
  buildProfileSearchText,
  buildGroupSearchText,
  normalizeText,
  cosineSimilarity,
  EMBEDDING_CONFIG,
} from './openai-embeddings'

// ============================================
// Configuration
// ============================================

const HYBRID_SEARCH_CACHE_TTL = 60 * 1000 // 1 minute cache for search results
const MIN_SIMILARITY_THRESHOLD = 0.5 // Minimum similarity score (0-1)
const VECTOR_WEIGHT = 0.7 // Weight for vector similarity (0-1)
const TEXT_WEIGHT = 0.3 // Weight for text matching (0-1)

// ============================================
// Types
// ============================================

export interface PartnerSearchParams {
  query: string
  subjects?: string[]
  skillLevel?: string
  studyStyle?: string
  interests?: string[]
  location?: string
  excludeUserId: string
  limit?: number
  offset?: number
}

export interface GroupSearchParams {
  query: string
  subject?: string
  skillLevel?: string
  privacy?: string
  excludeGroupIds?: string[]
  limit?: number
  offset?: number
}

export interface SearchResult {
  id: string
  userId?: string
  similarity: number
  textScore: number
  hybridScore: number
}

// ============================================
// In-Memory Search Cache
// ============================================

interface SearchCacheEntry {
  results: SearchResult[]
  expiresAt: number
}

const searchCache = new Map<string, SearchCacheEntry>()

function getSearchCacheKey(type: string, params: unknown): string {
  return `search:${type}:${JSON.stringify(params)}`
}

function getFromSearchCache(key: string): SearchResult[] | null {
  const entry = searchCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key)
    return null
  }
  return entry.results
}

function setSearchCache(key: string, results: SearchResult[]): void {
  // Limit cache size
  if (searchCache.size > 1000) {
    const keysToDelete = Array.from(searchCache.keys()).slice(0, 500)
    keysToDelete.forEach(k => searchCache.delete(k))
  }

  searchCache.set(key, {
    results,
    expiresAt: Date.now() + HYBRID_SEARCH_CACHE_TTL,
  })
}

// ============================================
// Supabase Client for RPC Calls
// ============================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase URL or Service Role Key not configured')
  }

  return createSupabaseClient(url, key)
}

// ============================================
// Hybrid Partner Search
// ============================================

/**
 * Search for study partners using hybrid semantic + text search
 *
 * Algorithm:
 * 1. Generate embedding for search query
 * 2. Use Supabase RPC to find similar profiles (vector search)
 * 3. Apply additional text matching for hybrid scoring
 * 4. Combine scores with weights
 * 5. Fetch full profile data in ONE batch query (no N+1!)
 */
export async function searchPartnersHybrid(
  params: PartnerSearchParams
): Promise<{
  results: Array<{
    profile: unknown
    similarity: number
    hybridScore: number
  }>
  totalCount: number
}> {
  const { query, excludeUserId, limit = 20, offset = 0 } = params

  // Check cache first
  const cacheKey = getSearchCacheKey('partners', params)
  const cachedResults = getFromSearchCache(cacheKey)

  if (cachedResults && cachedResults.length > 0) {
    // Fetch profile data for cached results
    const profileIds = cachedResults.map(r => r.id)
    const profiles = await fetchProfilesBatch(profileIds)

    return {
      results: cachedResults.map(r => ({
        profile: profiles.get(r.id) || null,
        similarity: r.similarity,
        hybridScore: r.hybridScore,
      })).filter(r => r.profile !== null),
      totalCount: cachedResults.length,
    }
  }

  // Normalize query
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return { results: [], totalCount: 0 }
  }

  try {
    // Step 1: Generate embedding for the query
    const { embedding: queryEmbedding } = await generateEmbedding(
      normalizedQuery,
      `partner-search:${excludeUserId}`
    )

    // Step 2: Vector search using Supabase RPC
    const supabase = getSupabaseClient()

    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'search_profiles_semantic',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: MIN_SIMILARITY_THRESHOLD,
        match_count: limit + offset + 50, // Fetch extra for filtering
        filter_subjects: params.subjects || null,
        filter_skill_level: params.skillLevel || null,
        filter_study_style: params.studyStyle || null,
        exclude_user_id: excludeUserId,
      }
    )

    if (vectorError) {
      console.error('Vector search error:', vectorError)
      // Fallback to text-only search
      return searchPartnersFallback(params)
    }

    // Step 3: Calculate hybrid scores
    const searchResults: SearchResult[] = (vectorResults || []).map((result: {
      id: string
      user_id: string
      similarity: number
    }) => {
      const vectorScore = result.similarity
      const textScore = calculateTextScore(normalizedQuery, result.id)
      const hybridScore = (vectorScore * VECTOR_WEIGHT) + (textScore * TEXT_WEIGHT)

      return {
        id: result.id,
        userId: result.user_id,
        similarity: vectorScore,
        textScore,
        hybridScore,
      }
    })

    // Sort by hybrid score
    searchResults.sort((a, b) => b.hybridScore - a.hybridScore)

    // Apply pagination
    const paginatedResults = searchResults.slice(offset, offset + limit)

    // Cache the results
    setSearchCache(cacheKey, paginatedResults)

    // Step 4: Fetch full profile data in ONE batch query (no N+1!)
    const profileIds = paginatedResults.map(r => r.id)
    const profiles = await fetchProfilesBatch(profileIds)

    return {
      results: paginatedResults.map(r => ({
        profile: profiles.get(r.id) || null,
        similarity: r.similarity,
        hybridScore: r.hybridScore,
      })).filter(r => r.profile !== null),
      totalCount: searchResults.length,
    }
  } catch (error) {
    console.error('Hybrid search error:', error)
    // Fallback to text-only search
    return searchPartnersFallback(params)
  }
}

// ============================================
// Hybrid Group Search
// ============================================

/**
 * Search for study groups using hybrid semantic + text search
 */
export async function searchGroupsHybrid(
  params: GroupSearchParams
): Promise<{
  results: Array<{
    group: unknown
    similarity: number
    hybridScore: number
  }>
  totalCount: number
}> {
  const { query, limit = 20, offset = 0 } = params

  // Check cache first
  const cacheKey = getSearchCacheKey('groups', params)
  const cachedResults = getFromSearchCache(cacheKey)

  if (cachedResults && cachedResults.length > 0) {
    const groupIds = cachedResults.map(r => r.id)
    const groups = await fetchGroupsBatch(groupIds)

    return {
      results: cachedResults.map(r => ({
        group: groups.get(r.id) || null,
        similarity: r.similarity,
        hybridScore: r.hybridScore,
      })).filter(r => r.group !== null),
      totalCount: cachedResults.length,
    }
  }

  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return { results: [], totalCount: 0 }
  }

  try {
    // Generate embedding
    const { embedding: queryEmbedding } = await generateEmbedding(
      normalizedQuery,
      'group-search:global'
    )

    // Vector search
    const supabase = getSupabaseClient()

    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'search_groups_semantic',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: MIN_SIMILARITY_THRESHOLD,
        match_count: limit + offset + 50,
        filter_privacy: params.privacy || 'PUBLIC',
        filter_skill_level: params.skillLevel || null,
        exclude_group_ids: params.excludeGroupIds || null,
      }
    )

    if (vectorError) {
      console.error('Vector search error:', vectorError)
      return searchGroupsFallback(params)
    }

    // Calculate hybrid scores
    const searchResults: SearchResult[] = (vectorResults || []).map((result: {
      id: string
      similarity: number
    }) => {
      const vectorScore = result.similarity
      const textScore = calculateTextScore(normalizedQuery, result.id)
      const hybridScore = (vectorScore * VECTOR_WEIGHT) + (textScore * TEXT_WEIGHT)

      return {
        id: result.id,
        similarity: vectorScore,
        textScore,
        hybridScore,
      }
    })

    searchResults.sort((a, b) => b.hybridScore - a.hybridScore)
    const paginatedResults = searchResults.slice(offset, offset + limit)

    setSearchCache(cacheKey, paginatedResults)

    // Batch fetch groups (no N+1!)
    const groupIds = paginatedResults.map(r => r.id)
    const groups = await fetchGroupsBatch(groupIds)

    return {
      results: paginatedResults.map(r => ({
        group: groups.get(r.id) || null,
        similarity: r.similarity,
        hybridScore: r.hybridScore,
      })).filter(r => r.group !== null),
      totalCount: searchResults.length,
    }
  } catch (error) {
    console.error('Hybrid group search error:', error)
    return searchGroupsFallback(params)
  }
}

// ============================================
// Batch Data Fetching (N+1 Prevention)
// ============================================

/**
 * Fetch multiple profiles in ONE query
 */
async function fetchProfilesBatch(profileIds: string[]): Promise<Map<string, unknown>> {
  if (profileIds.length === 0) return new Map()

  const profiles = await prisma.profile.findMany({
    where: {
      id: { in: profileIds },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          lastLoginAt: true,
        },
      },
    },
  })

  return new Map(profiles.map(p => [p.id, p]))
}

/**
 * Fetch multiple groups in ONE query
 */
async function fetchGroupsBatch(groupIds: string[]): Promise<Map<string, unknown>> {
  if (groupIds.length === 0) return new Map()

  const groups = await prisma.group.findMany({
    where: {
      id: { in: groupIds },
      isDeleted: false,
    },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  })

  // Also batch fetch owner info
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name]))

  return new Map(groups.map(g => [g.id, {
    ...g,
    ownerName: ownerMap.get(g.ownerId) || 'Unknown',
    memberCount: g.members.length,
  }]))
}

// ============================================
// Text Score Calculation
// ============================================

/**
 * Calculate text matching score (for hybrid search)
 * This is a simple implementation; in production, use fuzzy matching
 */
function calculateTextScore(query: string, _entityId: string): number {
  // For now, return a base score
  // In a full implementation, this would query the entity and compare text
  return 0.5
}

// ============================================
// Fallback Search (When Vector Search Fails)
// ============================================

async function searchPartnersFallback(
  params: PartnerSearchParams
): Promise<{
  results: Array<{
    profile: unknown
    similarity: number
    hybridScore: number
  }>
  totalCount: number
}> {
  const { query, excludeUserId, limit = 20, offset = 0 } = params

  // Use traditional text search
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)

  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { userId: { not: excludeUserId } },
    ],
  }

  // Add text search conditions
  if (queryTerms.length > 0) {
    const searchConditions = queryTerms.map(term => ({
      OR: [
        { bio: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { skillLevelCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { aboutYourself: { contains: term, mode: 'insensitive' as const } },
      ],
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  // Add filters
  if (params.skillLevel) {
    whereConditions.AND.push({ skillLevel: params.skillLevel as unknown as undefined })
  }
  if (params.studyStyle) {
    whereConditions.AND.push({ studyStyle: params.studyStyle as unknown as undefined })
  }
  if (params.subjects && params.subjects.length > 0) {
    whereConditions.AND.push({ subjects: { hasSome: params.subjects } })
  }

  const [profiles, total] = await Promise.all([
    prisma.profile.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.profile.count({ where: whereConditions }),
  ])

  return {
    results: profiles.map(p => ({
      profile: p,
      similarity: 0.5, // Default for text-only search
      hybridScore: 0.5,
    })),
    totalCount: total,
  }
}

async function searchGroupsFallback(
  params: GroupSearchParams
): Promise<{
  results: Array<{
    group: unknown
    similarity: number
    hybridScore: number
  }>
  totalCount: number
}> {
  const { query, limit = 20, offset = 0 } = params

  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)

  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { privacy: params.privacy || 'PUBLIC' },
      { isDeleted: false },
    ],
  }

  if (queryTerms.length > 0) {
    const searchConditions = queryTerms.map(term => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { subject: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
      ],
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  if (params.skillLevel) {
    whereConditions.AND.push({ skillLevel: params.skillLevel })
  }

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where: whereConditions,
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.group.count({ where: whereConditions }),
  ])

  // Batch fetch owners (no N+1!)
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name]))

  return {
    results: groups.map(g => ({
      group: {
        ...g,
        ownerName: ownerMap.get(g.ownerId) || 'Unknown',
        memberCount: g.members.length,
      },
      similarity: 0.5,
      hybridScore: 0.5,
    })),
    totalCount: total,
  }
}

// ============================================
// Embedding Management
// ============================================

/**
 * Update embedding for a profile (call after profile update)
 */
export async function updateProfileEmbedding(profileId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      bio: true,
      subjects: true,
      interests: true,
      goals: true,
      skillLevel: true,
      studyStyle: true,
      subjectCustomDescription: true,
      skillLevelCustomDescription: true,
      studyStyleCustomDescription: true,
      interestsCustomDescription: true,
      aboutYourself: true,
    },
  })

  if (!profile) return

  const searchText = buildProfileSearchText({
    ...profile,
    skillLevel: profile.skillLevel?.toString() || null,
    studyStyle: profile.studyStyle?.toString() || null,
  })

  if (!searchText) return

  try {
    const { embedding } = await generateEmbedding(
      searchText,
      `profile-update:${profileId}`
    )

    // Update embedding using raw SQL (Prisma doesn't support vector type directly)
    const supabase = getSupabaseClient()
    await supabase
      .from('Profile')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', profileId)
  } catch (error) {
    console.error(`Failed to update embedding for profile ${profileId}:`, error)
  }
}

/**
 * Update embedding for a group (call after group update)
 */
export async function updateGroupEmbedding(groupId: string): Promise<void> {
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
    },
  })

  if (!group) return

  const searchText = buildGroupSearchText(group)

  if (!searchText) return

  try {
    const { embedding } = await generateEmbedding(
      searchText,
      `group-update:${groupId}`
    )

    const supabase = getSupabaseClient()
    await supabase
      .from('Group')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', groupId)
  } catch (error) {
    console.error(`Failed to update embedding for group ${groupId}:`, error)
  }
}

// ============================================
// Export Config
// ============================================

export const HYBRID_SEARCH_CONFIG = {
  vectorWeight: VECTOR_WEIGHT,
  textWeight: TEXT_WEIGHT,
  minSimilarityThreshold: MIN_SIMILARITY_THRESHOLD,
  cacheTtlMs: HYBRID_SEARCH_CACHE_TTL,
  embeddingConfig: EMBEDDING_CONFIG,
}
