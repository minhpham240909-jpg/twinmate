/**
 * AI Usage Quota System
 *
 * Enforces per-user daily limits for AI usage to prevent abuse and control costs.
 * Uses Upstash Redis for fast quota checks across serverless instances.
 *
 * Features:
 * - Daily token, cost, and request limits
 * - Warning threshold before hard block
 * - Redis-based for distributed quota tracking
 * - Automatic daily reset
 * - Fallback to database if Redis unavailable
 */

import { prisma } from '@/lib/prisma'
import { AI_QUOTAS } from '@/lib/constants'
import logger from '@/lib/logger'
import { fetchWithBackoff } from '@/lib/api/timeout'

// ============================================
// Upstash Redis Helpers (using REST API)
// ============================================

function isRedisAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function redisGet(key: string): Promise<string | null> {
  if (!isRedisAvailable()) return null

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    const response = await fetchWithBackoff(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }, { timeoutPerAttemptMs: 5000, maxRetries: 3 })

    if (!response.ok) return null

    const data = await response.json() as { result: string | null }
    return data.result
  } catch {
    return null
  }
}

async function redisSetEx(key: string, value: string, expirySeconds: number): Promise<boolean> {
  if (!isRedisAvailable()) return false

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    const response = await fetchWithBackoff(`${url}/setex/${encodeURIComponent(key)}/${expirySeconds}/${encodeURIComponent(value)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, { timeoutPerAttemptMs: 5000, maxRetries: 3 })

    return response.ok
  } catch {
    return false
  }
}

// Quota status types
export interface QuotaStatus {
  allowed: boolean
  reason?: 'exceeded_tokens' | 'exceeded_cost' | 'exceeded_requests' | 'warning'
  currentUsage: {
    tokens: number
    cost: number
    requests: number
  }
  limits: {
    tokens: number
    cost: number
    requests: number
  }
  percentUsed: {
    tokens: number
    cost: number
    requests: number
  }
  resetAt: Date
  warning?: string
}

// Redis key prefix
const QUOTA_KEY_PREFIX = 'ai:quota:'

/**
 * Get the quota reset time for today (midnight UTC by default)
 */
function getQuotaResetTime(): Date {
  const now = new Date()
  const resetHour = AI_QUOTAS.RESET_HOUR_UTC

  // If current hour is past reset hour, next reset is tomorrow
  if (now.getUTCHours() >= resetHour) {
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      resetHour,
      0,
      0,
      0
    ))
  }

  // Otherwise, reset is today at the reset hour
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    resetHour,
    0,
    0,
    0
  ))
}

/**
 * Get the start of the current quota period
 */
function getQuotaPeriodStart(): Date {
  const now = new Date()
  const resetHour = AI_QUOTAS.RESET_HOUR_UTC

  // If current hour is past or at reset hour, period started today
  if (now.getUTCHours() >= resetHour) {
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      resetHour,
      0,
      0,
      0
    ))
  }

  // Otherwise, period started yesterday
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
    resetHour,
    0,
    0,
    0
  ))
}

/**
 * Get Redis key for user quota
 */
function getQuotaKey(userId: string): string {
  const periodStart = getQuotaPeriodStart()
  const dateKey = periodStart.toISOString().split('T')[0]
  return `${QUOTA_KEY_PREFIX}${userId}:${dateKey}`
}

/**
 * Get current usage from Redis (reads from atomic keys)
 */
async function getUsageFromRedis(userId: string): Promise<{
  tokens: number
  cost: number
  requests: number
} | null> {
  if (!isRedisAvailable()) return null

  try {
    const key = getQuotaKey(userId)
    const tokenKey = `${key}:tokens`
    const costKey = `${key}:cost`
    const requestsKey = `${key}:requests`

    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    // Fetch all values in parallel
    const [tokensRes, costRes, requestsRes] = await Promise.all([
      fetchWithBackoff(`${url}/get/${encodeURIComponent(tokenKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 3000, maxRetries: 2 }),
      fetchWithBackoff(`${url}/get/${encodeURIComponent(costKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 3000, maxRetries: 2 }),
      fetchWithBackoff(`${url}/get/${encodeURIComponent(requestsKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 3000, maxRetries: 2 }),
    ])

    let tokens = 0
    let cost = 0
    let requests = 0

    if (tokensRes.ok) {
      const data = await tokensRes.json() as { result: string | null }
      tokens = data.result ? parseInt(data.result, 10) : 0
    }
    if (costRes.ok) {
      const data = await costRes.json() as { result: string | null }
      cost = data.result ? parseFloat(data.result) : 0
    }
    if (requestsRes.ok) {
      const data = await requestsRes.json() as { result: string | null }
      requests = data.result ? parseInt(data.result, 10) : 0
    }

    return { tokens, cost, requests }
  } catch (error) {
    logger.warn('[AI Quota] Redis get failed', { userId, error })
    return null
  }
}

