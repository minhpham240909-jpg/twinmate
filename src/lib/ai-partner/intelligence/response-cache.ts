/**
 * Response Cache System
 *
 * Hybrid caching strategy:
 * - Global cache: Factual questions with same answer for everyone
 * - Per-user cache: Personalized responses based on user context
 *
 * Features:
 * - Semantic similarity matching (not just exact match)
 * - Tiered TTL based on content type
 * - Automatic cache invalidation
 * - Cache statistics for monitoring
 */

import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// =============================================================================
// TYPES
// =============================================================================

export type CacheScope = 'global' | 'user' | 'session'
export type CacheStatus = 'hit' | 'miss' | 'expired' | 'invalidated'

export interface CacheEntry {
  id: string
  queryHash: string
  queryNormalized: string
  response: string
  scope: CacheScope
  userId: string | null
  subject: string | null
  skillLevel: string | null
  hitCount: number
  createdAt: Date
  expiresAt: Date
  lastAccessedAt: Date
  metadata: {
    originalQuery: string
    modelUsed: string
    tokensUsed: number
    responseLength: 'short' | 'medium' | 'detailed'
    complexity: 'simple' | 'moderate' | 'complex'
  }
}

export interface CacheLookupResult {
  status: CacheStatus
  entry: CacheEntry | null
  response: string | null
  // For analytics
  lookupTimeMs: number
}

export interface CacheWriteResult {
  success: boolean
  entryId: string | null
  error?: string
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CACHE_CONFIG = {
  // TTL in hours based on content type
  ttl: {
    factual: 24 * 7, // 7 days for factual/definitions
    conceptual: 24 * 3, // 3 days for explanations
    procedural: 24, // 24 hours for how-to (may change)
    personalized: 24, // 24 hours for personalized responses
  },
  // Maximum cache entries per scope
  maxEntries: {
    global: 10000,
    user: 500,
    session: 50,
  },
  // Similarity threshold for fuzzy matching (0-1)
  similarityThreshold: 0.85,
  // Minimum query length to cache
  minQueryLength: 10,
  // Maximum response length to cache (chars)
  maxResponseLength: 10000,
}

// =============================================================================
// QUERY NORMALIZATION
// =============================================================================

/**
 * Normalize a query for caching
 * - Lowercase
 * - Remove extra whitespace
 * - Remove punctuation variations
 * - Standardize common phrases
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Standardize punctuation
    .replace(/[?!.]+$/, '')
    // Remove common filler words at start
    .replace(/^(hey|hi|hello|please|can you|could you|would you|i want to know|i need to know|tell me|explain to me)\s+/i, '')
    // Standardize question forms
    .replace(/^what is (a |an |the )?/i, 'what is ')
    .replace(/^what are (the )?/i, 'what are ')
    .replace(/^how (do|does|can|should) (i |you |we )?/i, 'how to ')
    .replace(/^why (do|does|is|are) /i, 'why ')
}

/**
 * Generate a hash for a normalized query
 */
function hashQuery(normalizedQuery: string, scope: CacheScope, userId?: string): string {
  const scopePrefix = scope === 'global' ? 'g' : scope === 'user' ? `u:${userId}` : `s:${userId}`
  const content = `${scopePrefix}:${normalizedQuery}`
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32)
}

/**
 * Calculate simple similarity between two normalized queries
 * Uses Jaccard similarity on word sets
 */
