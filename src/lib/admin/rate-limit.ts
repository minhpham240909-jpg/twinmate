// Admin API Rate Limiting
// Provides rate limiting for admin APIs to prevent abuse and ensure fair usage
// Uses in-memory store with Upstash REST API for distributed environments

import { NextRequest, NextResponse } from 'next/server'
import { isRedisConfigured } from '@/lib/cache'

// =====================================================
// TYPES
// =====================================================

interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
  keyPrefix?: string    // Prefix for rate limit keys
  message?: string      // Error message when rate limited
  skipFailedRequests?: boolean  // Don't count failed requests
  skipSuccessfulRequests?: boolean // Don't count successful requests
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// =====================================================
// IN-MEMORY STORE (Fallback)
// =====================================================

const inMemoryStore = new Map<string, RateLimitEntry>()

// Cleanup expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of inMemoryStore.entries()) {
      if (entry.resetTime < now) {
        inMemoryStore.delete(key)
      }
    }
  }, 60000)
}

// =====================================================
// RATE LIMIT PRESETS
// =====================================================

export const ADMIN_RATE_LIMITS = {
  // Standard API endpoints
  default: {
    windowMs: 60000,        // 1 minute
    maxRequests: 100,       // 100 requests per minute
    keyPrefix: 'admin:rl:default',
    message: 'Too many requests. Please slow down.',
  },

  // Dashboard data (frequently refreshed)
  dashboard: {
    windowMs: 60000,        // 1 minute
    maxRequests: 30,        // 30 requests per minute
    keyPrefix: 'admin:rl:dashboard',
    message: 'Dashboard refresh rate exceeded. Data is cached for efficiency.',
  },

  // Search endpoints (can be expensive)
  search: {
    windowMs: 60000,        // 1 minute
    maxRequests: 20,        // 20 searches per minute
    keyPrefix: 'admin:rl:search',
    message: 'Search rate limit exceeded. Please wait before searching again.',
  },

  // User actions (ban, warn, etc.)
  userActions: {
    windowMs: 60000,        // 1 minute
    maxRequests: 30,        // 30 actions per minute
    keyPrefix: 'admin:rl:actions',
    message: 'Action rate limit exceeded. Please slow down.',
  },

  // Bulk operations
  bulk: {
    windowMs: 300000,       // 5 minutes
    maxRequests: 10,        // 10 bulk operations per 5 minutes
    keyPrefix: 'admin:rl:bulk',
    message: 'Bulk operation limit exceeded. Please wait before performing more bulk actions.',
  },

  // Export operations (expensive)
  export: {
    windowMs: 300000,       // 5 minutes
    maxRequests: 5,         // 5 exports per 5 minutes
    keyPrefix: 'admin:rl:export',
    message: 'Export rate limit exceeded. Please wait before exporting more data.',
  },

  // Analytics queries (heavy database load)
  analytics: {
    windowMs: 60000,        // 1 minute
    maxRequests: 15,        // 15 queries per minute
    keyPrefix: 'admin:rl:analytics',
    message: 'Analytics query limit exceeded. Data is cached for efficiency.',
  },

  // AI monitoring (moderate load)
  aiMonitoring: {
    windowMs: 60000,        // 1 minute
    maxRequests: 20,        // 20 requests per minute
    keyPrefix: 'admin:rl:ai',
    message: 'AI monitoring rate limit exceeded.',
  },
} as const

// =====================================================
// RATE LIMITER CLASS
// =====================================================

