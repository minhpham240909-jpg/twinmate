/**
 * Simple in-memory cache with TTL (Time To Live)
 * For production, consider using Redis/Upstash for distributed caching
 * This provides a lightweight solution without external dependencies
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
  const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
  let count = 0

  for (const key of Array.from(cache['cache'].keys())) {
    if (regex.test(key)) {
      cache.delete(key)
      count++
    }
  }

  return count
}
