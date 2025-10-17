/**
 * Rate Limiting Utility
 * Protects API routes from abuse using Upstash Redis
 *
 * Usage in API routes:
 * ```typescript
 * import { rateLimit } from '@/lib/rate-limit'
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request, { max: 5, windowMs: 60000 })
 *   if (!rateLimitResult.success) {
 *     return NextResponse.json(
 *       { error: 'Too many requests' },
 *       {
 *         status: 429,
 *         headers: rateLimitResult.headers
 *       }
 *     )
 *   }
 *   // ... rest of API logic
 * }
 * ```
 */

import { NextRequest } from 'next/server'

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   * @default 10
   */
  max?: number

  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number

  /**
   * Custom key suffix for different rate limit buckets
   * @default undefined
   */
  keyPrefix?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  headers: Record<string, string>
}

// In-memory store for development (use Upstash Redis in production)
const memoryStore = new Map<string, { count: number; resetTime: number }>()

// Cleanup old entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of memoryStore.entries()) {
      if (value.resetTime < now) {
        memoryStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Get client identifier from request
 * Uses IP address or user ID for authenticated requests
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from headers (works with Vercel/proxy)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  const ip = forwarded?.split(',')[0].trim() || realIp || 'unknown'

  // TODO: Add user ID for authenticated requests
  // const userId = request.cookies.get('user-id')?.value
  // if (userId) return `user:${userId}`

  return `ip:${ip}`
}

/**
 * Check if request should be rate limited using Upstash Redis
 * Falls back to in-memory store in development
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = {}
): Promise<RateLimitResult> {
  const {
    max = 10,
    windowMs = 60 * 1000, // 1 minute default
    keyPrefix = '',
  } = config

  const clientId = getClientId(request)
  const key = keyPrefix ? `${keyPrefix}:${clientId}` : clientId

  // Check if we should use Upstash Redis (production)
  const useRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

  if (useRedis) {
    return await rateLimitWithRedis(key, max, windowMs)
  } else {
    return rateLimitWithMemory(key, max, windowMs)
  }
}

/**
 * Rate limit using Upstash Redis (production)
 */
async function rateLimitWithRedis(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    const now = Date.now()
    const resetTime = now + windowMs

    // Use Redis pipeline for atomic operations
    const pipeline = [
      ['INCR', key],
      ['PEXPIRE', key, windowMs],
      ['TTL', key],
    ]

    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    })

    if (!response.ok) {
      console.error('Upstash Redis error:', await response.text())
      // Fallback to memory on Redis error
      return rateLimitWithMemory(key, max, windowMs)
    }

    const results = await response.json() as Array<{ result: number }>
    const count = results[0].result
    const ttl = results[2].result // TTL in seconds

    const remaining = Math.max(0, max - count)
    const reset = Math.floor((now + (ttl * 1000)) / 1000) // Unix timestamp in seconds

    const headers: Record<string, string> = {
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    }

    if (count > max) {
      headers['Retry-After'] = ttl.toString()
      return {
        success: false,
        limit: max,
        remaining: 0,
        reset,
        headers,
      }
    }

    return {
      success: true,
      limit: max,
      remaining,
      reset,
      headers,
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // Fallback to memory on error
    return rateLimitWithMemory(key, max, windowMs)
  }
}

/**
 * Rate limit using in-memory store (development/fallback)
 */
function rateLimitWithMemory(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const record = memoryStore.get(key)

  if (!record || record.resetTime < now) {
    // New window
    const resetTime = now + windowMs
    memoryStore.set(key, { count: 1, resetTime })

    return {
      success: true,
      limit: max,
      remaining: max - 1,
      reset: Math.floor(resetTime / 1000),
      headers: {
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': (max - 1).toString(),
        'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(),
      },
    }
  }

  // Increment count
  record.count++
  memoryStore.set(key, record)

  const remaining = Math.max(0, max - record.count)
  const reset = Math.floor(record.resetTime / 1000)

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': max.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  }

  if (record.count > max) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    headers['Retry-After'] = retryAfter.toString()

    return {
      success: false,
      limit: max,
      remaining: 0,
      reset,
      headers,
    }
  }

  return {
    success: true,
    limit: max,
    remaining,
    reset,
    headers,
  }
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  /** 3 requests per minute - for signup/auth */
  auth: { max: 3, windowMs: 60 * 1000, keyPrefix: 'auth' },

  /** 5 requests per minute - for sensitive operations */
  strict: { max: 5, windowMs: 60 * 1000, keyPrefix: 'strict' },

  /** 20 requests per minute - for messaging/posting */
  moderate: { max: 20, windowMs: 60 * 1000, keyPrefix: 'moderate' },

  /** 100 requests per minute - for read operations */
  lenient: { max: 100, windowMs: 60 * 1000, keyPrefix: 'lenient' },

  /** 10 requests per hour - for expensive operations */
  hourly: { max: 10, windowMs: 60 * 60 * 1000, keyPrefix: 'hourly' },
}
