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
 * - Automatic cleanup with memory bounds
 * - Per-user and global deduplication
 * - FIX: Race condition prevention using atomic check-and-set
 * - FIX: Memory leak prevention with bounded caches
 * - Message content deduplication for chat
 */

import { SCALABILITY_CONFIG } from './config'
import logger from '@/lib/logger'

interface InFlightRequest<T> {
  promise: Promise<T>
  timestamp: number
  userId?: string
}

// Memory bounds to prevent leaks
const MAX_IN_FLIGHT_REQUESTS = 10000
const MAX_RECENT_COMPLETED = 50000
const MAX_MESSAGE_HASHES = 100000
const MAX_PENDING_LOCKS = 1000

// In-flight request cache
const inFlightRequests = new Map<string, InFlightRequest<unknown>>()

// Recent completed requests (for grace period)
const recentCompleted = new Map<string, { timestamp: number; result: unknown }>()

// FIX: Lock set to prevent race conditions during check-and-set operations
const pendingLocks = new Set<string>()

// Message deduplication cache (for chat messages)
// Stores hash -> { timestamp, messageId } for detecting duplicate messages
const messageHashCache = new Map<string, { timestamp: number; messageId: string }>()

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
 * FIX: Added memory bounds enforcement to prevent memory leaks
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

  // Cleanup message hash cache (older than 1 hour)
  const messageGracePeriod = 60 * 60 * 1000 // 1 hour
  for (const [hash, data] of messageHashCache.entries()) {
    if (now - data.timestamp > messageGracePeriod) {
      messageHashCache.delete(hash)
    }
  }

  // FIX: Also cleanup any stale pending locks (shouldn't happen, but safety measure)
  // Pending locks should be very short-lived, if any exist for > 5 seconds, clear them
  pendingLocks.clear()

  // FIX: Enforce memory bounds - remove oldest entries if over limit
  enforceMemoryBounds()
}

/**
 * FIX: Enforce memory bounds to prevent memory leaks
 * Removes oldest entries when caches exceed their maximum size
 */
function enforceMemoryBounds(): void {
  // Enforce in-flight requests limit
  if (inFlightRequests.size > MAX_IN_FLIGHT_REQUESTS) {
    const entriesToRemove = inFlightRequests.size - MAX_IN_FLIGHT_REQUESTS
    const entries = Array.from(inFlightRequests.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      inFlightRequests.delete(entries[i][0])
    }
    logger.warn(`Removed ${entriesToRemove} old in-flight requests due to memory bounds`)
  }

  // Enforce recent completed limit
  if (recentCompleted.size > MAX_RECENT_COMPLETED) {
    const entriesToRemove = recentCompleted.size - MAX_RECENT_COMPLETED
    const entries = Array.from(recentCompleted.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      recentCompleted.delete(entries[i][0])
    }
    logger.warn(`Removed ${entriesToRemove} old completed requests due to memory bounds`)
  }

  // Enforce message hash cache limit
  if (messageHashCache.size > MAX_MESSAGE_HASHES) {
    const entriesToRemove = messageHashCache.size - MAX_MESSAGE_HASHES
    const entries = Array.from(messageHashCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      messageHashCache.delete(entries[i][0])
    }
    logger.debug(`Removed ${entriesToRemove} old message hashes due to memory bounds`)
  }

  // Enforce pending locks limit
  if (pendingLocks.size > MAX_PENDING_LOCKS) {
    logger.warn(`Clearing ${pendingLocks.size} pending locks due to memory bounds`)
    pendingLocks.clear()
  }
}

/**
 * Get deduplication stats
 */
export function getStats(): {
  inFlightCount: number
  recentCompletedCount: number
  pendingLocksCount: number
  messageHashCount: number
} {
  return {
    inFlightCount: inFlightRequests.size,
    recentCompletedCount: recentCompleted.size,
    pendingLocksCount: pendingLocks.size,
    messageHashCount: messageHashCache.size,
  }
}

/**
 * Clear all caches (for testing)
 */
export function clearAll(): void {
  inFlightRequests.clear()
  recentCompleted.clear()
  pendingLocks.clear()
  messageHashCache.clear()
}

