/**
 * FETCH WITH TIMEOUT UTILITY
 *
 * Provides a fetch wrapper with automatic timeout handling,
 * retry logic with exponential backoff, and proper error types.
 */

// Default timeout in milliseconds (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000

// Max retries for network failures
const DEFAULT_MAX_RETRIES = 3

// Base delay for exponential backoff (ms)
const BASE_RETRY_DELAY_MS = 1000

/**
 * Custom error types for better error handling
 */
export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`)
    this.name = 'FetchTimeoutError'
  }
}

export class FetchNetworkError extends Error {
  constructor(url: string, originalError: Error) {
    super(`Network error while fetching ${url}: ${originalError.message}`)
    this.name = 'FetchNetworkError'
    this.cause = originalError
  }
}

export class FetchRetryExhaustedError extends Error {
  constructor(url: string, attempts: number, lastError: Error) {
    super(`Failed to fetch ${url} after ${attempts} attempts: ${lastError.message}`)
    this.name = 'FetchRetryExhaustedError'
    this.cause = lastError
  }
}

interface FetchWithTimeoutOptions extends RequestInit {
  /**
   * Timeout in milliseconds. Defaults to 30000 (30 seconds).
   */
  timeoutMs?: number

  /**
   * Whether to retry on network failures. Defaults to false.
   */
  retry?: boolean

  /**
   * Maximum number of retries. Defaults to 3.
   */
  maxRetries?: number

  /**
   * Whether to use exponential backoff for retries. Defaults to true.
   */
  exponentialBackoff?: boolean
}

/**
 * Fetch with automatic timeout handling.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout configuration
 * @returns Promise resolving to the Response
 * @throws FetchTimeoutError if the request times out
 * @throws FetchNetworkError if there's a network error
 * @throws FetchRetryExhaustedError if all retries are exhausted
 *
 * @example
 * ```typescript
 * // Basic usage with default 30s timeout
 * const response = await fetchWithTimeout('/api/data')
 *
 * // Custom timeout
 * const response = await fetchWithTimeout('/api/slow-endpoint', {
 *   timeoutMs: 60000 // 60 seconds
 * })
 *
 * // With retry
 * const response = await fetchWithTimeout('/api/flaky-endpoint', {
 *   retry: true,
 *   maxRetries: 3
 * })
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retry = false,
    maxRetries = DEFAULT_MAX_RETRIES,
    exponentialBackoff = true,
    ...fetchOptions
  } = options

  // Helper to perform single fetch with timeout
  const performFetch = async (): Promise<Response> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)

      // Check if it was a timeout (AbortError)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FetchTimeoutError(url, timeoutMs)
      }

      // Check if it was a network error
      if (error instanceof TypeError) {
        throw new FetchNetworkError(url, error)
      }

      throw error
    }
  }

  // If no retry, just perform single fetch
  if (!retry) {
    return performFetch()
  }

  // Retry logic with exponential backoff
  let lastError: Error = new Error('Unknown error')
  let attempts = 0

  while (attempts < maxRetries) {
    try {
      return await performFetch()
    } catch (error) {
      attempts++
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on timeout errors (likely server-side issue)
      if (error instanceof FetchTimeoutError) {
        throw error
      }

      // If we have more retries, wait and try again
      if (attempts < maxRetries) {
        const delay = exponentialBackoff
          ? BASE_RETRY_DELAY_MS * Math.pow(2, attempts - 1)
          : BASE_RETRY_DELAY_MS

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw new FetchRetryExhaustedError(url, attempts, lastError)
}

/**
 * Fetch JSON data with timeout handling.
 * Automatically parses JSON response and handles errors.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout configuration
 * @returns Promise resolving to the parsed JSON data
 *
 * @example
 * ```typescript
 * const data = await fetchJsonWithTimeout<{ items: Item[] }>('/api/items')
 * console.log(data.items)
 * ```
 */
export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * POST JSON data with timeout handling.
 *
 * @param url - The URL to post to
 * @param data - The data to send
 * @param options - Fetch options including timeout configuration
 * @returns Promise resolving to the parsed JSON response
 *
 * @example
 * ```typescript
 * const result = await postJsonWithTimeout('/api/create', { name: 'Item' })
 * ```
 */
export async function postJsonWithTimeout<T = unknown, D = unknown>(
  url: string,
  data: D,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed with status ${response.status}`)
  }

  return response.json()
}

export default fetchWithTimeout
