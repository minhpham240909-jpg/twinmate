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

// ============================================================================
// External API Retry / Exponential Backoff
// ============================================================================

export interface FetchBackoffOptions {
  /** Total retries after the initial attempt */
  maxRetries?: number
  /** Initial delay before the first retry */
  initialDelayMs?: number
  /** Maximum delay between retries */
  maxDelayMs?: number
  /** Exponential multiplier */
  backoffMultiplier?: number
  /** Jitter ratio applied to delay (0.2 = ±20%) */
  jitterRatio?: number
  /** Retry on these HTTP statuses */
  retryOnStatuses?: number[]
  /** Respect `Retry-After` (seconds or HTTP date) when present */
  respectRetryAfter?: boolean
  /** Optional timeout per attempt (ms). Does not override route-level timeout. */
  timeoutPerAttemptMs?: number
}

const DEFAULT_FETCH_BACKOFF: Required<Omit<FetchBackoffOptions, 'timeoutPerAttemptMs'>> = {
  maxRetries: 3,
  initialDelayMs: 200,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
  retryOnStatuses: [429, 500, 502, 503, 504],
  respectRetryAfter: true,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function computeBackoffDelayMs(attempt: number, opts: Required<Omit<FetchBackoffOptions, 'timeoutPerAttemptMs'>>): number {
  // attempt is 1-based for readability (retry #1, #2, ...)
  const base = Math.min(opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1), opts.maxDelayMs)
  const jitter = (Math.random() * 2 - 1) * opts.jitterRatio * base
  return Math.max(0, Math.round(base + jitter))
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null
  const trimmed = retryAfter.trim()
  if (!trimmed) return null

  // Seconds
  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1000)
  }

  // HTTP date
  const asDate = Date.parse(trimmed)
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now()
    return delta > 0 ? delta : 0
  }

  return null
}

function isRetryableStatus(status: number, opts: Required<Omit<FetchBackoffOptions, 'timeoutPerAttemptMs'>>): boolean {
  return opts.retryOnStatuses.includes(status)
}

function hasRetryableBody(init?: RequestInit): boolean {
  const body = init?.body as unknown
  if (!body) return true
  // Can't safely retry streaming bodies
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return false
  return true
}

/**
 * Fetch wrapper that retries transient failures with exponential backoff + jitter.
 *
 * - Retries on network errors and selected HTTP statuses (defaults include 429/5xx).
 * - Optionally honors `Retry-After`.
 * - Returns the final `Response` for HTTP errors (does not throw on non-2xx).
 */
export async function fetchWithBackoff(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchBackoffOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_FETCH_BACKOFF, ...options }

  if (opts.maxRetries > 0 && !hasRetryableBody(init)) {
    throw new Error('fetchWithBackoff: request body is not retryable (streaming body)')
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const isRetryAttempt = attempt > 0

    if (isRetryAttempt) {
      await sleep(computeBackoffDelayMs(attempt, opts))
    }

    const controller = opts.timeoutPerAttemptMs ? new AbortController() : null
    const timeoutId = opts.timeoutPerAttemptMs
      ? setTimeout(() => controller?.abort(), opts.timeoutPerAttemptMs)
      : null

    try {
      // If the caller provided a signal, propagate abort to our controller
      if (controller && init.signal) {
        if (init.signal.aborted) controller.abort()
        else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
      }

      const response = await fetch(input, {
        ...init,
        signal: controller ? controller.signal : init.signal,
      })

      if (!isRetryableStatus(response.status, opts) || attempt === opts.maxRetries) {
        if (timeoutId) clearTimeout(timeoutId)
        return response
      }

      // Retryable HTTP status
      if (opts.respectRetryAfter) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'))
        if (retryAfterMs !== null && retryAfterMs > 0) {
          if (timeoutId) clearTimeout(timeoutId)
          await sleep(Math.min(retryAfterMs, opts.maxDelayMs))
        }
      }

      logger.warn('External API call failed with retryable status, retrying', {
        status: response.status,
        attempt: attempt + 1,
        maxAttempts: opts.maxRetries + 1,
      })

      if (timeoutId) clearTimeout(timeoutId)
      continue
    } catch (error) {
      lastError = error

      const isAbort =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'))

      if (attempt === opts.maxRetries || isAbort) {
        if (timeoutId) clearTimeout(timeoutId)
        throw error
      }

      logger.warn('External API call failed (network/timeout), retrying', {
        attempt: attempt + 1,
        maxAttempts: opts.maxRetries + 1,
        error: error instanceof Error ? error.message : String(error),
      })

      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetchWithBackoff failed')
}
