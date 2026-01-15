/**
 * Caching Utility with Redis (Upstash) support
 * 
 * Provides caching layer for frequently accessed data:
 * - User profiles (5min)
 * - Groups (2min)
 * - Trending posts (10min)
 * - Search results (5min)
 * - Feed data (2min)
 * 
 * Automatically falls back to in-memory cache in development
 */

import logger from '@/lib/logger'
import { fetchWithBackoff, type FetchBackoffOptions } from '@/lib/api/timeout'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set value in cache with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000)
    this.cache.set(key, { data, expiresAt })
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Get cache stats
   */
  getStats() {
    const now = Date.now()
    let activeCount = 0
    let expiredCount = 0

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++
      } else {
        activeCount++
      }
    }

    return {
      total: this.cache.size,
      active: activeCount,
      expired: expiredCount,
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
const cache = new MemoryCache()

export default cache

/**
 * Helper function to cache API responses
 * 
 * Usage:
 * ```typescript
 * const result = await withCache(
 *   'partners-search-' + userId,
 *   () => fetchPartners(userId),
 *   60 // Cache for 60 seconds
 * )
 * ```
 */
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetchFn()
  
  // Store in cache
  cache.set(key, data, ttlSeconds)
  
  return data
}

/**
 * Invalidate cache entries by pattern
 * 
 * Usage:
 * ```typescript
 * invalidateByPattern('partners-*')
 * ```
 */
export function invalidateByPattern(pattern: string): number {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
  let count = 0

  for (const key of Array.from(cache['cache'].keys())) {
    if (regex.test(key)) {
      cache.delete(key)
      count++
    }
  }

  return count
}

// ============================================================================
// Redis/Upstash Implementation
// ============================================================================

/**
 * Cache TTL constants (in seconds)
 * Optimized for 3,000+ concurrent users
 */
export const CACHE_TTL = {
  // User data (critical for reducing DB load)
  USER_PROFILE: 10 * 60, // 10 minutes (increased from 5)
  USER_SESSION: 15 * 60, // 15 minutes
  USER_PREFERENCES: 30 * 60, // 30 minutes

  // Social features
  GROUP: 5 * 60, // 5 minutes (increased from 2)
  GROUP_MEMBERS: 5 * 60, // 5 minutes
  CONNECTIONS: 5 * 60, // 5 minutes

  // Content feeds (balance freshness vs performance)
  TRENDING: 5 * 60, // 5 minutes (decreased for freshness)
  FEED: 2 * 60, // 2 minutes
  POSTS_LIST: 2 * 60, // 2 minutes

  // Search (expensive queries)
  SEARCH_PARTNERS: 10 * 60, // 10 minutes (increased from 5)
  SEARCH_GROUPS: 10 * 60, // 10 minutes (increased from 5)
  SEARCH_COUNT: 30 * 60, // 30 minutes

  // Study sessions
  SESSION_LIST: 2 * 60, // 2 minutes
  SESSION_DETAIL: 1 * 60, // 1 minute (needs to be fresh)
  ACTIVE_SESSIONS: 1 * 60, // 1 minute

  // Messaging
  CONVERSATIONS_LIST: 1 * 60, // 1 minute
  UNREAD_COUNT: 30, // 30 seconds

  // Analytics & Stats
  STATISTICS: 15 * 60, // 15 minutes
  ADMIN_STATS: 5 * 60, // 5 minutes
  LEADERBOARD: 10 * 60, // 10 minutes

  // Real-time features (very short TTL)
  ONLINE_USERS: 30, // 30 seconds
  PRESENCE_STATUS: 30, // 30 seconds
  TYPING_INDICATOR: 5, // 5 seconds
} as const

/**
 * Cache key prefixes for namespacing
 * Using version prefix for easy cache invalidation across deployments
 */
const CACHE_VERSION = 'v1'

export const CACHE_PREFIX = {
  USER: `${CACHE_VERSION}:user`,
  USER_SESSION: `${CACHE_VERSION}:user-session`,
  GROUP: `${CACHE_VERSION}:group`,
  GROUP_MEMBERS: `${CACHE_VERSION}:group-members`,
  TRENDING: `${CACHE_VERSION}:trending`,
  SEARCH: `${CACHE_VERSION}:search`,
  SEARCH_PARTNERS: `${CACHE_VERSION}:search-partners`,
  SEARCH_GROUPS: `${CACHE_VERSION}:search-groups`,
  FEED: `${CACHE_VERSION}:feed`,
  POSTS: `${CACHE_VERSION}:posts`,
  SESSIONS: `${CACHE_VERSION}:sessions`,
  CONVERSATIONS: `${CACHE_VERSION}:conversations`,
  STATS: `${CACHE_VERSION}:stats`,
  ONLINE: `${CACHE_VERSION}:online`,
  CONNECTIONS: `${CACHE_VERSION}:connections`,
} as const

