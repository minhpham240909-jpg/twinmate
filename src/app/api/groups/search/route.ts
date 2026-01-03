/**
 * Group Search API - Smart Semantic Search
 *
 * Enterprise-level search like YouTube:
 * - "CS" matches "Computer Science"
 * - "math" matches "Mathematics", "Calculus", "Algebra"
 * - "calc study" matches "Calculus Study Group"
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
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { searchGroupsSmartly } from '@/lib/search'
import { calculateRelevanceScore, expandSearchTerms } from '@/lib/matching/smart-search'

// ============================================
// In-Memory Cache
// ============================================

interface CacheEntry {
  data: unknown
  timestamp: number
}

const searchCache = new Map<string, CacheEntry>()
const CACHE_TTL = 30000 // 30 seconds

function getCacheKey(userId: string, params: Record<string, unknown>): string {
  return `group-search:${userId}:${JSON.stringify(params)}`
}

function getFromCache(key: string): unknown | null {
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  searchCache.delete(key)
  return null
}

function setCache(key: string, data: unknown): void {
  // LRU-like cache eviction
  if (searchCache.size > 1000) {
    const entries = Array.from(searchCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    entries.slice(0, 500).forEach(([k]) => searchCache.delete(k))
  }
  searchCache.set(key, { data, timestamp: Date.now() })
}

// ============================================
// Input Validation Schema
// ============================================

const searchSchema = z.object({
  subject: z.string().optional(),
  subjectCustomDescription: z.string().optional(),
  skillLevel: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  description: z.string().optional(),
  query: z.string().optional(), // General search query for smart matching
  useSemanticSearch: z.boolean().optional().default(true),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

// ============================================
// Main API Handler
// ============================================

export async function POST(request: NextRequest) {
  // Rate limit: 30 searches per minute
  const rateLimitResult = await rateLimit(request, {
    max: 30,
    windowMs: 60 * 1000,
    keyPrefix: 'group-search'
  })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many search requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    const {
      subject,
      subjectCustomDescription,
      skillLevel,
      skillLevelCustomDescription,
      description,
      query,
      useSemanticSearch,
      page,
      limit,
    } = validation.data

    // Check cache first
    const cacheKey = getCacheKey(user.id, validation.data)
    const cachedResult = getFromCache(cacheKey)
    if (cachedResult) {
      return NextResponse.json(cachedResult)
    }

    // Combine all search terms for smart matching
    const combinedQuery = [
      query,
      subject,
      subjectCustomDescription,
      skillLevelCustomDescription,
      description,
    ].filter(Boolean).join(' ').trim()

    // If no search query provided, return error
    if (!combinedQuery) {
      return NextResponse.json(
        { error: 'At least one search term is required' },
        { status: 400 }
      )
    }

    let groups: Array<{
      id: string
      name: string
      description: string | null
      subject: string | null
      subjectCustomDescription: string | null
      skillLevel: string | null
      skillLevelCustomDescription: string | null
      maxMembers: number
      memberCount: number
      ownerName: string
      ownerId: string
      isMember: boolean
      isOwner: boolean
      createdAt: Date
      matchScore: number
      similarity?: number
    }> = []
    let totalCount = 0
    let usedSemanticSearch = false

    // Try semantic search first if enabled
    if (useSemanticSearch && combinedQuery) {
      try {
        const semanticResults = await searchGroupsSmartly({
          query: combinedQuery,
          filters: {
            skillLevel,
            subject,
            privacy: 'PUBLIC',
          },
          limit: limit * 2, // Fetch extra for filtering
          offset: 0,
        })

        if (semanticResults.results.length > 0) {
          // Transform results and add user-specific data
          groups = semanticResults.results.map(result => ({
            ...result.group,
            matchScore: Math.round(result.hybridScore * 100),
            similarity: result.similarity,
            isMember: false, // Will be updated below
            isOwner: result.group.ownerId === user.id,
          }))
          totalCount = semanticResults.total
          usedSemanticSearch = semanticResults.searchMetadata.usedVectorSearch

          logger.debug('Semantic group search completed', {
            query: combinedQuery,
            resultsCount: groups.length,
            usedVectorSearch: usedSemanticSearch,
          })
        }
      } catch (error) {
        logger.warn('Semantic group search failed, falling back to traditional search', { error })
      }
    }

    // Fallback to traditional search if semantic search didn't return results
    if (groups.length === 0) {
      const traditionalResults = await performTraditionalSearch({
        combinedQuery,
        skillLevel,
        page,
        limit,
        userId: user.id,
      })
      groups = traditionalResults.groups
      totalCount = traditionalResults.total
    }

    // Batch check membership status (NO N+1!)
    if (groups.length > 0) {
      const groupIds = groups.map(g => g.id)
      const memberships = await prisma.groupMember.findMany({
        where: {
          userId: user.id,
          groupId: { in: groupIds }
        },
        select: {
          groupId: true
        }
      })

      const memberGroupIds = new Set(memberships.map(m => m.groupId))

      // Update membership status
      groups = groups.map(group => ({
        ...group,
        isMember: memberGroupIds.has(group.id),
        isOwner: group.ownerId === user.id,
      }))
    }

    // Sort by match score (highest first), then by creation date
    groups.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Apply pagination
    const skip = (page - 1) * limit
    const paginatedGroups = groups.slice(skip, skip + limit)

    const responseData = {
      success: true,
      groups: paginatedGroups,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      searchMetadata: {
        usedSemanticSearch,
        query: combinedQuery,
      }
    }

    // Cache the result
    setCache(cacheKey, responseData)

    return NextResponse.json(responseData)
  } catch (error) {
    logger.error('Group search error', { error })
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
  combinedQuery: string
  skillLevel?: string
  page: number
  limit: number
  userId: string
}

async function performTraditionalSearch(params: TraditionalSearchParams) {
  const { combinedQuery, skillLevel, page, limit, userId } = params

  // Expand search terms with synonyms
  const searchTerms = combinedQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0)
  const expandedTerms = expandSearchTerms(searchTerms)

  // Filter out common words and duplicates
  const uniqueTerms = [...new Set(expandedTerms)].filter(term =>
    term.length > 1 && !['the', 'a', 'an', 'and', 'or', 'is', 'in', 'to', 'for'].includes(term)
  ).slice(0, 15) // Limit terms for performance

  // Build WHERE conditions
  const whereConditions: { AND: Array<Record<string, unknown>> } = {
    AND: [
      { privacy: 'PUBLIC' },
      { isDeleted: false },
    ],
  }

  // Add text search conditions
  if (uniqueTerms.length > 0) {
    const searchConditions = uniqueTerms.map(term => ({
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { skillLevelCustomDescription: { contains: term, mode: 'insensitive' as const } },
        { subject: { contains: term, mode: 'insensitive' as const } },
        { skillLevel: { contains: term, mode: 'insensitive' as const } },
      ],
    }))

    whereConditions.AND.push({ OR: searchConditions })
  }

  // Filter by skill level if specified
  if (skillLevel && skillLevel !== '') {
    whereConditions.AND.push({ skillLevel })
  }

  // Pagination
  const skip = (page - 1) * limit

  // Execute queries in parallel (NO N+1!)
  const [groups, totalCount] = await Promise.all([
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
        createdAt: true,
        members: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit * 2, // Fetch extra for scoring
    }),
    prisma.group.count({ where: whereConditions }),
  ])

  // Batch fetch owner names (NO N+1!)
  const ownerIds = [...new Set(groups.map(g => g.ownerId))]
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  })
  const ownerMap = new Map(owners.map(o => [o.id, o.name || 'Unknown']))

  // Calculate match scores and format results
  const groupsWithScores = groups.map(group => {
    const matchScore = calculateRelevanceScore(combinedQuery, {
      name: group.name,
      description: group.description,
      subject: group.subject,
      subjectCustomDescription: group.subjectCustomDescription,
      skillLevel: group.skillLevel,
      skillLevelCustomDescription: group.skillLevelCustomDescription,
    })

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
      isMember: group.members.some(m => m.userId === userId),
      isOwner: group.ownerId === userId,
      createdAt: group.createdAt,
      matchScore,
    }
  })

  return {
    groups: groupsWithScores,
    total: totalCount,
  }
}
