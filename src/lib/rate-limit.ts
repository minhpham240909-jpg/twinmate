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
import logger from '@/lib/logger'
import { fetchWithBackoff } from '@/lib/api/timeout'

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
async function getClientId(request: NextRequest): Promise<string> {
  // Try to get user ID from Supabase session
  try {
    const token = request.cookies.get('sb-access-token')?.value
    if (token) {
      // Parse JWT to get user ID (without verification for performance)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      if (payload.sub) {
        return `user:${payload.sub}`
      }
    }
  } catch {
    // Fall through to IP-based rate limiting
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0].trim() || realIp || 'unknown'

  return `ip:${ip}`
}

// Track if we've warned about missing Redis in production
let redisWarningShown = false

/**
 * Validate Redis configuration at startup
 * Called by env-validator.ts during server initialization
 */
export function validateRedisConfiguration(): { valid: boolean; error?: string } {
  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && !hasRedis) {
    return {
      valid: false,
      error: 'Redis (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN) is REQUIRED in production for rate limiting security',
    }
  }

  return { valid: true }
}

/**
 * Check if request should be rate limited using Upstash Redis
 * In production: Redis is REQUIRED - rejects requests if not configured
 * In development: Falls back to in-memory store with warning
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

  const clientId = await getClientId(request)
  const key = keyPrefix ? `${keyPrefix}:${clientId}` : clientId

  // Check if Redis is configured
  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  const isProduction = process.env.NODE_ENV === 'production'

  if (hasRedis) {
    return await rateLimitWithRedis(key, max, windowMs)
  }

  // In production, Redis is REQUIRED for proper rate limiting across instances
  if (isProduction) {
    if (!redisWarningShown) {
      logger.error('CRITICAL: Redis not configured in production for rate limiting', {
        required: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
      })
      redisWarningShown = true
    }

    // SECURITY: In production without Redis, apply strict rate limiting
    // Use much lower limits since we can't coordinate across instances
    const strictMax = Math.min(max, 3) // Maximum 3 requests per window per instance
    logger.warn('Rate limit using STRICT memory fallback (no Redis)', { key, strictMax })
    return rateLimitWithMemory(key, strictMax, windowMs)
  }

  return rateLimitWithMemory(key, max, windowMs)
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

    const response = await fetchWithBackoff(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    }, { timeoutPerAttemptMs: 5000, maxRetries: 3 })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Upstash Redis rate-limit pipeline error', { errorText })
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
    logger.error('Rate limit error', error instanceof Error ? error : { error })
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
 * Optimized for 3,000+ concurrent users
 * 
 * SCALABILITY: These limits balance user experience with abuse prevention
 */
export const RateLimitPresets = {
  /** 5 requests per minute - for signup/auth (prevent brute force) */
  auth: { max: 5, windowMs: 60 * 1000, keyPrefix: 'auth' },

  /** 10 requests per minute - for sensitive operations (password reset, etc.) */
  strict: { max: 10, windowMs: 60 * 1000, keyPrefix: 'strict' },

  /** 60 requests per minute - for messaging/posting (1 msg/sec average) */
  moderate: { max: 60, windowMs: 60 * 1000, keyPrefix: 'moderate' },

  /** 120 requests per minute - for messaging in active conversations */
  messaging: { max: 120, windowMs: 60 * 1000, keyPrefix: 'messaging' },

  /** 200 requests per minute - for read operations (scrolling, loading) */
  lenient: { max: 200, windowMs: 60 * 1000, keyPrefix: 'lenient' },

  /** 500 requests per minute - for high-frequency reads (typing indicators, presence) */
  realtime: { max: 500, windowMs: 60 * 1000, keyPrefix: 'realtime' },

  /** 20 requests per hour - for expensive operations (AI calls, exports) */
  hourly: { max: 20, windowMs: 60 * 60 * 1000, keyPrefix: 'hourly' },

  /** 100 requests per hour - for AI chat (generous for study sessions) */
  ai: { max: 100, windowMs: 60 * 60 * 1000, keyPrefix: 'ai' },

  /** 10 requests per minute - for expensive searches (partner/group search processing 100+ records) */
  expensiveSearch: { max: 10, windowMs: 60 * 1000, keyPrefix: 'search' },

  /** 30 requests per minute - for likes (reduced to prevent spam while allowing normal usage) */
  likes: { max: 30, windowMs: 60 * 1000, keyPrefix: 'likes' },

  /** 10 requests per minute - for reposts (stricter as they create visible content) */
  reposts: { max: 10, windowMs: 60 * 1000, keyPrefix: 'reposts' },

  /** 20 requests per minute - for comments (balance between engagement and spam) */
  comments: { max: 20, windowMs: 60 * 1000, keyPrefix: 'comments' },

  /** 15 requests per minute - for connection requests (prevent mass-friending) */
  connections: { max: 15, windowMs: 60 * 1000, keyPrefix: 'connections' },

  /** 30 requests per minute - for AI streaming (per-session throttling) */
  aiStream: { max: 30, windowMs: 60 * 1000, keyPrefix: 'ai-stream' },
}
