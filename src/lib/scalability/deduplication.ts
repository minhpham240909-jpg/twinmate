/**
 * Request Deduplication
 *
 * Prevents duplicate API requests from concurrent users clicking the same button
 * or rapid navigation causing multiple identical requests.
 *
 * SCALABILITY: Critical for handling 1000-3000 concurrent users
 *
 * Features:
 * - In-flight request tracking with atomic operations
 * - Grace period for duplicate detection
 * - Automatic cleanup
 * - Per-user and global deduplication
 * - FIX: Race condition prevention using atomic check-and-set
 */

import { SCALABILITY_CONFIG } from './config'
import logger from '@/lib/logger'

interface InFlightRequest<T> {
  promise: Promise<T>
  timestamp: number
  userId?: string
}

// In-flight request cache
const inFlightRequests = new Map<string, InFlightRequest<unknown>>()

// Recent completed requests (for grace period)
const recentCompleted = new Map<string, { timestamp: number; result: unknown }>()

// FIX: Lock set to prevent race conditions during check-and-set operations
const pendingLocks = new Set<string>()

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
  // FIX: Check if there's a pending lock (another request in the process of being registered)
  if (pendingLocks.has(key)) {
    return true
  }

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
 * FIX: Atomic check-and-acquire lock to prevent race conditions
 * Returns true if lock was acquired, false if already locked
 */
function tryAcquireLock(key: string): boolean {
  if (pendingLocks.has(key) || inFlightRequests.has(key)) {
    return false
  }
  pendingLocks.add(key)
  return true
}

/**
 * Release the pending lock
 */
function releaseLock(key: string): void {
  pendingLocks.delete(key)
}

/**
 * Execute a request with deduplication
 * FIX: Uses atomic lock to prevent race condition between check and set
 *
 * @param key - Deduplication key
 * @param execute - Function to execute if not a duplicate
 * @returns Promise with result
 */
export async function withDeduplication<T>(
  key: string,
  execute: () => Promise<T>
): Promise<T> {
  // Check for in-flight duplicate first
  const existingInFlight = inFlightRequests.get(key)
  if (existingInFlight) {
    logger.debug(`Returning in-flight request: ${key}`)
    return existingInFlight.promise as Promise<T>
  }

  // Check for recently completed duplicate
  const recent = recentCompleted.get(key)
  if (recent) {
    const age = Date.now() - recent.timestamp
    if (age < SCALABILITY_CONFIG.deduplication.gracePeriodMs) {
      logger.debug(`Returning cached result: ${key} (${age}ms old)`)
      return recent.result as T
    }
  }

  // FIX: Try to acquire lock atomically
  if (!tryAcquireLock(key)) {
    // Another request beat us - wait for the in-flight request
    // Small delay to allow the other request to register
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Check again for the in-flight request
    const newInFlight = inFlightRequests.get(key)
    if (newInFlight) {
      logger.debug(`Returning concurrent in-flight request: ${key}`)
      return newInFlight.promise as Promise<T>
    }
    
    // If still no in-flight, the other request may have failed/completed very quickly
    // Try to acquire lock again
    if (!tryAcquireLock(key)) {
      // Check completed cache
      const recentAfterWait = recentCompleted.get(key)
      if (recentAfterWait) {
        const ageAfterWait = Date.now() - recentAfterWait.timestamp
        if (ageAfterWait < SCALABILITY_CONFIG.deduplication.gracePeriodMs) {
          return recentAfterWait.result as T
        }
      }
      // Fall through to execute - very rare edge case
    }
  }

  // Execute the request
  const promise = execute()

  // Track as in-flight and release the pending lock
  inFlightRequests.set(key, {
    promise,
    timestamp: Date.now(),
  })
  releaseLock(key)

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
      logger.debug(`Cleaning up stuck in-flight request: ${key}`)
      inFlightRequests.delete(key)
    }
  }

  // Cleanup completed requests past grace period
  for (const [key, completed] of recentCompleted.entries()) {
    if (now - completed.timestamp > gracePeriod) {
      recentCompleted.delete(key)
    }
  }

  // FIX: Also cleanup any stale pending locks (shouldn't happen, but safety measure)
  // Pending locks should be very short-lived, if any exist for > 5 seconds, clear them
  pendingLocks.clear()
}

/**
 * Get deduplication stats
 */
export function getStats(): {
  inFlightCount: number
  recentCompletedCount: number
  pendingLocksCount: number
} {
  return {
    inFlightCount: inFlightRequests.size,
    recentCompletedCount: recentCompleted.size,
    pendingLocksCount: pendingLocks.size,
  }
}

/**
 * Clear all caches (for testing)
 */
export function clearAll(): void {
  inFlightRequests.clear()
  recentCompleted.clear()
  pendingLocks.clear()
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