const UPSTASH_BACKOFF: FetchBackoffOptions = {
  // Keep this small: Upstash is low-latency; we mainly want resilience for brief blips/429s
  maxRetries: 3,
  initialDelayMs: 150,
  maxDelayMs: 1500,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
  retryOnStatuses: [429, 500, 502, 503, 504],
  respectRetryAfter: true,
  timeoutPerAttemptMs: 5000,
}

function encodeUpstashPathSegment(value: string): string {
  // Upstash REST encodes keys and patterns as path segments
  return encodeURIComponent(value)
}

/**
 * Check if Redis/Upstash is configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Get cached data with Redis support
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (isRedisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!

      const response = await fetchWithBackoff(`${url}/get/${encodeUpstashPathSegment(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, UPSTASH_BACKOFF)

      if (!response.ok) return null

      const result = await response.json()
      if (result.result === null) return null

      return JSON.parse(result.result) as T
    } catch (error) {
      logger.error('Redis GET error', error instanceof Error ? error : { error })
      // Fallback to memory cache
      return cache.get<T>(key)
    }
  }

  // Use memory cache
  return cache.get<T>(key)
}

/**
 * Set cached data with Redis support
 */
export async function setCached<T>(key: string, data: T, ttl: number): Promise<void> {
  if (isRedisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!
      const value = JSON.stringify(data)

      await fetchWithBackoff(`${url}/setex/${encodeUpstashPathSegment(key)}/${ttl}/${encodeURIComponent(value)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, UPSTASH_BACKOFF)
    } catch (error) {
      logger.error('Redis SETEX error', error instanceof Error ? error : { error })
      // Fallback to memory cache
      cache.set(key, data, ttl)
    }
  } else {
    cache.set(key, data, ttl)
  }
}

/**
 * Invalidate cached data with pattern support
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (isRedisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!

      if (pattern.includes('*')) {
        // Get matching keys
        const scanResponse = await fetchWithBackoff(`${url}/keys/${encodeUpstashPathSegment(pattern)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }, UPSTASH_BACKOFF)

        if (scanResponse.ok) {
          const keys = await scanResponse.json()
          if (keys.result && Array.isArray(keys.result) && keys.result.length > 0) {
            const pipeline = keys.result.map((key: string) => ['DEL', key])
            await fetchWithBackoff(`${url}/pipeline`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(pipeline),
            }, UPSTASH_BACKOFF)
          }
        }
      } else {
        await fetchWithBackoff(`${url}/del/${encodeUpstashPathSegment(pattern)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }, UPSTASH_BACKOFF)
      }
    } catch (error) {
      logger.error('Redis invalidate error', error instanceof Error ? error : { error })
    }
  }

  // Also invalidate memory cache
  if (pattern.includes('*')) {
    invalidateByPattern(pattern)
  } else {
    cache.delete(pattern)
  }
}

// ============================================================================
// Cache Stampede Prevention
// ============================================================================

// In-flight requests map to prevent cache stampede
// Key -> Promise that resolves when the request completes
const inFlightRequests = new Map<string, Promise<unknown>>()

// SCALABILITY: Maximum in-flight requests to prevent memory bloat under high load
const MAX_IN_FLIGHT_REQUESTS = 5000

// Lock TTL for distributed locking (in seconds)
const LOCK_TTL = 10

/**
 * SCALABILITY: Enforce bounds on in-flight requests map
 * Prevents memory issues under high concurrency (3000+ users)
 */
function enforceInFlightBounds(): void {
  if (inFlightRequests.size > MAX_IN_FLIGHT_REQUESTS) {
    // Remove oldest entries (first added = first in map iteration)
    const entriesToRemove = inFlightRequests.size - MAX_IN_FLIGHT_REQUESTS + 100 // Remove 100 extra for buffer
    let removed = 0
    for (const key of inFlightRequests.keys()) {
      if (removed >= entriesToRemove) break
      inFlightRequests.delete(key)
      removed++
    }
    logger.warn('Cache pruned in-flight requests (high concurrency)', {
      removed,
      sizeAfter: inFlightRequests.size,
    })
  }
}

/**
 * Acquire a distributed lock using Redis SETNX
 * Returns true if lock acquired, false otherwise
 */
async function acquireLock(lockKey: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    // In-memory: use the inFlightRequests map
    return !inFlightRequests.has(lockKey)
  }

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    // SETNX with expiry - atomic operation
    const response = await fetchWithBackoff(`${url}/set/${encodeUpstashPathSegment(lockKey)}/1/ex/${LOCK_TTL}/nx`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, UPSTASH_BACKOFF)

    if (response.ok) {
      const result = await response.json()
      return result.result === 'OK'
    }
    return false
  } catch {
    return false
  }
}

/**
 * Release a distributed lock
 */
async function releaseLock(lockKey: string): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    await fetchWithBackoff(`${url}/del/${encodeUpstashPathSegment(lockKey)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, UPSTASH_BACKOFF)
  } catch {
    // Ignore errors - lock will expire anyway
  }
}