class RateLimiter {
  private config: Required<RateLimitConfig>

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix || 'admin:rl',
      message: config.message || 'Too many requests',
      skipFailedRequests: config.skipFailedRequests || false,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    }
  }

  /**
   * Check if a request should be rate limited
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`
    const now = Date.now()

    try {
      // Try Upstash Redis first
      if (isRedisConfigured()) {
        return await this.checkLimitRedis(key, now)
      }
    } catch (error) {
      console.warn('[RateLimiter] Redis unavailable, using in-memory store')
    }

    // Fallback to in-memory
    return this.checkLimitMemory(key, now)
  }

  /**
   * Upstash Redis-based rate limiting (distributed)
   * Uses simple counter with TTL for efficiency
   */
  private async checkLimitRedis(key: string, now: number): Promise<RateLimitResult> {
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!
    const ttlSeconds = Math.ceil(this.config.windowMs / 1000)

    try {
      // Increment counter and get current value
      const incrResponse = await fetch(`${url}/incr/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!incrResponse.ok) {
        throw new Error('Redis INCR failed')
      }

      const incrResult = await incrResponse.json()
      const count = incrResult.result as number

      // Set expiry if this is the first request in the window
      if (count === 1) {
        await fetch(`${url}/expire/${key}/${ttlSeconds}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      const resetTime = now + this.config.windowMs
      const allowed = count <= this.config.maxRequests

      return {
        allowed,
        remaining: Math.max(0, this.config.maxRequests - count),
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
      }
    } catch (error) {
      console.error('[RateLimiter] Redis error:', error)
      // Fallback to memory on error
      return this.checkLimitMemory(key, now)
    }
  }

  /**
   * In-memory rate limiting (single instance)
   */
  private checkLimitMemory(key: string, now: number): RateLimitResult {
    let entry = inMemoryStore.get(key)

    // Reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      }
    }

    entry.count++
    inMemoryStore.set(key, entry)

    const allowed = entry.count <= this.config.maxRequests

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  /**
   * Get rate limit headers for response
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
      ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
    }
  }

  /**
   * Get error response when rate limited
   */
  getRateLimitedResponse(result: RateLimitResult): NextResponse {
    return NextResponse.json(
      {
        error: this.config.message,
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: this.getHeaders(result),
      }
    )
  }
}

// =====================================================
// MIDDLEWARE HELPER
// =====================================================

/**
 * Create a rate limit middleware for admin API routes
 *
 * Usage:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const rateLimitResult = await adminRateLimit(req, 'dashboard')
 *   if (rateLimitResult) return rateLimitResult // Returns 429 if rate limited
 *
 *   // ... rest of handler
 * }
 * ```
 */
export async function adminRateLimit(
  req: NextRequest,
  preset: keyof typeof ADMIN_RATE_LIMITS = 'default',
  customIdentifier?: string
): Promise<NextResponse | null> {
  const config = ADMIN_RATE_LIMITS[preset]
  const limiter = new RateLimiter(config)

  // Extract admin identifier from request
  // Priority: custom identifier > auth header > IP
  let identifier = customIdentifier

  if (!identifier) {
    // Try to get user ID from auth header or cookie
    const authHeader = req.headers.get('authorization')
    const sessionCookie = req.cookies.get('sb-auth-token')?.value

    if (authHeader) {
      // Use a hash of the auth token as identifier
      identifier = `auth:${hashString(authHeader)}`
    } else if (sessionCookie) {
      identifier = `session:${hashString(sessionCookie)}`
    } else {
      // Fall back to IP address
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                 req.headers.get('x-real-ip') ||
                 'unknown'
      identifier = `ip:${ip}`
    }
  }

  const result = await limiter.checkLimit(identifier)

  if (!result.allowed) {
    console.warn(`[RateLimit] ${preset} limit exceeded for ${identifier}`)
    return limiter.getRateLimitedResponse(result)
  }

  return null
}

/**
 * Create rate limit headers to add to successful responses
 */
export async function getRateLimitHeaders(
  req: NextRequest,
  preset: keyof typeof ADMIN_RATE_LIMITS = 'default'
): Promise<Record<string, string>> {
  const config = ADMIN_RATE_LIMITS[preset]
  const limiter = new RateLimiter(config)

  // Simple identifier extraction for headers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
             req.headers.get('x-real-ip') ||
             'unknown'

  const result = await limiter.checkLimit(`ip:${ip}`)
  return limiter.getHeaders(result)
}

// =====================================================
// UTILITIES
// =====================================================

/**
 * Simple hash function for identifiers
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Clear rate limit for an identifier (for testing or admin override)
 */
export async function clearRateLimit(identifier: string, preset: keyof typeof ADMIN_RATE_LIMITS = 'default'): Promise<void> {
  const config = ADMIN_RATE_LIMITS[preset]
  const key = `${config.keyPrefix}:${identifier}`

  try {
    if (isRedisConfigured()) {
      const url = process.env.UPSTASH_REDIS_REST_URL!
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!

      await fetch(`${url}/del/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch (error) {
    console.error('[RateLimiter] Error clearing rate limit:', error)
  }

  inMemoryStore.delete(key)
}

/**
 * Get current rate limit status for an identifier
 */
export async function getRateLimitStatus(
  identifier: string,
  preset: keyof typeof ADMIN_RATE_LIMITS = 'default'
): Promise<RateLimitResult> {
  const config = ADMIN_RATE_LIMITS[preset]
  const limiter = new RateLimiter(config)
  return limiter.checkLimit(identifier)
}