/**
 * Get current usage from database (fallback)
 */
async function getUsageFromDatabase(userId: string): Promise<{
  tokens: number
  cost: number
  requests: number
}> {
  try {
    const periodStart = getQuotaPeriodStart()

    const result = await prisma.aIUsageLog.aggregate({
      where: {
        userId,
        createdAt: { gte: periodStart },
      },
      _sum: {
        totalTokens: true,
        estimatedCost: true,
      },
      _count: {
        id: true,
      },
    })

    return {
      tokens: result._sum.totalTokens || 0,
      cost: result._sum.estimatedCost || 0,
      requests: result._count.id || 0,
    }
  } catch (error) {
    logger.warn('[AI Quota] Database lookup failed', { userId, error })
    return { tokens: 0, cost: 0, requests: 0 }
  }
}

/**
 * Check if user has quota available
 */
export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const limits = {
    tokens: AI_QUOTAS.DAILY_TOKEN_LIMIT,
    cost: AI_QUOTAS.DAILY_COST_LIMIT,
    requests: AI_QUOTAS.DAILY_REQUEST_LIMIT,
  }

  // Try Redis first, fallback to database
  let usage = await getUsageFromRedis(userId)
  if (usage === null) {
    usage = await getUsageFromDatabase(userId)
  }

  const percentUsed = {
    tokens: limits.tokens > 0 ? (usage.tokens / limits.tokens) * 100 : 0,
    cost: limits.cost > 0 ? (usage.cost / limits.cost) * 100 : 0,
    requests: limits.requests > 0 ? (usage.requests / limits.requests) * 100 : 0,
  }

  const resetAt = getQuotaResetTime()

  // Check if any limit is exceeded
  if (usage.tokens >= limits.tokens) {
    return {
      allowed: false,
      reason: 'exceeded_tokens',
      currentUsage: usage,
      limits,
      percentUsed,
      resetAt,
    }
  }

  if (usage.cost >= limits.cost) {
    return {
      allowed: false,
      reason: 'exceeded_cost',
      currentUsage: usage,
      limits,
      percentUsed,
      resetAt,
    }
  }

  if (usage.requests >= limits.requests) {
    return {
      allowed: false,
      reason: 'exceeded_requests',
      currentUsage: usage,
      limits,
      percentUsed,
      resetAt,
    }
  }

  // Check for warning threshold
  const warningThreshold = AI_QUOTAS.WARNING_THRESHOLD * 100
  let warning: string | undefined

  if (percentUsed.tokens >= warningThreshold) {
    warning = `You've used ${Math.round(percentUsed.tokens)}% of your daily AI tokens. Limit resets at ${resetAt.toISOString()}.`
  } else if (percentUsed.cost >= warningThreshold) {
    warning = `You've used ${Math.round(percentUsed.cost)}% of your daily AI budget. Limit resets at ${resetAt.toISOString()}.`
  } else if (percentUsed.requests >= warningThreshold) {
    warning = `You've used ${Math.round(percentUsed.requests)}% of your daily AI requests. Limit resets at ${resetAt.toISOString()}.`
  }

  return {
    allowed: true,
    reason: warning ? 'warning' : undefined,
    currentUsage: usage,
    limits,
    percentUsed,
    resetAt,
    warning,
  }
}

/**
 * Record usage and update quota
 */