/**
 * Get or set cached data with cache stampede prevention
 *
 * Uses a combination of:
 * 1. Distributed locking (Redis SETNX) to prevent multiple fetches
 * 2. In-flight request deduplication for concurrent requests
 * 3. Stale-while-revalidate pattern for better UX
 */
export async function getOrSetCached<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // 1. Try to get from cache first
  const cached = await getCached<T>(key)
  if (cached !== null) return cached

  // 2. Check if there's already an in-flight request for this key
  const inFlight = inFlightRequests.get(key)
  if (inFlight) {
    // Wait for the existing request to complete
    return inFlight as Promise<T>
  }

  // 3. Try to acquire lock to prevent stampede
  const lockKey = `lock:${key}`
  const lockAcquired = await acquireLock(lockKey)

  if (!lockAcquired) {
    // Another instance is fetching - wait briefly then check cache again
    await new Promise(resolve => setTimeout(resolve, 100))
    const retryCache = await getCached<T>(key)
    if (retryCache !== null) return retryCache

    // Still no cache - wait a bit more and retry
    await new Promise(resolve => setTimeout(resolve, 200))
    const finalRetry = await getCached<T>(key)
    if (finalRetry !== null) return finalRetry

    // Fallback: fetch anyway (should be rare)
    const fallbackData = await fetchFn()
    await setCached(key, fallbackData, ttl)
    return fallbackData
  }

  // 4. We have the lock - create the fetch promise
  const fetchPromise = (async (): Promise<T> => {
    try {
      const data = await fetchFn()
      await setCached(key, data, ttl)
      return data
    } finally {
      // Clean up
      inFlightRequests.delete(key)
      await releaseLock(lockKey)
    }
  })()

  // Store the promise for other concurrent requests
  inFlightRequests.set(key, fetchPromise)

  // SCALABILITY: Enforce bounds to prevent memory bloat
  enforceInFlightBounds()

  return fetchPromise
}

/**
 * Get or set cached data with stale-while-revalidate pattern
 * Returns stale data immediately while refreshing in background
 */
export async function getOrSetCachedWithStale<T>(
  key: string,
  ttl: number,
  staleTtl: number, // How long to keep stale data
  fetchFn: () => Promise<T>
): Promise<T> {
  // Check cache including stale data
  const cached = await getCached<T>(key)
  if (cached !== null) return cached

  // Check stale cache
  const staleKey = `stale:${key}`
  const stale = await getCached<T>(staleKey)

  if (stale !== null) {
    // Return stale data and refresh in background
    getOrSetCached(key, ttl, fetchFn).catch((error) => {
      logger.error('Cache background refresh failed', error instanceof Error ? error : { error })
    })
    return stale
  }

  // No cached data - fetch synchronously
  const data = await getOrSetCached(key, ttl, fetchFn)

  // Also store in stale cache with longer TTL
  await setCached(staleKey, data, staleTtl)

  return data
}

// ============================================================================
// Cache Key Helpers
// ============================================================================

export function userProfileKey(userId: string): string {
  return `${CACHE_PREFIX.USER}:${userId}`
}

export function groupKey(groupId: string): string {
  return `${CACHE_PREFIX.GROUP}:${groupId}`
}

export function trendingKey(): string {
  return `${CACHE_PREFIX.TRENDING}:posts`
}

export function searchKey(query: string, type?: string): string {
  const normalized = query.toLowerCase().trim()
  return type ? `${CACHE_PREFIX.SEARCH}:${type}:${normalized}` : `${CACHE_PREFIX.SEARCH}:${normalized}`
}

export function feedKey(userId: string, page: number = 1): string {
  return `${CACHE_PREFIX.FEED}:${userId}:${page}`
}

export function statsKey(type: string): string {
  return `${CACHE_PREFIX.STATS}:${type}`
}

export function onlineUsersKey(): string {
  return `${CACHE_PREFIX.ONLINE}:users`
}

