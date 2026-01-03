/**
 * OpenAI Request Queue System
 *
 * Handles request queuing, rate limiting, and priority management for OpenAI API calls.
 * Designed to support 1000-3000 concurrent users without hitting rate limits.
 *
 * Features:
 * - Request queuing with configurable concurrency
 * - Priority levels (HIGH, NORMAL, LOW)
 * - Automatic retry with exponential backoff
 * - Circuit breaker for failure protection
 * - Request deduplication
 * - Metrics and monitoring
 */

// Queue configuration optimized for 3000 concurrent users
const QUEUE_CONFIG = {
  // Maximum concurrent OpenAI requests (OpenAI Tier 3: ~500 RPM for GPT-4o-mini)
  // Increased from 50 to 120 for better throughput with 3000 users
  // This allows ~2 concurrent requests per 100 active users
  maxConcurrent: parseInt(process.env.OPENAI_MAX_CONCURRENT || '120', 10),

  // Rate limiting: requests per minute (OpenAI Tier 3 limit: ~500 RPM)
  // Set to 450 to leave headroom for bursts
  requestsPerMinute: parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE || '450', 10),

  // Request timeout in milliseconds (60 seconds for complex queries)
  requestTimeout: parseInt(process.env.OPENAI_REQUEST_TIMEOUT || '60000', 10),

  // Maximum queue size before rejecting new requests
  // Increased from 5000 to 10000 to handle traffic spikes
  maxQueueSize: parseInt(process.env.OPENAI_MAX_QUEUE_SIZE || '10000', 10),

  // Retry configuration
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 30000,

  // Circuit breaker configuration
  circuitBreakerThreshold: 15, // Increased from 10 to reduce false positives
  circuitBreakerResetMs: 45000, // Reduced from 60s to recover faster

  // Deduplication window in milliseconds
  deduplicationWindowMs: 2000,
}

// Priority levels for request ordering
export enum QueuePriority {
  HIGH = 0,    // System messages, error recovery
  NORMAL = 1,  // Regular chat messages
  LOW = 2,     // Background tasks (flashcards, quiz generation)
}

interface QueuedRequest<T> {
  id: string
  priority: QueuePriority
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  addedAt: number
  retries: number
  userId?: string
  dedupeKey?: string
}

interface QueueMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  retriedRequests: number
  queuedRequests: number
  averageWaitTimeMs: number
  averageProcessTimeMs: number
  circuitBreakerState: 'closed' | 'open' | 'half-open'
  requestsThisMinute: number
}

// Request queue state
let queue: QueuedRequest<unknown>[] = []
let activeRequests = 0
let metrics: QueueMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retriedRequests: 0,
  queuedRequests: 0,
  averageWaitTimeMs: 0,
  averageProcessTimeMs: 0,
  circuitBreakerState: 'closed',
  requestsThisMinute: 0,
}

// Circuit breaker state
let consecutiveFailures = 0
let circuitOpenedAt: number | null = null

// Rate limiting tracking
let requestsInCurrentMinute = 0
let currentMinuteStart = Date.now()

// Deduplication cache
const recentRequests = new Map<string, { timestamp: number; result: Promise<unknown> }>()

// Processing metrics
const waitTimes: number[] = []
const processTimes: number[] = []

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Check if circuit breaker allows requests
 */
function isCircuitOpen(): boolean {
  if (circuitOpenedAt === null) {
    return false
  }

  // Check if enough time has passed to attempt recovery
  if (Date.now() - circuitOpenedAt >= QUEUE_CONFIG.circuitBreakerResetMs) {
    metrics.circuitBreakerState = 'half-open'
    return false
  }

  return true
}

/**
 * Record request result for circuit breaker
 */
function recordResult(success: boolean): void {
  if (success) {
    consecutiveFailures = 0
    if (metrics.circuitBreakerState === 'half-open') {
      metrics.circuitBreakerState = 'closed'
      circuitOpenedAt = null
      console.log('[OpenAI Queue] Circuit breaker closed - service recovered')
    }
  } else {
    consecutiveFailures++
    if (consecutiveFailures >= QUEUE_CONFIG.circuitBreakerThreshold) {
      metrics.circuitBreakerState = 'open'
      circuitOpenedAt = Date.now()
      console.error('[OpenAI Queue] Circuit breaker opened - too many failures')
    }
  }
}

