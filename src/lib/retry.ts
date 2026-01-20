/**
 * Retry Utility for External API Calls
 *
 * Provides exponential backoff retry logic for unreliable external services
 * like OpenAI, Agora, and other third-party APIs.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Timeout handling
 * - Detailed error logging
 */

import logger from './logger'

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean
  /** Context for logging */
  context?: string
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDurationMs: number
}

/**
 * Default retry conditions for common API errors
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Rate limiting - always retry
    if (message.includes('rate limit') || message.includes('429')) {
      return true
    }

    // Server errors (5xx) - retry
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
      return true
    }

    // Network errors - retry
    if (message.includes('timeout') || message.includes('econnreset') ||
        message.includes('econnrefused') || message.includes('network')) {
      return true
    }

    // OpenAI specific
    if (message.includes('overloaded') || message.includes('capacity')) {
      return true
    }
  }

  // Check for fetch Response errors
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    // Retry on 429 (rate limit) and 5xx errors
    if (status === 429 || (status >= 500 && status < 600)) {
      return true
    }
  }

  return false
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt)

  // Cap at maximum delay
  delay = Math.min(delay, maxDelayMs)

  // Add jitter (±25% randomization)
  if (jitter) {
    const jitterRange = delay * 0.25
    delay = delay + (Math.random() * jitterRange * 2 - jitterRange)
  }

  return Math.round(delay)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with automatic retry on failure
 *
 * @example
 * const result = await withRetry(
 *   () => openai.chat.completions.create({ ... }),
 *   { maxRetries: 3, context: 'AI Tutor' }
 * )
 *
 * if (result.success) {
 *   console.log(result.data)
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error)
 * }
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = isRetryableError,
    context = 'API call',
  } = options

  const startTime = Date.now()
  let lastError: Error | undefined
  let attempts = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1

    try {
      const result = await operation()

      // Log recovery if this wasn't the first attempt
      if (attempt > 0) {
        logger.info(`[Retry] ${context} succeeded on attempt ${attempts}`, {
          attempts,
          totalDurationMs: Date.now() - startTime,
        })
      }

      return {
        success: true,
        data: result,
        attempts,
        totalDurationMs: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      const shouldRetry = attempt < maxRetries && isRetryable(error)

      if (shouldRetry) {
        const delay = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, jitter)

        logger.warn(`[Retry] ${context} failed (attempt ${attempts}/${maxRetries + 1}), retrying in ${delay}ms`, {
          error: lastError.message,
          attempt: attempts,
          nextRetryMs: delay,
        })

        await sleep(delay)
      } else {
        // Not retryable or max retries reached
        if (attempt >= maxRetries) {
          logger.error(`[Retry] ${context} failed after ${attempts} attempts`, {
            error: lastError.message,
            attempts,
            totalDurationMs: Date.now() - startTime,
          })
        } else {
          logger.error(`[Retry] ${context} failed with non-retryable error`, {
            error: lastError.message,
            attempts,
          })
        }
        break
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
    totalDurationMs: Date.now() - startTime,
  }
}

/**
 * Execute a function with retry, throwing on final failure
 *
 * @example
 * try {
 *   const response = await retryAsync(
 *     () => fetch('https://api.example.com/data'),
 *     { maxRetries: 3 }
 *   )
 * } catch (error) {
 *   // All retries failed
 * }
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await withRetry(operation, options)

  if (result.success && result.data !== undefined) {
    return result.data
  }

  throw result.error || new Error('Operation failed after retries')
}

/**
 * Create a retryable version of a function
 *
 * @example
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * )
 *
 * const data = await retryableFetch('https://api.example.com/data')
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return retryAsync(() => fn(...args), options)
  }
}

/**
 * OpenAI-specific retry configuration
 */
export const OPENAI_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  backoffMultiplier: 2,
  jitter: true,
  context: 'OpenAI API',
  isRetryable: (error) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // OpenAI specific errors
      if (message.includes('rate limit')) return true
      if (message.includes('overloaded')) return true
      if (message.includes('capacity')) return true
      if (message.includes('timeout')) return true
      if (message.includes('503')) return true
      if (message.includes('500')) return true
    }
    return isRetryableError(error)
  },
}

/**
 * Agora-specific retry configuration
 */
export const AGORA_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: true,
  context: 'Agora API',
}
