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
  // Arena topic question cache (24h, normalized topic key)
  ARENA_TOPIC_QUESTIONS: (topic: string, difficulty: string, count: number) =>
    `arena:questions:${normalizeTopicKey(topic)}:${difficulty}:${count}`,
  // Background generation status (tracks in-progress generations)
  ARENA_GENERATION_STATUS: (generationId: string) => `arena:generation:${generationId}`,
} as const

// Helper to normalize topic keys for caching (lowercase, trim, replace spaces)
function normalizeTopicKey(topic: string): string {
  return topic.toLowerCase().trim().replace(/\s+/g, '_').slice(0, 100)
}

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
  // Arena topic caching - common topics reused across users
  ARENA_TOPIC_QUESTIONS: 86400, // 24 hours - topic questions don't change
  ARENA_GENERATION_STATUS: 300, // 5 minutes - track generation progress
} as const

// ==========================================
// CIRCUIT BREAKER for Redis
// ==========================================
// Prevents cascading failures when Redis is temporarily unavailable

interface CircuitBreakerState {
  failures: number
  lastFailure: number
  state: 'closed' | 'open' | 'half-open'
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  state: 'closed',
}

const CIRCUIT_FAILURE_THRESHOLD = 5 // Open after 5 failures
const CIRCUIT_RESET_TIMEOUT = 30000 // Try again after 30 seconds

function recordCircuitSuccess(): void {
  circuitBreaker.failures = 0
  circuitBreaker.state = 'closed'
}

function recordCircuitFailure(): void {
  circuitBreaker.failures++
  circuitBreaker.lastFailure = Date.now()
  if (circuitBreaker.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitBreaker.state = 'open'
    console.warn('[Redis] Circuit breaker OPEN - Redis calls will be skipped temporarily')
  }
}

function isCircuitOpen(): boolean {
  if (circuitBreaker.state === 'closed') {
    return false
  }

  if (circuitBreaker.state === 'open') {
    // Check if we should try half-open
    if (Date.now() - circuitBreaker.lastFailure > CIRCUIT_RESET_TIMEOUT) {
      circuitBreaker.state = 'half-open'
      return false // Allow one request through
    }
    return true
  }

  // half-open - allow requests
  return false
}

/**
 * Generic cache get with fallback
 * Returns cached data if available, otherwise calls fallback and caches result
 * IMPROVED: Added circuit breaker and proper error handling
 */
export async function cacheGet<T>(
  key: string,
  fallback: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const redis = getRedis()

  // If Redis not configured or circuit is open, just call fallback
  if (!redis || isCircuitOpen()) {
    return fallback()
  }

  try {
    // Try to get from cache
    const cached = await redis.get<T>(key)
    recordCircuitSuccess()

    if (cached !== null) {
      return cached
    }

    // Cache miss - call fallback
    const data = await fallback()

    // Store in cache with proper error handling (not fire-and-forget)
    try {
      await redis.set(key, data, { ex: ttlSeconds })
    } catch (setErr) {
      console.error('[Redis] Failed to set cache:', { key, error: setErr })
      recordCircuitFailure()
      // Don't throw - cache write failure shouldn't break the app
    }

    return data
  } catch (error) {
    console.error('[Redis] Cache error, falling back:', { key, error })
    recordCircuitFailure()
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

// ==========================================
// REDIS-BASED RATE LIMITING
// ==========================================
// Replaces in-memory Map-based rate limiting for proper scaling

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit using Redis sliding window
 * MUCH better than in-memory Map which leaks memory at scale
 *
 * @param identifier - User ID, IP, or other unique identifier
 * @param limit - Max requests allowed in the window
 * @param windowSeconds - Time window in seconds
 * @param prefix - Key prefix (e.g., 'leaderboard', 'api')
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowSeconds: number = 60,
  prefix: string = 'ratelimit'
): Promise<RateLimitResult> {
  const redis = getRedis()
  const now = Date.now()
  const resetAt = now + windowSeconds * 1000

  // Fallback if Redis not available - be permissive
  if (!redis || isCircuitOpen()) {
    return { success: true, remaining: limit, resetAt }
  }

  const key = `${prefix}:${identifier}:${Math.floor(now / (windowSeconds * 1000))}`

  try {
    const count = await redis.incr(key)

    // Set expiry on first request in window
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }

    recordCircuitSuccess()

    const remaining = Math.max(0, limit - count)
    return {
      success: count <= limit,
      remaining,
      resetAt,
    }
  } catch (error) {
    console.error('[Redis] Rate limit check failed:', { identifier, error })
    recordCircuitFailure()
    // On error, be permissive to avoid breaking the app
    return { success: true, remaining: limit, resetAt }
  }
}

/**
 * Get rate limit status without incrementing (for checking remaining)
 */
export async function getRateLimitStatus(
  identifier: string,
  limit: number = 60,
  windowSeconds: number = 60,
  prefix: string = 'ratelimit'
): Promise<RateLimitResult> {
  const redis = getRedis()
  const now = Date.now()
  const resetAt = now + windowSeconds * 1000

  if (!redis || isCircuitOpen()) {
    return { success: true, remaining: limit, resetAt }
  }

  const key = `${prefix}:${identifier}:${Math.floor(now / (windowSeconds * 1000))}`

  try {
    const count = await redis.get<number>(key) ?? 0
    recordCircuitSuccess()

    const remaining = Math.max(0, limit - count)
    return {
      success: count < limit,
      remaining,
      resetAt,
    }
  } catch (error) {
    recordCircuitFailure()
    return { success: true, remaining: limit, resetAt }
  }
}

export { getRedis }
