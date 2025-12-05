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
 */
export const CACHE_TTL = {
  USER_PROFILE: 5 * 60, // 5 minutes
  GROUP: 2 * 60, // 2 minutes
  TRENDING: 10 * 60, // 10 minutes
  SEARCH: 5 * 60, // 5 minutes
  FEED: 2 * 60, // 2 minutes
  STATISTICS: 15 * 60, // 15 minutes
  ONLINE_USERS: 30, // 30 seconds
} as const

/**
 * Cache key prefixes for namespacing
 */
export const CACHE_PREFIX = {
  USER: 'user',
  GROUP: 'group',
  TRENDING: 'trending',
  SEARCH: 'search',
  FEED: 'feed',
  STATS: 'stats',
  ONLINE: 'online',
} as const

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

      const response = await fetch(`${url}/get/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) return null

      const result = await response.json()
      if (result.result === null) return null

      return JSON.parse(result.result) as T
    } catch (error) {
      console.error('Redis GET error:', error)
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

      await fetch(`${url}/setex/${key}/${ttl}/${encodeURIComponent(value)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      console.error('Redis SETEX error:', error)
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
        const scanResponse = await fetch(`${url}/keys/${pattern}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (scanResponse.ok) {
          const keys = await scanResponse.json()
          if (keys.result && Array.isArray(keys.result) && keys.result.length > 0) {
            const pipeline = keys.result.map((key: string) => ['DEL', key])
            await fetch(`${url}/pipeline`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(pipeline),
            })
          }
        }
      } else {
        await fetch(`${url}/del/${pattern}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch (error) {
      console.error('Redis invalidate error:', error)
    }
  }

  // Also invalidate memory cache
  if (pattern.includes('*')) {
    invalidateByPattern(pattern)
  } else {
    cache.delete(pattern)
  }
}

/**
 * Get or set cached data (cache-aside pattern)
 */
export async function getOrSetCached<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await getCached<T>(key)
  if (cached !== null) return cached

  const data = await fetchFn()
  await setCached(key, data, ttl)
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

/**
 * Invalidate all user-related caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    invalidateCache(userProfileKey(userId)),
    invalidateCache(`${CACHE_PREFIX.FEED}:${userId}:*`),
    invalidateCache(onlineUsersKey()),
  ])
}

/**
 * Invalidate all group-related caches
 */
export async function invalidateGroupCache(groupId: string): Promise<void> {
  await invalidateCache(groupKey(groupId))
}

/**
 * Invalidate feed caches (after new post/comment)
 */
export async function invalidateFeedCaches(): Promise<void> {
  await Promise.all([
    invalidateCache(trendingKey()),
    invalidateCache(`${CACHE_PREFIX.FEED}:*`),
  ])
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
      const scanResponse = await fetch(`${url}/keys/*`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (scanResponse.ok) {
        const keys = await scanResponse.json()
        if (keys.result && Array.isArray(keys.result) && keys.result.length > 0) {
          clearedCount = keys.result.length
          const pipeline = keys.result.map((key: string) => ['DEL', key])
          await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pipeline),
          })
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
    console.error('Error clearing caches:', error)
    // Still try to clear memory cache
    cache.clear()
    return {
      success: false,
      cleared: 0,
      message: 'Failed to clear Redis cache, memory cache cleared',
    }
  }
}