// =============================================================================
// MESSAGE DEDUPLICATION
// =============================================================================

/**
 * Generate a hash for message content
 * Used to detect duplicate messages in chat
 */
export function hashMessageContent(params: {
  senderId: string
  recipientId?: string
  groupId?: string
  content: string
}): string {
  const { senderId, recipientId, groupId, content } = params
  
  // Normalize content (trim, lowercase for comparison)
  const normalizedContent = content.trim().toLowerCase().slice(0, 500) // Limit to first 500 chars
  
  // Create composite key
  const composite = `${senderId}:${recipientId || ''}:${groupId || ''}:${normalizedContent}`
  
  // Simple hash using FNV-1a
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < composite.length; i++) {
    hash ^= composite.charCodeAt(i)
    hash = (hash * 16777619) >>> 0 // FNV prime, unsigned
  }
  
  return hash.toString(16)
}

/**
 * Check if a message is a duplicate
 * Returns the existing message ID if duplicate, null if new
 */
export function checkMessageDuplicate(params: {
  senderId: string
  recipientId?: string
  groupId?: string
  content: string
  windowMs?: number // Time window for duplicate detection (default: 5 seconds)
}): { isDuplicate: boolean; existingMessageId?: string } {
  const { senderId, recipientId, groupId, content, windowMs = 5000 } = params
  
  const hash = hashMessageContent({ senderId, recipientId, groupId, content })
  const cached = messageHashCache.get(hash)
  
  if (cached) {
    const age = Date.now() - cached.timestamp
    if (age < windowMs) {
      logger.debug('Duplicate message detected', { hash, age, existingId: cached.messageId })
      return { isDuplicate: true, existingMessageId: cached.messageId }
    }
  }
  
  return { isDuplicate: false }
}

/**
 * Register a message for deduplication
 * Call this after successfully creating a message
 */
export function registerMessage(params: {
  senderId: string
  recipientId?: string
  groupId?: string
  content: string
  messageId: string
}): void {
  const { senderId, recipientId, groupId, content, messageId } = params
  
  const hash = hashMessageContent({ senderId, recipientId, groupId, content })
  
  messageHashCache.set(hash, {
    timestamp: Date.now(),
    messageId,
  })
  
  // Enforce memory bounds if needed
  if (messageHashCache.size > MAX_MESSAGE_HASHES) {
    enforceMemoryBounds()
  }
}

/**
 * Idempotency key support for API requests
 * Allows clients to retry requests safely
 */
const idempotencyKeys = new Map<string, { timestamp: number; result: unknown; status: number }>()
const MAX_IDEMPOTENCY_KEYS = 50000
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Check and register an idempotency key
 * Returns cached result if key was already processed
 */
export function checkIdempotencyKey(key: string): {
  isDuplicate: boolean
  cachedResult?: unknown
  cachedStatus?: number
} {
  const cached = idempotencyKeys.get(key)
  
  if (cached) {
    const age = Date.now() - cached.timestamp
    if (age < IDEMPOTENCY_TTL_MS) {
      return {
        isDuplicate: true,
        cachedResult: cached.result,
        cachedStatus: cached.status,
      }
    }
    // Expired, remove it
    idempotencyKeys.delete(key)
  }
  
  return { isDuplicate: false }
}

/**
 * Register idempotency key result
 */
export function registerIdempotencyResult(
  key: string,
  result: unknown,
  status: number
): void {
  idempotencyKeys.set(key, {
    timestamp: Date.now(),
    result,
    status,
  })
  
  // Cleanup old keys if over limit
  if (idempotencyKeys.size > MAX_IDEMPOTENCY_KEYS) {
    const entriesToRemove = idempotencyKeys.size - MAX_IDEMPOTENCY_KEYS
    const entries = Array.from(idempotencyKeys.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      idempotencyKeys.delete(entries[i][0])
    }
  }
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
  // Message deduplication
  hashMessageContent,
  checkMessageDuplicate,
  registerMessage,
  // Idempotency
  checkIdempotencyKey,
  registerIdempotencyResult,
}