function calculateSimilarity(query1: string, query2: string): number {
  const words1 = new Set(query1.split(' ').filter(w => w.length > 2))
  const words2 = new Set(query2.split(' ').filter(w => w.length > 2))

  if (words1.size === 0 || words2.size === 0) return 0

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

// =============================================================================
// SCOPE DETERMINATION
// =============================================================================

/**
 * Determine the appropriate cache scope for a query
 */
export function determineCacheScope(
  query: string,
  context: {
    isFactualQuestion?: boolean
    isPersonalized?: boolean
    mentionsUser?: boolean
    hasUserContext?: boolean
  }
): CacheScope {
  const lowerQuery = query.toLowerCase()

  // Check for personalization markers
  const personalMarkers = [
    'my ', 'mine', 'i am', "i'm", 'i have', "i've",
    'for me', 'help me', 'my name', 'my goal',
    'my level', 'my progress', 'my score',
  ]
  const isPersonal = personalMarkers.some(m => lowerQuery.includes(m))

  // Check for factual question patterns
  const factualPatterns = [
    /^what is (a |an |the )?[\w\s]+$/i,
    /^define\s+/i,
    /^who (is|was|invented|discovered)/i,
    /^when (was|did|is)/i,
    /^where (is|was|are)/i,
    /^how many/i,
    /^what year/i,
  ]
  const isFactual = factualPatterns.some(p => p.test(lowerQuery))

  if (context.isPersonalized || isPersonal || context.mentionsUser) {
    return 'user'
  }

  if (context.isFactualQuestion || isFactual) {
    return 'global'
  }

  // Default to user scope for safety
  return context.hasUserContext ? 'user' : 'global'
}

/**
 * Determine TTL based on query characteristics
 */
function determineTTL(
  query: string,
  scope: CacheScope,
  context: {
    isFactualQuestion?: boolean
    isConceptualQuestion?: boolean
    isProceduralQuestion?: boolean
  }
): number {
  // Base TTL in hours
  let ttlHours = CACHE_CONFIG.ttl.personalized

  if (context.isFactualQuestion) {
    ttlHours = CACHE_CONFIG.ttl.factual
  } else if (context.isConceptualQuestion) {
    ttlHours = CACHE_CONFIG.ttl.conceptual
  } else if (context.isProceduralQuestion) {
    ttlHours = CACHE_CONFIG.ttl.procedural
  }

  // Reduce TTL for personalized content
  if (scope === 'user') {
    ttlHours = Math.min(ttlHours, CACHE_CONFIG.ttl.personalized)
  }

  return ttlHours * 60 * 60 * 1000 // Convert to milliseconds
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Look up a cached response
 */
export async function lookupCache(
  query: string,
  options: {
    userId?: string
    subject?: string
    skillLevel?: string
    scope?: CacheScope
  } = {}
): Promise<CacheLookupResult> {
  const startTime = Date.now()

  try {
    const normalizedQuery = normalizeQuery(query)

    // Skip very short queries
    if (normalizedQuery.length < CACHE_CONFIG.minQueryLength) {
      return {
        status: 'miss',
        entry: null,
        response: null,
        lookupTimeMs: Date.now() - startTime,
      }
    }

    // Determine scope if not provided
    const scope = options.scope || determineCacheScope(query, {
      hasUserContext: !!options.userId,
    })

    // Generate hash for exact match
    const queryHash = hashQuery(normalizedQuery, scope, options.userId)

    // Try exact match first (fastest)
    const exactMatch = await prisma.aIResponseCache.findFirst({
      where: {
        queryHash,
        expiresAt: { gt: new Date() },
        ...(scope === 'user' && options.userId ? { userId: options.userId } : {}),
        ...(scope === 'global' ? { scope: 'global' } : {}),
      },
    })

    if (exactMatch) {
      // Update hit count and last accessed
      await prisma.aIResponseCache.update({
        where: { id: exactMatch.id },
        data: {
          hitCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      })

      return {
        status: 'hit',
        entry: {
          id: exactMatch.id,
          queryHash: exactMatch.queryHash,
          queryNormalized: exactMatch.queryNormalized,
          response: exactMatch.response,
          scope: exactMatch.scope as CacheScope,
          userId: exactMatch.userId,
          subject: exactMatch.subject,
          skillLevel: exactMatch.skillLevel,
          hitCount: exactMatch.hitCount + 1,
          createdAt: exactMatch.createdAt,
          expiresAt: exactMatch.expiresAt,
          lastAccessedAt: new Date(),
          metadata: exactMatch.metadata as CacheEntry['metadata'],
        },
        response: exactMatch.response,
        lookupTimeMs: Date.now() - startTime,
      }
    }

    // Try fuzzy match for global scope (more expensive)
    if (scope === 'global') {
      const similarEntries = await prisma.aIResponseCache.findMany({
        where: {
          scope: 'global',
          expiresAt: { gt: new Date() },
          ...(options.subject ? { subject: options.subject } : {}),
        },
        take: 20,
        orderBy: { hitCount: 'desc' },
      })

      for (const entry of similarEntries) {
        const similarity = calculateSimilarity(normalizedQuery, entry.queryNormalized)
        if (similarity >= CACHE_CONFIG.similarityThreshold) {
          // Update hit count
          await prisma.aIResponseCache.update({
            where: { id: entry.id },
            data: {
              hitCount: { increment: 1 },
              lastAccessedAt: new Date(),
            },
          })

          return {
            status: 'hit',
            entry: {
              id: entry.id,
              queryHash: entry.queryHash,
              queryNormalized: entry.queryNormalized,
              response: entry.response,
              scope: entry.scope as CacheScope,
              userId: entry.userId,
              subject: entry.subject,
              skillLevel: entry.skillLevel,
              hitCount: entry.hitCount + 1,
              createdAt: entry.createdAt,
              expiresAt: entry.expiresAt,
              lastAccessedAt: new Date(),
              metadata: entry.metadata as CacheEntry['metadata'],
            },
            response: entry.response,
            lookupTimeMs: Date.now() - startTime,
          }
        }
      }
    }

    return {
      status: 'miss',
      entry: null,
      response: null,
      lookupTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[ResponseCache] Lookup error:', error)
    return {
      status: 'miss',
      entry: null,
      response: null,
      lookupTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Write a response to cache
 */
export async function writeCache(
  query: string,
  response: string,
  options: {
    userId?: string
    subject?: string
    skillLevel?: string
    scope?: CacheScope
    modelUsed?: string
    tokensUsed?: number
    responseLength?: 'short' | 'medium' | 'detailed'
    complexity?: 'simple' | 'moderate' | 'complex'
    isFactualQuestion?: boolean
    isConceptualQuestion?: boolean
    isProceduralQuestion?: boolean
  } = {}
): Promise<CacheWriteResult> {
  try {
    const normalizedQuery = normalizeQuery(query)

    // Skip caching if too short or too long
    if (normalizedQuery.length < CACHE_CONFIG.minQueryLength) {
      return { success: false, entryId: null, error: 'Query too short' }
    }
    if (response.length > CACHE_CONFIG.maxResponseLength) {
      return { success: false, entryId: null, error: 'Response too long' }
    }

    // Determine scope
    const scope = options.scope || determineCacheScope(query, {
      isFactualQuestion: options.isFactualQuestion,
      hasUserContext: !!options.userId,
    })

    // Generate hash
    const queryHash = hashQuery(normalizedQuery, scope, options.userId)

    // Calculate TTL
    const ttlMs = determineTTL(query, scope, {
      isFactualQuestion: options.isFactualQuestion,
      isConceptualQuestion: options.isConceptualQuestion,
      isProceduralQuestion: options.isProceduralQuestion,
    })
    const expiresAt = new Date(Date.now() + ttlMs)

    // Upsert cache entry
    const entry = await prisma.aIResponseCache.upsert({
      where: { queryHash },
      update: {
        response,
        expiresAt,
        lastAccessedAt: new Date(),
        metadata: {
          originalQuery: query,
          modelUsed: options.modelUsed || 'unknown',
          tokensUsed: options.tokensUsed || 0,
          responseLength: options.responseLength || 'medium',
          complexity: options.complexity || 'moderate',
        },
      },
      create: {
        queryHash,
        queryNormalized: normalizedQuery,
        response,
        scope,
        userId: scope === 'global' ? null : options.userId || null,
        subject: options.subject || null,
        skillLevel: options.skillLevel || null,
        expiresAt,
        metadata: {
          originalQuery: query,
          modelUsed: options.modelUsed || 'unknown',
          tokensUsed: options.tokensUsed || 0,
          responseLength: options.responseLength || 'medium',
          complexity: options.complexity || 'moderate',
        },
      },
    })

    return { success: true, entryId: entry.id }
  } catch (error) {
    console.error('[ResponseCache] Write error:', error)
    return { success: false, entryId: null, error: String(error) }
  }
}

/**
 * Invalidate cache entries
 */
export async function invalidateCache(
  options: {
    userId?: string
    subject?: string
    scope?: CacheScope
    olderThan?: Date
  }
): Promise<number> {
  try {
    const result = await prisma.aIResponseCache.deleteMany({
      where: {
        ...(options.userId ? { userId: options.userId } : {}),
        ...(options.subject ? { subject: options.subject } : {}),
        ...(options.scope ? { scope: options.scope } : {}),
        ...(options.olderThan ? { createdAt: { lt: options.olderThan } } : {}),
      },
    })

    return result.count
  } catch (error) {
    console.error('[ResponseCache] Invalidation error:', error)
    return 0
  }
}

/**
 * Clean up expired entries (should be run periodically)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await prisma.aIResponseCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    console.log(`[ResponseCache] Cleaned up ${result.count} expired entries`)
    return result.count
  } catch (error) {
    console.error('[ResponseCache] Cleanup error:', error)
    return 0
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number
  globalEntries: number
  userEntries: number
  totalHits: number
  averageHitCount: number
  oldestEntry: Date | null
  newestEntry: Date | null
}> {
  try {
    const [total, global, user, stats] = await Promise.all([
      prisma.aIResponseCache.count(),
      prisma.aIResponseCache.count({ where: { scope: 'global' } }),
      prisma.aIResponseCache.count({ where: { scope: 'user' } }),
      prisma.aIResponseCache.aggregate({
        _sum: { hitCount: true },
        _avg: { hitCount: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ])

    return {
      totalEntries: total,
      globalEntries: global,
      userEntries: user,
      totalHits: stats._sum.hitCount || 0,
      averageHitCount: stats._avg.hitCount || 0,
      oldestEntry: stats._min.createdAt,
      newestEntry: stats._max.createdAt,
    }
  } catch (error) {
    console.error('[ResponseCache] Stats error:', error)
    return {
      totalEntries: 0,
      globalEntries: 0,
      userEntries: 0,
      totalHits: 0,
      averageHitCount: 0,
      oldestEntry: null,
      newestEntry: null,
    }
  }
}

// =============================================================================
// IN-MEMORY CACHE FOR HOT QUERIES
// =============================================================================

// Simple LRU-like in-memory cache for frequently accessed queries
const memoryCache = new Map<string, { response: string; timestamp: number }>()
const MEMORY_CACHE_MAX_SIZE = 100
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check memory cache first (fastest)
 */
export function checkMemoryCache(queryHash: string): string | null {
  const entry = memoryCache.get(queryHash)
  if (entry && Date.now() - entry.timestamp < MEMORY_CACHE_TTL_MS) {
    return entry.response
  }
  if (entry) {
    memoryCache.delete(queryHash)
  }
  return null
}

/**
 * Add to memory cache
 */
export function addToMemoryCache(queryHash: string, response: string): void {
  // Evict old entries if at capacity
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value
    if (oldestKey) memoryCache.delete(oldestKey)
  }

  memoryCache.set(queryHash, { response, timestamp: Date.now() })
}

/**
 * Clear memory cache
 */
export function clearMemoryCache(): void {
  memoryCache.clear()
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  normalizeQuery,
  hashQuery,
  calculateSimilarity,
  determineTTL,
  CACHE_CONFIG,
}