/**
 * Check rate limiting
 */
function checkRateLimit(): boolean {
  const now = Date.now()

  // Reset counter if we're in a new minute
  if (now - currentMinuteStart >= 60000) {
    currentMinuteStart = now
    requestsInCurrentMinute = 0
  }

  metrics.requestsThisMinute = requestsInCurrentMinute
  return requestsInCurrentMinute < QUEUE_CONFIG.requestsPerMinute
}

/**
 * Calculate delay for rate limiting
 */
function getRateLimitDelay(): number {
  const now = Date.now()
  const timeLeftInMinute = 60000 - (now - currentMinuteStart)
  const requestsRemaining = QUEUE_CONFIG.requestsPerMinute - requestsInCurrentMinute

  if (requestsRemaining <= 0) {
    return timeLeftInMinute
  }

  // Spread remaining requests evenly across remaining time
  return Math.max(0, timeLeftInMinute / requestsRemaining)
}

/**
 * Process queue - runs continuously while there are queued items
 */
async function processQueue(): Promise<void> {
  // Don't process if circuit is open
  if (isCircuitOpen()) {
    // Schedule retry after circuit reset time
    setTimeout(processQueue, QUEUE_CONFIG.circuitBreakerResetMs)
    return
  }

  // Don't process if at max concurrency
  if (activeRequests >= QUEUE_CONFIG.maxConcurrent) {
    return
  }

  // Don't process if rate limited
  if (!checkRateLimit()) {
    const delay = getRateLimitDelay()
    setTimeout(processQueue, delay)
    return
  }

  // Get highest priority request
  if (queue.length === 0) {
    return
  }

  // Sort by priority then by age
  queue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return a.addedAt - b.addedAt
  })

  const request = queue.shift()!
  activeRequests++
  requestsInCurrentMinute++
  metrics.queuedRequests = queue.length

  const startTime = Date.now()
  const waitTime = startTime - request.addedAt

  try {
    // Execute with timeout
    const result = await Promise.race([
      request.execute(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), QUEUE_CONFIG.requestTimeout)
      ),
    ])

    const processTime = Date.now() - startTime

    // Update metrics
    waitTimes.push(waitTime)
    processTimes.push(processTime)
    if (waitTimes.length > 100) waitTimes.shift()
    if (processTimes.length > 100) processTimes.shift()

    metrics.successfulRequests++
    metrics.averageWaitTimeMs = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
    metrics.averageProcessTimeMs = processTimes.reduce((a, b) => a + b, 0) / processTimes.length

    recordResult(true)
    request.resolve(result as never)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check if retryable
    const isRetryable =
      errorMessage.includes('timeout') ||
      errorMessage.includes('rate_limit') ||
      errorMessage.includes('429') ||
      errorMessage.includes('503') ||
      errorMessage.includes('server_error')

    if (isRetryable && request.retries < QUEUE_CONFIG.maxRetries) {
      // Calculate exponential backoff delay
      const delay = Math.min(
        QUEUE_CONFIG.retryBaseDelayMs * Math.pow(2, request.retries),
        QUEUE_CONFIG.retryMaxDelayMs
      )

      request.retries++
      metrics.retriedRequests++

      console.log(`[OpenAI Queue] Retrying request ${request.id} (attempt ${request.retries}) after ${delay}ms`)

      // Re-add to queue after delay
      setTimeout(() => {
        queue.push(request)
        metrics.queuedRequests = queue.length
        processQueue()
      }, delay)
    } else {
      metrics.failedRequests++
      recordResult(false)
      request.reject(error instanceof Error ? error : new Error(errorMessage))
    }
  } finally {
    activeRequests--

    // Process next item
    setImmediate(processQueue)
  }
}

/**
 * Enqueue an OpenAI request
 *
 * @param execute - Function that executes the OpenAI API call
 * @param options - Queue options (priority, userId, dedupeKey)
 * @returns Promise that resolves with the API response
 */
