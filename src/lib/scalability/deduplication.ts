/**
 * Request Deduplication
 *
 * Prevents duplicate API requests from concurrent users clicking the same button
 * or rapid navigation causing multiple identical requests.
 *
 * SCALABILITY: Critical for handling 1000-3000 concurrent users
 *
 * Features:
 * - In-flight request tracking
 * - Grace period for duplicate detection
 * - Automatic cleanup
 * - Per-user and global deduplication
 */

import { SCALABILITY_CONFIG } from './config'

interface InFlightRequest<T> {
  promise: Promise<T>
  timestamp: number
  userId?: string
}

// In-flight request cache
const inFlightRequests = new Map<string, InFlightRequest<unknown>>()

// Recent completed requests (for grace period)
const recentCompleted = new Map<string, { timestamp: number; result: unknown }>()

/**
 * Generate a deduplication key from request parameters
 */
export function generateDedupeKey(params: {
  action: string
  userId?: string
  payload?: unknown
}): string {
  const { action, userId, payload } = params

  // Create a deterministic key from parameters
  const payloadStr = payload
    ? JSON.stringify(payload, Object.keys(payload as object).sort())
    : ''

  // Hash the payload for shorter keys
  const payloadHash = payloadStr
    ? Buffer.from(payloadStr).toString('base64').slice(0, 20)
    : ''

  return userId
    ? `${userId}:${action}:${payloadHash}`
    : `global:${action}:${payloadHash}`
}

/**
 * Check if a request is a duplicate and should be deduplicated
 */
export function isDuplicate(key: string): boolean {
  // Check in-flight requests
  const inFlight = inFlightRequests.get(key)
  if (inFlight) {
    const age = Date.now() - inFlight.timestamp
    // Consider duplicate if request is still in-flight and recent
    if (age < SCALABILITY_CONFIG.deduplication.gracePeriodMs * 2) {
      return true
    }
  }

  // Check recently completed requests
  const recent = recentCompleted.get(key)
  if (recent) {
    const age = Date.now() - recent.timestamp
    if (age < SCALABILITY_CONFIG.deduplication.gracePeriodMs) {
      return true
    }
  }

  return false
}

/**
 * Get cached result if available
 */
export function getCachedResult<T>(key: string): T | null {
  // Return in-flight promise if exists
  const inFlight = inFlightRequests.get(key)
  if (inFlight) {
    return inFlight.promise as unknown as T
  }

  // Return recent completed result if exists
  const recent = recentCompleted.get(key)
  if (recent) {
    const age = Date.now() - recent.timestamp
    if (age < SCALABILITY_CONFIG.deduplication.gracePeriodMs) {
      return recent.result as T
    }
  }

  return null
}

/**
 * Execute a request with deduplication
 *
 * @param key - Deduplication key
 * @param execute - Function to execute if not a duplicate
 * @returns Promise with result
 */
export async function withDeduplication<T>(
  key: string,
  execute: () => Promise<T>
): Promise<T> {
  // Check for in-flight duplicate
  const inFlight = inFlightRequests.get(key)
  if (inFlight) {
    console.log(`[Deduplication] Returning in-flight request: ${key}`)
    return inFlight.promise as Promise<T>
  }

  // Check for recently completed duplicate
  const recent = recentCompleted.get(key)
  if (recent) {
    const age = Date.now() - recent.timestamp
    if (age < SCALABILITY_CONFIG.deduplication.gracePeriodMs) {
      console.log(`[Deduplication] Returning cached result: ${key} (${age}ms old)`)
      return recent.result as T
    }
  }

  // Execute the request
  const promise = execute()

  // Track as in-flight
  inFlightRequests.set(key, {
    promise,
    timestamp: Date.now(),
  })

  try {
    const result = await promise

    // Move to completed cache
    inFlightRequests.delete(key)
    recentCompleted.set(key, {
      timestamp: Date.now(),
      result,
    })

    return result
  } catch (error) {
    // Remove from in-flight on error
    inFlightRequests.delete(key)
    throw error
  }
}

/**
 * Cleanup old entries from caches
 */
export function cleanup(): void {
  const now = Date.now()
  const gracePeriod = SCALABILITY_CONFIG.deduplication.gracePeriodMs * 2

  // Cleanup in-flight requests that are too old (probably stuck)
  for (const [key, request] of inFlightRequests.entries()) {
    if (now - request.timestamp > 60000) {
      // 1 minute timeout for stuck requests
      console.log(`[Deduplication] Cleaning up stuck in-flight request: ${key}`)
      inFlightRequests.delete(key)
    }
  }

  // Cleanup completed requests past grace period
  for (const [key, completed] of recentCompleted.entries()) {
    if (now - completed.timestamp > gracePeriod) {
      recentCompleted.delete(key)
    }
  }
}

/**
 * Get deduplication stats
 */
export function getStats(): {
  inFlightCount: number
  recentCompletedCount: number
} {
  return {
    inFlightCount: inFlightRequests.size,
    recentCompletedCount: recentCompleted.size,
  }
}

/**
 * Clear all caches (for testing)
 */
export function clearAll(): void {
  inFlightRequests.clear()
  recentCompleted.clear()
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, SCALABILITY_CONFIG.deduplication.cleanupIntervalMs)
}

export default {
  generateDedupeKey,
  isDuplicate,
  getCachedResult,
  withDeduplication,
  cleanup,
  getStats,
  clearAll,
}
