/**
 * Redis Cache Layer using Upstash Redis
 *
 * Provides server-side caching for frequently accessed data:
 * - User stats (reduces database queries)
 * - Shop items (rarely changes)
 * - Online user counts (frequently accessed)
 * - Leaderboards (computed data)
 *
 * SETUP REQUIRED:
 * 1. Create a free Redis database at https://upstash.com
 * 2. Add to your .env:
 *    UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *    UPSTASH_REDIS_REST_TOKEN=xxx
 *
 * Cache invalidation strategy:
 * - User stats: Invalidate on session complete
 * - Shop items: Invalidate on purchase/activate
 * - Online counts: Short TTL (15 seconds)
 *
 * PRODUCTION REQUIREMENT:
 * Redis is REQUIRED in production for proper scaling.
 * Without Redis, rate limiting and caching will be severely degraded.
 */

import { Redis } from '@upstash/redis'

// Check if Redis is configured
const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
)

// PRODUCTION: Warn if Redis is not configured
const isProduction = process.env.NODE_ENV === 'production'
let redisWarningLogged = false

if (isProduction && !isRedisConfigured && !redisWarningLogged) {
  // Use console here since logger may not be initialized yet during module load
  console.error(
    '[Redis] CRITICAL: Redis is not configured in production! ' +
    'This will severely impact performance and rate limiting. ' +
    'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
  )
  redisWarningLogged = true
}

// Create Redis client (lazy initialization)
let redisClient: Redis | null = null

function getRedis(): Redis | null {
  if (!isRedisConfigured) {
    return null
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }

  return redisClient
}

/**
 * Check if Redis is required but not available (production without Redis)
 * Returns true if this is a critical configuration issue
 */
export function isRedisMissingInProduction(): boolean {
  return isProduction && !isRedisConfigured
}

// Cache key prefixes
export const CacheKeys = {
  USER_STATS: (userId: string) => `user:stats:${userId}`,
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  SHOP_ITEMS: () => `shop:items`,
  ONLINE_COUNT: () => `presence:online_count`,
  STUDYING_COUNT: () => `presence:studying_count`,
  LEADERBOARD: (type: string) => `leaderboard:${type}`,
  FOCUS_STATS: (userId: string) => `focus:stats:${userId}`,
  ADMIN_STATS: () => `admin:stats`,
  // PERF: Cache online partners presence per user
  ONLINE_PARTNERS: (userId: string) => `presence:partners:${userId}`,
  // SCALE: Cache partnerships for 2000-3000 user scale
  USER_PARTNERSHIPS: (userId: string) => `user:partnerships:${userId}`,
  // Global leaderboard (24h refresh)
  GLOBAL_LEADERBOARD: () => `leaderboard:global:daily`,
  DASHBOARD_COUNTS: (userId: string) => `dashboard:counts:${userId}`,
  STUDY_SUGGESTIONS: (userId: string) => `study:suggestions:${userId}`,
} as const

// Default TTLs in seconds
export const CacheTTL = {
  USER_STATS: 120,        // 2 minutes - stats don't change frequently
  USER_PROFILE: 300,      // 5 minutes - profile rarely changes
  SHOP_ITEMS: 600,        // 10 minutes - shop items are static
  ONLINE_COUNT: 15,       // 15 seconds - needs to be fresh
  STUDYING_COUNT: 15,     // 15 seconds - needs to be fresh
  LEADERBOARD: 60,        // 1 minute - computed data
  FOCUS_STATS: 30,        // 30 seconds - active session data
  ADMIN_STATS: 60,        // 1 minute - admin dashboard
  ONLINE_PARTNERS: 10,    // 10 seconds - presence needs to be fresh but cache helps at scale
  // SCALE: Longer TTLs for high-traffic data (2000-3000 users)
  USER_PARTNERSHIPS: 60,  // 1 minute - partnerships don't change often
  GLOBAL_LEADERBOARD: 86400, // 24 hours - refreshes daily
  DASHBOARD_COUNTS: 30,   // 30 seconds - notification counts
  STUDY_SUGGESTIONS: 300, // 5 minutes - suggestions don't need real-time updates
} as const

/**
 * Generic cache get with fallback
 * Returns cached data if available, otherwise calls fallback and caches result
 */
export async function cacheGet<T>(
  key: string,
  fallback: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const redis = getRedis()

  // If Redis not configured, just call fallback
  if (!redis) {
    return fallback()
  }

  try {
    // Try to get from cache
    const cached = await redis.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Cache miss - call fallback
    const data = await fallback()

    // Store in cache (don't await - fire and forget)
    redis.set(key, data, { ex: ttlSeconds }).catch((err) => {
      console.error('[Redis] Failed to set cache:', err)
    })

    return data
  } catch (error) {
    console.error('[Redis] Cache error, falling back:', error)
    // On any Redis error, fall back to direct query
    return fallback()
  }
}

/**
 * Set a value in cache
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  ttlSeconds: number = 60
): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.set(key, data, { ex: ttlSeconds })
  } catch (error) {
    console.error('[Redis] Failed to set cache:', error)
  }
}

/**
 * Delete a key from cache (invalidation)
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(key)
  } catch (error) {
    console.error('[Redis] Failed to delete cache:', error)
  }
}

/**
 * Delete multiple keys matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    // Upstash doesn't support SCAN, so we need to track keys manually
    // For now, we'll just delete known keys
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    console.error('[Redis] Failed to delete pattern:', error)
  }
}

/**
 * Invalidate user-related caches after an action
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await Promise.all([
      redis.del(CacheKeys.USER_STATS(userId)),
      redis.del(CacheKeys.USER_PROFILE(userId)),
      redis.del(CacheKeys.FOCUS_STATS(userId)),
    ])
  } catch (error) {
    console.error('[Redis] Failed to invalidate user cache:', error)
  }
}

/**
 * Invalidate shop cache after purchase/activation
 */
export async function invalidateShopCache(): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(CacheKeys.SHOP_ITEMS())
  } catch (error) {
    console.error('[Redis] Failed to invalidate shop cache:', error)
  }
}

/**
 * Increment a counter (useful for rate limiting, analytics)
 */
export async function cacheIncrement(
  key: string,
  ttlSeconds?: number
): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    const value = await redis.incr(key)
    if (ttlSeconds && value === 1) {
      // Set expiry on first increment
      await redis.expire(key, ttlSeconds)
    }
    return value
  } catch (error) {
    console.error('[Redis] Failed to increment:', error)
    return 0
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isRedisConfigured
}

export { getRedis }