export async function enqueueRequest<T>(
  execute: () => Promise<T>,
  options: {
    priority?: QueuePriority
    userId?: string
    dedupeKey?: string
  } = {}
): Promise<T> {
  const { priority = QueuePriority.NORMAL, userId, dedupeKey } = options

  // Check if circuit breaker is open
  if (isCircuitOpen() && metrics.circuitBreakerState === 'open') {
    throw new Error('Service temporarily unavailable - please try again later')
  }

  // Check queue size limit
  if (queue.length >= QUEUE_CONFIG.maxQueueSize) {
    throw new Error('System is busy - please try again in a moment')
  }

  // Check deduplication
  if (dedupeKey) {
    const cached = recentRequests.get(dedupeKey)
    if (cached && Date.now() - cached.timestamp < QUEUE_CONFIG.deduplicationWindowMs) {
      console.log(`[OpenAI Queue] Deduped request: ${dedupeKey}`)
      return cached.result as Promise<T>
    }
  }

  metrics.totalRequests++

  // Create promise that will be resolved when request completes
  let resolvePromise: (value: T) => void
  let rejectPromise: (error: Error) => void

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  // Add to deduplication cache
  if (dedupeKey) {
    recentRequests.set(dedupeKey, { timestamp: Date.now(), result: promise })

    // Clean up cache entry after window expires
    setTimeout(() => {
      recentRequests.delete(dedupeKey)
    }, QUEUE_CONFIG.deduplicationWindowMs * 2)
  }

  // Create queued request
  const request: QueuedRequest<T> = {
    id: generateRequestId(),
    priority,
    execute,
    resolve: resolvePromise!,
    reject: rejectPromise!,
    addedAt: Date.now(),
    retries: 0,
    userId,
    dedupeKey,
  }

  // Add to queue
  queue.push(request as QueuedRequest<unknown>)
  metrics.queuedRequests = queue.length

  // Trigger processing
  setImmediate(processQueue)

  return promise
}

/**
 * Get current queue metrics
 */
export function getQueueMetrics(): QueueMetrics {
  return { ...metrics }
}

/**
 * Get queue status summary
 */
export function getQueueStatus(): {
  healthy: boolean
  activeRequests: number
  queuedRequests: number
  circuitState: string
  requestsPerMinute: number
  averageWaitMs: number
} {
  return {
    healthy: metrics.circuitBreakerState === 'closed' && queue.length < QUEUE_CONFIG.maxQueueSize * 0.8,
    activeRequests,
    queuedRequests: queue.length,
    circuitState: metrics.circuitBreakerState,
    requestsPerMinute: metrics.requestsThisMinute,
    averageWaitMs: Math.round(metrics.averageWaitTimeMs),
  }
}

/**
 * Clear the queue (for emergency use only)
 */
export function clearQueue(): { cleared: number } {
  const cleared = queue.length

  // Reject all queued requests
  queue.forEach(request => {
    request.reject(new Error('Queue cleared'))
  })

  queue = []
  metrics.queuedRequests = 0

  console.log(`[OpenAI Queue] Cleared ${cleared} requests from queue`)

  return { cleared }
}

/**
 * Reset circuit breaker (for recovery after manual intervention)
 */
export function resetCircuitBreaker(): void {
  consecutiveFailures = 0
  circuitOpenedAt = null
  metrics.circuitBreakerState = 'closed'
  console.log('[OpenAI Queue] Circuit breaker reset manually')
}

/**
 * Helper to create a dedupe key from request parameters
 */
export function createDedupeKey(userId: string, action: string, content: string): string {
  // Use hash of content to create shorter key
  const contentHash = Buffer.from(content).toString('base64').slice(0, 20)
  return `${userId}:${action}:${contentHash}`
}

// Cleanup interval for deduplication cache
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of recentRequests.entries()) {
      if (now - value.timestamp > QUEUE_CONFIG.deduplicationWindowMs * 2) {
        recentRequests.delete(key)
      }
    }
  }, 60000) // Clean up every minute
}

// Log queue status periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const status = getQueueStatus()
    if (status.queuedRequests > 0 || status.activeRequests > 0) {
      console.log('[OpenAI Queue Status]', status)
    }
  }, 30000) // Every 30 seconds
}

export default {
  enqueueRequest,
  getQueueMetrics,
  getQueueStatus,
  clearQueue,
  resetCircuitBreaker,
  createDedupeKey,
  QueuePriority,
}
