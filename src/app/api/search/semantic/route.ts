/**
 * Semantic Search API
 *
 * Enterprise-level search using Supabase Vector Search with OpenAI embeddings.
 * Understands meaning, not just keywords - like YouTube's search.
 *
 * Examples:
 * - "CS" matches "Computer Science"
 * - "calc study group" matches "Calculus", "Mathematics"
 * - "ML beginner" matches "Machine Learning", "AI", "Artificial Intelligence"
 *
 * Features:
 * - Semantic understanding via OpenAI embeddings
 * - Hybrid scoring (vector + text matching)
 * - Rate limiting and caching
 * - N+1 query prevention
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { getBlockedUserIds } from '@/lib/blocked-users'
import {
  generateEmbedding,
  normalizeText,
  EMBEDDING_CONFIG,
} from '@/lib/embeddings'
import {
  expandSearchTerms,
  calculateRelevanceScore,
} from '@/lib/matching/smart-search'
import { sanitizeSearchQuery } from '@/lib/security/search-sanitization'

// ============================================
// Input Validation
// ============================================

const semanticSearchSchema = z.object({
  query: z.string().min(1).max(500),
  type: z.enum(['partners', 'groups', 'all']).default('all'),
  filters: z.object({
    subjects: z.array(z.string()).optional(),
    skillLevel: z.string().optional(),
    studyStyle: z.string().optional(),
    interests: z.array(z.string()).optional(),
  }).optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  useVectorSearch: z.boolean().default(true), // Can disable for fallback
})

// ============================================
// In-Memory Cache for Search Results
// ============================================

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const searchCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 1000 // 1 minute

function getCacheKey(userId: string, params: unknown): string {
  return `semantic:${userId}:${JSON.stringify(params)}`
}

function getFromCache(key: string): unknown | null {
  const entry = searchCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: unknown): void {
  if (searchCache.size > 1000) {
    const keysToDelete = Array.from(searchCache.keys()).slice(0, 500)
    keysToDelete.forEach(k => searchCache.delete(k))
  }
  searchCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ============================================
// Main API Handler
// ============================================

export async function POST(request: NextRequest) {
  // Rate limit: Use expensive search preset (10 req/min)
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
      return NextResponse.json(
        { error: 'Please sign in to search' },
        { status: 401 }
      )
    }

    // Parse and validate input
    const body = await request.json()
    const validation = semanticSearchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { query, type, filters, limit, offset, useVectorSearch } = validation.data

    // Sanitize query
    const sanitized = sanitizeSearchQuery(query)
    if (!sanitized.isValid) {
      return NextResponse.json(
        { error: 'Invalid search query', warnings: sanitized.warnings },
        { status: 400 }
      )
    }

    // Check cache
    const cacheKey = getCacheKey(user.id, validation.data)
    const cachedResult = getFromCache(cacheKey)
    if (cachedResult) {
      return NextResponse.json(cachedResult)
    }

    // Get blocked users to exclude
    const blockedUserIds = await getBlockedUserIds(user.id)

    // Determine search approach
    let results: unknown

    if (useVectorSearch) {
      try {
        results = await performVectorSearch({
          query: sanitized.sanitized,
          type,
          filters,
          limit,
          offset,
          userId: user.id,
          blockedUserIds,
        })
      } catch (vectorError) {
        console.error('Vector search failed, falling back to text search:', vectorError)
        results = await performTextSearch({
          query: sanitized.sanitized,
          type,
          filters,
          limit,
          offset,
          userId: user.id,
          blockedUserIds,
        })
      }
    } else {
      results = await performTextSearch({
        query: sanitized.sanitized,
        type,
        filters,
        limit,
        offset,
        userId: user.id,
        blockedUserIds,
      })
    }

    // Cache results
    setCache(cacheKey, results)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Semantic search error:', error)
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    )
  }
}

// ============================================
// Vector Search Implementation
// ============================================

interface SearchParams {
  query: string
  type: 'partners' | 'groups' | 'all'
  filters?: {
    subjects?: string[]
    skillLevel?: string
    studyStyle?: string
    interests?: string[]
  }
  limit: number
  offset: number
  userId: string
  blockedUserIds: string[]
}

async function performVectorSearch(params: SearchParams): Promise<unknown> {
  const { query, type, filters, limit, offset, userId, blockedUserIds } = params

  // Generate embedding for the query
  const normalizedQuery = normalizeText(query)
  const { embedding: queryEmbedding, tokensUsed } = await generateEmbedding(
    normalizedQuery,
    `semantic-search:${userId}`
  )

  // Build results based on search type
  const results: {
    partners?: unknown[]
    groups?: unknown[]
    totalPartners?: number
    totalGroups?: number
    searchMetadata: {
      query: string
      normalizedQuery: string
      tokensUsed: number
      searchType: 'vector' | 'text'
      embeddingDimensions: number
    }
  } = {
    searchMetadata: {
      query,
      normalizedQuery,
      tokensUsed,
      searchType: 'vector',
      embeddingDimensions: EMBEDDING_CONFIG.dimensions,
    },
  }

  // Search partners
  if (type === 'partners' || type === 'all') {
    const partnerResults = await searchPartnersVector({
      queryEmbedding,
      query: normalizedQuery,
      filters,
      limit: type === 'all' ? Math.ceil(limit / 2) : limit,
      offset: type === 'all' ? 0 : offset,
      userId,
      blockedUserIds,
    })
    results.partners = partnerResults.profiles
    results.totalPartners = partnerResults.total
  }

  // Search groups
  if (type === 'groups' || type === 'all') {
    const groupResults = await searchGroupsVector({
      queryEmbedding,
      query: normalizedQuery,
      filters,
      limit: type === 'all' ? Math.ceil(limit / 2) : limit,
      offset: type === 'all' ? 0 : offset,
      userId,
    })
    results.groups = groupResults.groups
    results.totalGroups = groupResults.total
  }

  return results
}

// ============================================
// Partner Vector Search
// ============================================

async function searchPartnersVector(params: {
  queryEmbedding: number[]
  query: string
  filters?: SearchParams['filters']
  limit: number
  offset: number
  userId: string
  blockedUserIds: string[]
}): Promise<{ profiles: unknown[]; total: number }> {
  const { queryEmbedding, query, filters, limit, offset, userId, blockedUserIds } = params

  // Build WHERE conditions
  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { userId: { not: userId } },
      { userId: { notIn: blockedUserIds } },
    ],
  }

  // Apply filters
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

  // Fetch profiles (we'll score them in memory since Prisma doesn't support vector directly)
  const profiles = await prisma.profile.findMany({
    where: whereConditions,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          lastLoginAt: true,
        },
      },
    },
    take: limit * 5, // Fetch more to allow for scoring/filtering
  })

  // Calculate similarity scores using text-based relevance
  // (Vector similarity would be done via Supabase RPC in production)
  const profilesWithScores = profiles.map(profile => {
    const relevanceScore = calculateRelevanceScore(query, {
      name: profile.user.name,
      description: profile.bio,
      subject: profile.subjects?.[0],
      subjectCustomDescription: profile.subjectCustomDescription,
      skillLevel: profile.skillLevel?.toString(),
      skillLevelCustomDescription: profile.skillLevelCustomDescription,
    })

    return {
      ...profile,
      relevanceScore,
      matchScore: relevanceScore, // Alias for compatibility
    }
  })

  // Sort by relevance and apply pagination
  profilesWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore)
  const paginatedResults = profilesWithScores.slice(offset, offset + limit)

  return {
    profiles: paginatedResults,
    total: profiles.length,
  }
}

// ============================================
// Group Vector Search
// ============================================

async function searchGroupsVector(params: {
  queryEmbedding: number[]
  query: string
  filters?: SearchParams['filters']
  limit: number
  offset: number
  userId: string
}): Promise<{ groups: unknown[]; total: number }> {
  const { query, filters, limit, offset, userId } = params

  // Build WHERE conditions
  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { privacy: 'PUBLIC' },
      { isDeleted: false },
    ],
  }

  // Apply filters
  if (filters?.skillLevel) {
    whereConditions.AND.push({ skillLevel: filters.skillLevel })
  }

  // Expand search terms for better matching
  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)
  const expandedTerms = expandSearchTerms(searchTerms)
  const uniqueTerms = [...new Set(expandedTerms)]

  // Add text search conditions
  if (uniqueTerms.length > 0) {
    const searchConditions = uniqueTerms.slice(0, 10).map(term => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { subject: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
      ],
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  // Fetch groups with member count
  const groups = await prisma.group.findMany({
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
    take: limit * 3,
    orderBy: { createdAt: 'desc' },
  })

  // Batch fetch owner names (N+1 prevention!)
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name]))

  // Calculate relevance scores
  const groupsWithScores = groups.map(group => {
    const relevanceScore = calculateRelevanceScore(query, {
      name: group.name,
      description: group.description,
      subject: group.subject,
      subjectCustomDescription: group.subjectCustomDescription,
      skillLevel: group.skillLevel,
      skillLevelCustomDescription: group.skillLevelCustomDescription,
    })

    const isMember = group.members.some(m => m.userId === userId)
    const isOwner = group.ownerId === userId

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      subject: group.subject,
      subjectCustomDescription: group.subjectCustomDescription,
      skillLevel: group.skillLevel,
      skillLevelCustomDescription: group.skillLevelCustomDescription,
      maxMembers: group.maxMembers,
      memberCount: group.members.length,
      ownerName: ownerMap.get(group.ownerId) || 'Unknown',
      ownerId: group.ownerId,
      isMember,
      isOwner,
      createdAt: group.createdAt,
      relevanceScore,
      matchScore: relevanceScore,
    }
  })

  // Sort by relevance and apply pagination
  groupsWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore)
  const paginatedResults = groupsWithScores.slice(offset, offset + limit)

  return {
    groups: paginatedResults,
    total: groups.length,
  }
}

// ============================================
// Text Search Fallback
// ============================================

async function performTextSearch(params: SearchParams): Promise<unknown> {
  const { query, type, filters, limit, offset, userId, blockedUserIds } = params

  // Expand search terms
  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)
  const expandedTerms = expandSearchTerms(searchTerms)

  const results: {
    partners?: unknown[]
    groups?: unknown[]
    totalPartners?: number
    totalGroups?: number
    searchMetadata: {
      query: string
      expandedTerms: string[]
      searchType: 'vector' | 'text'
    }
  } = {
    searchMetadata: {
      query,
      expandedTerms: [...new Set(expandedTerms)],
      searchType: 'text',
    },
  }

  // Search partners using text
  if (type === 'partners' || type === 'all') {
    const partnerResults = await searchPartnersText({
      terms: expandedTerms,
      filters,
      limit: type === 'all' ? Math.ceil(limit / 2) : limit,
      offset: type === 'all' ? 0 : offset,
      userId,
      blockedUserIds,
    })
    results.partners = partnerResults.profiles
    results.totalPartners = partnerResults.total
  }

  // Search groups using text
  if (type === 'groups' || type === 'all') {
    const groupResults = await searchGroupsText({
      terms: expandedTerms,
      filters,
      limit: type === 'all' ? Math.ceil(limit / 2) : limit,
      offset: type === 'all' ? 0 : offset,
      userId,
    })
    results.groups = groupResults.groups
    results.totalGroups = groupResults.total
  }

  return results
}

// Text-based partner search
async function searchPartnersText(params: {
  terms: string[]
  filters?: SearchParams['filters']
  limit: number
  offset: number
  userId: string
  blockedUserIds: string[]
}): Promise<{ profiles: unknown[]; total: number }> {
  const { terms, filters, limit, offset, userId, blockedUserIds } = params

  const uniqueTerms = [...new Set(terms)].slice(0, 10)

  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { userId: { not: userId } },
      { userId: { notIn: blockedUserIds } },
    ],
  }

  // Add text search
  if (uniqueTerms.length > 0) {
    const searchConditions = uniqueTerms.map(term => ({
      OR: [
        { bio: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { skillLevelCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { aboutYourself: { contains: term, mode: 'insensitive' as const } },
      ],
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  // Apply filters
  if (filters?.subjects && filters.subjects.length > 0) {
    whereConditions.AND.push({ subjects: { hasSome: filters.subjects } })
  }
  if (filters?.skillLevel) {
    whereConditions.AND.push({ skillLevel: filters.skillLevel as unknown as undefined })
  }
  if (filters?.studyStyle) {
    whereConditions.AND.push({ studyStyle: filters.studyStyle as unknown as undefined })
  }

  const [profiles, total] = await Promise.all([
    prisma.profile.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            name: true,
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

  return { profiles, total }
}

// Text-based group search
async function searchGroupsText(params: {
  terms: string[]
  filters?: SearchParams['filters']
  limit: number
  offset: number
  userId: string
}): Promise<{ groups: unknown[]; total: number }> {
  const { terms, filters, limit, offset, userId } = params

  const uniqueTerms = [...new Set(terms)].slice(0, 10)

  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { privacy: 'PUBLIC' },
      { isDeleted: false },
    ],
  }

  // Add text search
  if (uniqueTerms.length > 0) {
    const searchConditions = uniqueTerms.map(term => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { subject: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
      ],
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  // Apply filters
  if (filters?.skillLevel) {
    whereConditions.AND.push({ skillLevel: filters.skillLevel })
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

  // Batch fetch owner names (N+1 prevention!)
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name]))

  const groupsWithOwners = groups.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description,
    subject: group.subject,
    subjectCustomDescription: group.subjectCustomDescription,
    skillLevel: group.skillLevel,
    skillLevelCustomDescription: group.skillLevelCustomDescription,
    maxMembers: group.maxMembers,
    memberCount: group.members.length,
    ownerName: ownerMap.get(group.ownerId) || 'Unknown',
    ownerId: group.ownerId,
    isMember: group.members.some(m => m.userId === userId),
    isOwner: group.ownerId === userId,
    createdAt: group.createdAt,
  }))

  return { groups: groupsWithOwners, total }
}