export function sessionListKey(userId: string, filters?: string): string {
  return filters
    ? `${CACHE_PREFIX.SESSIONS}:list:${userId}:${filters}`
    : `${CACHE_PREFIX.SESSIONS}:list:${userId}`
}

export function sessionDetailKey(sessionId: string): string {
  return `${CACHE_PREFIX.SESSIONS}:detail:${sessionId}`
}

export function conversationsListKey(userId: string, page: number = 1): string {
  return `${CACHE_PREFIX.CONVERSATIONS}:list:${userId}:${page}`
}

export function unreadCountKey(userId: string): string {
  return `${CACHE_PREFIX.CONVERSATIONS}:unread:${userId}`
}

export function connectionsKey(userId: string): string {
  return `${CACHE_PREFIX.CONNECTIONS}:${userId}`
}

export function postsListKey(filters: string, page: number = 1): string {
  return `${CACHE_PREFIX.POSTS}:list:${filters}:${page}`
}

/**
 * Batch get multiple cache keys (for performance)
 */
export async function getMultipleCached<T>(keys: string[]): Promise<Map<string, T>> {
  const results = new Map<string, T>()

  if (keys.length === 0) return results

  if (isRedisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!

      // Use Redis pipeline for batch get
      const pipeline = keys.map(key => ['GET', key])
      const response = await fetchWithBackoff(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipeline),
      }, UPSTASH_BACKOFF)

      if (response.ok) {
        const data = await response.json()
        data.forEach((item: { result: string | null }, index: number) => {
          if (item.result !== null) {
            try {
              results.set(keys[index], JSON.parse(item.result))
            } catch {
              // Skip invalid JSON
            }
          }
        })
      }
    } catch (error) {
      logger.error('Redis MGET error', error instanceof Error ? error : { error })
      // Fallback to memory cache
      for (const key of keys) {
        const value = cache.get<T>(key)
        if (value !== null) {
          results.set(key, value)
        }
      }
    }
  } else {
    // Use memory cache
    for (const key of keys) {
      const value = cache.get<T>(key)
      if (value !== null) {
        results.set(key, value)
      }
    }
  }

  return results
}

/**
 * Batch set multiple cache keys (for performance)
 */
export async function setMultipleCached<T>(entries: Array<{ key: string; data: T; ttl: number }>): Promise<void> {
  if (entries.length === 0) return

  if (isRedisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!

      // Use Redis pipeline for batch set
      const pipeline = entries.map(({ key, data, ttl }) => [
        'SETEX',
        key,
        ttl,
        JSON.stringify(data),
      ])

      await fetchWithBackoff(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipeline),
      }, UPSTASH_BACKOFF)
    } catch (error) {
      logger.error('Redis MSET error', error instanceof Error ? error : { error })
      // Fallback to memory cache
      for (const { key, data, ttl } of entries) {
        cache.set(key, data, ttl)
      }
    }
  } else {
    // Use memory cache
    for (const { key, data, ttl } of entries) {
      cache.set(key, data, ttl)
    }
  }
}

/**
 * Invalidate all user-related caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    invalidateCache(userProfileKey(userId)),
    invalidateCache(`${CACHE_PREFIX.USER_SESSION}:${userId}`),
    invalidateCache(`${CACHE_PREFIX.FEED}:${userId}:*`),
    invalidateCache(sessionListKey(userId)),
    invalidateCache(`${CACHE_PREFIX.SESSIONS}:list:${userId}:*`),
    invalidateCache(conversationsListKey(userId)),
    invalidateCache(`${CACHE_PREFIX.CONVERSATIONS}:list:${userId}:*`),
    invalidateCache(connectionsKey(userId)),
    invalidateCache(onlineUsersKey()),
    // IMPORTANT: Invalidate partner search cache when profile changes
    // This ensures match percentages are recalculated with fresh profile data
    invalidateCache(`${CACHE_PREFIX.SEARCH_PARTNERS}:${userId}:*`),
    invalidateCache(`${CACHE_PREFIX.SEARCH_PARTNERS}:*`), // Also invalidate ALL search caches since match % depends on both profiles
  ])
}

/**
 * Invalidate all group-related caches
 */
export async function invalidateGroupCache(groupId: string): Promise<void> {
  await Promise.all([
    invalidateCache(groupKey(groupId)),
    invalidateCache(`${CACHE_PREFIX.GROUP_MEMBERS}:${groupId}`),
    invalidateCache(`${CACHE_PREFIX.SEARCH_GROUPS}:*`),
  ])
}

/**
 * Invalidate feed caches (after new post/comment)
 */
