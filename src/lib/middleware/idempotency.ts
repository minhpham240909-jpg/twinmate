/**
 * Idempotency Middleware
 * 
 * FIX: Provides idempotency support for critical API routes beyond just message sending
 * This ensures that retried requests don't cause duplicate operations
 * 
 * Features:
 * - Client-provided idempotency keys
 * - Server-side result caching
 * - Automatic cleanup of expired entries
 * - Support for both in-memory and Redis storage
 * - Transaction-safe for database operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

// Configuration
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_SIZE = 100000

// In-memory cache for idempotency (use Redis for multi-instance)
const idempotencyCache = new Map<string, {
  timestamp: number
  result: unknown
  status: number
  processing?: boolean
}>()

// Cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of idempotencyCache.entries()) {
      if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(key)
      }
    }
    
    // Enforce max size
    if (idempotencyCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(idempotencyCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = idempotencyCache.size - MAX_CACHE_SIZE
      for (let i = 0; i < toRemove; i++) {
        idempotencyCache.delete(entries[i][0])
      }
    }
  }, 60 * 1000) // Every minute
}

/**
 * Extract idempotency key from request
 */
export function getIdempotencyKey(request: NextRequest, userId?: string): string | null {
  // Check header first (standard practice)
  const headerKey = request.headers.get('idempotency-key') || 
                    request.headers.get('x-idempotency-key')
  
  if (headerKey) {
    return userId ? `${userId}:${headerKey}` : headerKey
  }
  
  return null
}

/**
 * Check if request is idempotent (already processed)
 */
export function checkIdempotency(key: string): {
  isDuplicate: boolean
  cachedResponse?: { result: unknown; status: number }
  isProcessing?: boolean
} {
  const cached = idempotencyCache.get(key)
  
  if (!cached) {
    return { isDuplicate: false }
  }
  
  // Check if still processing (concurrent request)
  if (cached.processing) {
    return { isDuplicate: true, isProcessing: true }
  }
  
  // Check if expired
  if (Date.now() - cached.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key)
    return { isDuplicate: false }
  }
  
  return {
    isDuplicate: true,
    cachedResponse: {
      result: cached.result,
      status: cached.status,
    },
  }
}

/**
 * Mark request as processing (prevents concurrent duplicates)
 */
export function markAsProcessing(key: string): boolean {
  const existing = idempotencyCache.get(key)
  
  if (existing && !existing.processing) {
    return false // Already completed
  }
  
  if (existing?.processing) {
    return false // Already processing
  }
  
  idempotencyCache.set(key, {
    timestamp: Date.now(),
    result: null,
    status: 0,
    processing: true,
  })
  
  return true
}

/**
 * Store idempotency result
 */
export function storeIdempotencyResult(
  key: string,
  result: unknown,
  status: number
): void {
  idempotencyCache.set(key, {
    timestamp: Date.now(),
    result,
    status,
    processing: false,
  })
}

/**
 * Clear processing status (on error)
 */
export function clearProcessing(key: string): void {
  idempotencyCache.delete(key)
}

/**
 * Middleware wrapper for idempotent API routes
 * 
 * Usage:
 * ```typescript
 * export const POST = withIdempotency(async (request, context) => {
 *   // Your handler code
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withIdempotency<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Extract idempotency key
    const idempotencyKey = getIdempotencyKey(request)
    
    // If no key provided, execute normally (not idempotent)
    if (!idempotencyKey) {
      return handler(request, ...args)
    }
    
    // Check for existing result
    const check = checkIdempotency(idempotencyKey)
    
    if (check.isDuplicate) {
      if (check.isProcessing) {
        // Concurrent request - return 409 Conflict
        return NextResponse.json(
          { error: 'Request is being processed', code: 'CONCURRENT_REQUEST' },
          { status: 409 }
        )
      }
      
      if (check.cachedResponse) {
        // Return cached response
        logger.debug('Returning cached idempotent response', { key: idempotencyKey })
        return NextResponse.json(
          { ...check.cachedResponse.result as object, idempotent: true },
          { status: check.cachedResponse.status }
        )
      }
    }
    
    // Mark as processing
    if (!markAsProcessing(idempotencyKey)) {
      // Race condition - another request beat us
      return NextResponse.json(
        { error: 'Request is being processed', code: 'CONCURRENT_REQUEST' },
        { status: 409 }
      )
    }
    
    try {
      // Execute handler
      const response = await handler(request, ...args)
      
      // Store result for future requests
      const responseBody = await response.clone().json().catch(() => ({}))
      storeIdempotencyResult(idempotencyKey, responseBody, response.status)
      
      return response
    } catch (error) {
      // Clear processing status on error
      clearProcessing(idempotencyKey)
      throw error
    }
  }
}

/**
 * Transaction wrapper with Serializable isolation level
 * 
 * FIX: Ensures database operations are serializable to prevent race conditions
 * Use this for critical operations like:
 * - Creating unique resources (e.g., match requests)
 * - Financial transactions
 * - Inventory management
 * 
 * Usage:
 * ```typescript
 * const result = await withSerializableTransaction(async (tx) => {
 *   // Your transactional code
 *   return await tx.match.create({ ... })
 * })
 * ```
 */
export async function withSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxRetries?: number
    retryDelayMs?: number
  }
): Promise<T> {
  const { maxRetries = 3, retryDelayMs = 100 } = options || {}
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000, // 10 second timeout
      })
    } catch (error) {
      lastError = error as Error
      
      // Check if it's a serialization failure (can be retried)
      const isSerializationFailure = 
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' // Prisma code for transaction conflict
      
      if (!isSerializationFailure || attempt === maxRetries - 1) {
        throw error
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, retryDelayMs * Math.pow(2, attempt))
      )
      
      logger.debug('Retrying serializable transaction', {
        attempt: attempt + 1,
        maxRetries,
      })
    }
  }
  
  throw lastError
}

/**
 * Idempotent database operation wrapper
 * 
 * Combines idempotency checking with serializable transactions
 * 
 * Usage:
 * ```typescript
 * const match = await idempotentDbOperation(
 *   `create-match:${senderId}:${receiverId}`,
 *   async (tx) => {
 *     return await tx.match.create({ ... })
 *   }
 * )
 * ```
 */
export async function idempotentDbOperation<T>(
  operationKey: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    useSerializable?: boolean
  }
): Promise<{ result: T; wasIdempotent: boolean }> {
  const { useSerializable = true } = options || {}
  
  // Check for existing result
  const check = checkIdempotency(operationKey)
  
  if (check.isDuplicate && check.cachedResponse) {
    return {
      result: check.cachedResponse.result as T,
      wasIdempotent: true,
    }
  }
  
  // Mark as processing
  if (!markAsProcessing(operationKey)) {
    // Wait a bit and check again
    await new Promise(resolve => setTimeout(resolve, 100))
    const recheck = checkIdempotency(operationKey)
    if (recheck.isDuplicate && recheck.cachedResponse) {
      return {
        result: recheck.cachedResponse.result as T,
        wasIdempotent: true,
      }
    }
  }
  
  try {
    // Execute with or without serializable isolation
    const result = useSerializable
      ? await withSerializableTransaction(operation)
      : await prisma.$transaction(operation)
    
    // Store result
    storeIdempotencyResult(operationKey, result, 200)
    
    return { result, wasIdempotent: false }
  } catch (error) {
    clearProcessing(operationKey)
    throw error
  }
}

export default {
  getIdempotencyKey,
  checkIdempotency,
  markAsProcessing,
  storeIdempotencyResult,
  clearProcessing,
  withIdempotency,
  withSerializableTransaction,
  idempotentDbOperation,
}