export async function recordUsage(
  userId: string,
  tokens: number,
  cost: number
): Promise<void> {
  if (!isRedisAvailable()) {
    // Usage will be tracked in AIUsageLog table by monitoring.ts
    return
  }

  try {
    const key = getQuotaKey(userId)
    const resetAt = getQuotaResetTime()
    const ttlSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000)

    // Use atomic INCRBY operations via Upstash REST API to prevent race conditions
    // This avoids the read-modify-write race condition
    const url = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!

    // Use HINCRBY for atomic increments on hash fields
    // First, ensure the key has proper TTL
    const tokenKey = `${key}:tokens`
    const costKey = `${key}:cost`
    const requestsKey = `${key}:requests`

    // Execute atomic increments in parallel
    const [tokensRes, costRes, requestsRes] = await Promise.all([
      fetchWithBackoff(`${url}/incrby/${encodeURIComponent(tokenKey)}/${tokens}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 5000, maxRetries: 2 }),
      fetchWithBackoff(`${url}/incrbyfloat/${encodeURIComponent(costKey)}/${cost}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 5000, maxRetries: 2 }),
      fetchWithBackoff(`${url}/incrby/${encodeURIComponent(requestsKey)}/1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 5000, maxRetries: 2 }),
    ])

    // Set TTL on all keys (fire and forget - they'll expire anyway)
    Promise.all([
      fetchWithBackoff(`${url}/expire/${encodeURIComponent(tokenKey)}/${Math.max(ttlSeconds, 1)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 3000, maxRetries: 1 }),
      fetchWithBackoff(`${url}/expire/${encodeURIComponent(costKey)}/${Math.max(ttlSeconds, 1)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 3000, maxRetries: 1 }),
      fetchWithBackoff(`${url}/expire/${encodeURIComponent(requestsKey)}/${Math.max(ttlSeconds, 1)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, { timeoutPerAttemptMs: 3000, maxRetries: 1 }),
    ]).catch(() => {
      // TTL set is best effort - keys will be orphaned but eventually evicted
    })

    // Parse results for logging
    let totalTokens = tokens
    let totalCost = cost
    let totalRequests = 1
    try {
      if (tokensRes.ok) {
        const data = await tokensRes.json() as { result: number }
        totalTokens = data.result
      }
      if (costRes.ok) {
        const data = await costRes.json() as { result: string }
        totalCost = parseFloat(data.result)
      }
      if (requestsRes.ok) {
        const data = await requestsRes.json() as { result: number }
        totalRequests = data.result
      }
    } catch {
      // Logging parse error is non-critical
    }

    logger.debug('[AI Quota] Usage recorded atomically', {
      userId,
      tokens,
      cost,
      totalTokens,
      totalCost,
      totalRequests,
    })
  } catch (error) {
    logger.warn('[AI Quota] Failed to record usage in Redis', { userId, error })
    // Non-critical - monitoring.ts will still track in database
  }
}

/**
 * Get formatted error message for quota exceeded
 */
export function getQuotaExceededMessage(status: QuotaStatus): string {
  const resetTime = status.resetAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })

  switch (status.reason) {
    case 'exceeded_tokens':
      return `You've reached your daily AI usage limit. Your limit resets at ${resetTime} UTC.`
    case 'exceeded_cost':
      return `You've reached your daily AI budget. Your limit resets at ${resetTime} UTC.`
    case 'exceeded_requests':
      return `You've made too many AI requests today. Your limit resets at ${resetTime} UTC.`
    default:
      return `Daily AI limit reached. Please try again after ${resetTime} UTC.`
  }
}

/**
 * Middleware-style quota check for API routes
 */
export async function enforceQuota(userId: string): Promise<{
  allowed: boolean
  error?: { message: string; status: number }
  warning?: string
}> {
  const status = await checkQuota(userId)

  if (!status.allowed) {
    return {
      allowed: false,
      error: {
        message: getQuotaExceededMessage(status),
        status: 429,
      },
    }
  }

  return {
    allowed: true,
    warning: status.warning,
  }
}

/**
 * Get user's current quota status (for dashboard/UI)
 */
export async function getUserQuotaStatus(userId: string): Promise<{
  usage: {
    tokens: number
    cost: number
    requests: number
  }
  limits: {
    tokens: number
    cost: number
    requests: number
  }
  percentUsed: {
    tokens: number
    cost: number
    requests: number
  }
  resetAt: string
  isWarning: boolean
  isExceeded: boolean
}> {
  const status = await checkQuota(userId)

  return {
    usage: status.currentUsage,
    limits: status.limits,
    percentUsed: {
      tokens: Math.round(status.percentUsed.tokens * 10) / 10,
      cost: Math.round(status.percentUsed.cost * 10) / 10,
      requests: Math.round(status.percentUsed.requests * 10) / 10,
    },
    resetAt: status.resetAt.toISOString(),
    isWarning: status.reason === 'warning',
    isExceeded: !status.allowed,
  }
}