export async function invalidateFeedCaches(): Promise<void> {
  await Promise.all([
    invalidateCache(trendingKey()),
    invalidateCache(`${CACHE_PREFIX.FEED}:*`),
    invalidateCache(`${CACHE_PREFIX.POSTS}:*`),
  ])
}

/**
 * Invalidate search caches (after profile/group update)
 */
export async function invalidateSearchCaches(): Promise<void> {
  await Promise.all([
    invalidateCache(`${CACHE_PREFIX.SEARCH_PARTNERS}:*`),
    invalidateCache(`${CACHE_PREFIX.SEARCH_GROUPS}:*`),
    invalidateCache(`${CACHE_PREFIX.SEARCH}:*`),
  ])
}

/**
 * Invalidate session caches (after session update)
 */
export async function invalidateSessionCache(sessionId: string, userId?: string): Promise<void> {
  const promises = [
    invalidateCache(sessionDetailKey(sessionId)),
    invalidateCache(`${CACHE_PREFIX.SESSIONS}:*`),
  ]

  if (userId) {
    promises.push(invalidateCache(sessionListKey(userId)))
    promises.push(invalidateCache(`${CACHE_PREFIX.SESSIONS}:list:${userId}:*`))
  }

  await Promise.all(promises)
}

// ============================================================================
// HTTP Response Caching Headers
// ============================================================================

/**
 * HTTP Cache-Control header presets for different data types
 */
export const HTTP_CACHE = {
  // No caching (for user-specific or sensitive data)
  NO_CACHE: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  },

  // Short cache for frequently changing data (30 seconds)
  SHORT: {
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
  },

  // Medium cache for semi-static data (5 minutes)
  MEDIUM: {
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
  },

  // Long cache for rarely changing data (1 hour)
  LONG: {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
  },

  // Private cache for user-specific but cacheable data (2 minutes)
  PRIVATE_SHORT: {
    'Cache-Control': 'private, max-age=120',
  },

  // Private cache for user-specific data (5 minutes)
  PRIVATE_MEDIUM: {
    'Cache-Control': 'private, max-age=300',
  },

  // Immutable cache for content that never changes (1 year)
  IMMUTABLE: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
} as const

/**
 * Create a cached JSON response with appropriate headers
 */
export function cachedJsonResponse<T>(
  data: T,
  cacheHeaders: Record<string, string> = HTTP_CACHE.SHORT,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cacheHeaders,
    },
  })
}

/**
 * Create a cached JSON response with ETag support for conditional requests
 */
export function cachedJsonResponseWithETag<T>(
  data: T,
  cacheHeaders: Record<string, string> = HTTP_CACHE.MEDIUM,
  status: number = 200
): Response {
  const jsonString = JSON.stringify(data)
  // Generate simple hash for ETag
  const etag = `"${Buffer.from(jsonString).toString('base64').slice(0, 20)}"`

  return new Response(jsonString, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
      ...cacheHeaders,
    },
  })
}

/**
 * Check if request can use cached response (304 Not Modified)
 */
export function checkConditionalRequest(
  request: Request,
  etag: string
): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match')
  return ifNoneMatch === etag
}

/**
 * Create 304 Not Modified response
 */
export function notModifiedResponse(): Response {
  return new Response(null, {
    status: 304,
    headers: HTTP_CACHE.MEDIUM,
  })
}

/**
 * Clear ALL caches - Admin only function
 * Clears both Redis and in-memory caches
 */
export async function clearAllCaches(): Promise<{ success: boolean; cleared: number; message: string }> {
  let clearedCount = 0

  try {
    // Clear Redis caches if configured
    if (isRedisConfigured()) {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!

      // Get all keys and delete them
      const scanResponse = await fetchWithBackoff(`${url}/keys/${encodeUpstashPathSegment('*')}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, UPSTASH_BACKOFF)

      if (scanResponse.ok) {
        const keys = await scanResponse.json()
        if (keys.result && Array.isArray(keys.result) && keys.result.length > 0) {
          clearedCount = keys.result.length
          const pipeline = keys.result.map((key: string) => ['DEL', key])
          await fetchWithBackoff(`${url}/pipeline`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pipeline),
          }, UPSTASH_BACKOFF)
        }
      }
    }

    // Clear in-memory cache
    const memoryStats = cache.getStats()
    cache.clear()
    clearedCount += memoryStats.total

    return {
      success: true,
      cleared: clearedCount,
      message: `Successfully cleared ${clearedCount} cache entries`,
    }
  } catch (error) {
    logger.error('Error clearing caches', error instanceof Error ? error : { error })
    // Still try to clear memory cache
    cache.clear()
    return {
      success: false,
      cleared: 0,
      message: 'Failed to clear Redis cache, memory cache cleared',
    }
  }
}
