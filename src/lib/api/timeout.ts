/**
 * API Request Timeout Utility
 *
 * Provides timeout protection for API routes to prevent long-running
 * requests from consuming resources indefinitely.
 *
 * Features:
 * - Configurable timeout per route
 * - Graceful timeout handling with proper error response
 * - Request abort signal support
 * - Logging for debugging
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

// Default timeout for API routes (60 seconds)
export const DEFAULT_API_TIMEOUT = 60000

// Shorter timeout for simple operations
export const QUICK_API_TIMEOUT = 15000

// Longer timeout for AI/complex operations
export const LONG_API_TIMEOUT = 120000

export interface TimeoutOptions {
  timeout?: number
  timeoutMessage?: string
}

/**
 * Wrap an async handler function with timeout protection
 *
 * Usage:
 * ```typescript
 * export const POST = withTimeout(async (request) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * }, { timeout: 30000 })
 * ```
 */
export function withTimeout<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  options: TimeoutOptions = {}
): (request: NextRequest, ...args: T) => Promise<NextResponse> {
  const { timeout = DEFAULT_API_TIMEOUT, timeoutMessage = 'Request timed out' } = options

  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const startTime = Date.now()
    const path = request.nextUrl.pathname

    try {
      // Race between handler and timeout
      const result = await Promise.race([
        handler(request, ...args),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('TIMEOUT'))
          })
        }),
      ])

      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)

      const duration = Date.now() - startTime

      if (error instanceof Error && error.message === 'TIMEOUT') {
        logger.warn('API request timed out', {
          path,
          method: request.method,
          timeout,
          duration,
        })

        return NextResponse.json(
          {
            error: timeoutMessage,
            code: 'REQUEST_TIMEOUT',
            duration,
          },
          { status: 504 } // Gateway Timeout
        )
      }

      // Re-throw non-timeout errors
      throw error
    }
  }
}

/**
 * Create a promise that rejects after a timeout
 * Useful for wrapping external API calls
 */
export function withTimeoutPromise<T>(
  promise: Promise<T>,
  timeout: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeout)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Execute a function with timeout protection
 * Returns null if timeout occurs instead of throwing
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  fallback: T | null = null
): Promise<T | null> {
  try {
    return await withTimeoutPromise(fn(), timeout)
  } catch {
    return fallback
  }
}

/**
 * Timeout presets for different operation types
 */
export const TimeoutPresets = {
  // Quick operations (auth checks, simple reads)
  quick: { timeout: QUICK_API_TIMEOUT, timeoutMessage: 'Request timed out' },

  // Standard operations (most CRUD)
  standard: { timeout: DEFAULT_API_TIMEOUT, timeoutMessage: 'Request timed out' },

  // Long operations (AI, file processing)
  long: { timeout: LONG_API_TIMEOUT, timeoutMessage: 'Operation timed out - please try again' },

  // Search operations
  search: { timeout: 30000, timeoutMessage: 'Search timed out - try a simpler query' },

  // AI operations (longer timeout)
  ai: { timeout: 90000, timeoutMessage: 'AI request timed out - please try again' },
} as const
