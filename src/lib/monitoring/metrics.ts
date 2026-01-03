/**
 * Application Metrics & Monitoring
 *
 * Collects and exposes metrics for:
 * - OpenAI queue depth and wait times
 * - Cache hit/miss rates
 * - API response times
 * - Database query performance
 * - Real-time connection counts
 *
 * Designed for integration with monitoring dashboards.
 */

import logger from '@/lib/logger'

// ============================================
// Types
// ============================================

export interface QueueMetrics {
  currentSize: number
  activeRequests: number
  maxConcurrent: number
  averageWaitTimeMs: number
  totalProcessed: number
  successRate: number
  circuitBreakerState: 'closed' | 'open' | 'half-open'
}

export interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  size: number
  evictions: number
  lastReset: string
}

export interface ApiMetrics {
  totalRequests: number
  averageResponseTimeMs: number
  errorRate: number
  slowRequests: number // > 1 second
  timeouts: number
}

export interface SystemMetrics {
  queue: QueueMetrics
  cache: CacheMetrics
  api: ApiMetrics
  timestamp: string
  uptime: number
}

// ============================================
// In-Memory Metrics Storage
// ============================================

const startTime = Date.now()

// Cache metrics
let cacheMetrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  hitRate: 0,
  size: 0,
  evictions: 0,
  lastReset: new Date().toISOString(),
}

// API metrics
let apiMetrics: ApiMetrics = {
  totalRequests: 0,
  averageResponseTimeMs: 0,
  errorRate: 0,
  slowRequests: 0,
  timeouts: 0,
}

// Rolling window for response times (last 100 requests)
const responseTimeWindow: number[] = []
const MAX_WINDOW_SIZE = 100

// Error counts for error rate calculation
let errorCount = 0

// ============================================
// Metric Recording Functions
// ============================================

/**
 * Record a cache hit
 */
export function recordCacheHit(): void {
  cacheMetrics.hits++
  updateCacheHitRate()
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(): void {
  cacheMetrics.misses++
  updateCacheHitRate()
}

/**
 * Update cache size
 */
export function updateCacheSize(size: number): void {
  cacheMetrics.size = size
}

/**
 * Record a cache eviction
 */
export function recordCacheEviction(): void {
  cacheMetrics.evictions++
}

/**
 * Update cache hit rate
 */
function updateCacheHitRate(): void {
  const total = cacheMetrics.hits + cacheMetrics.misses
  cacheMetrics.hitRate = total > 0 ? cacheMetrics.hits / total : 0
}

/**
 * Record an API request with response time
 */
export function recordApiRequest(responseTimeMs: number, isError: boolean = false): void {
  apiMetrics.totalRequests++

  // Track response time
  responseTimeWindow.push(responseTimeMs)
  if (responseTimeWindow.length > MAX_WINDOW_SIZE) {
    responseTimeWindow.shift()
  }

  // Calculate average
  apiMetrics.averageResponseTimeMs = Math.round(
    responseTimeWindow.reduce((a, b) => a + b, 0) / responseTimeWindow.length
  )

  // Track slow requests (> 1 second)
  if (responseTimeMs > 1000) {
    apiMetrics.slowRequests++
  }

  // Track errors
  if (isError) {
    errorCount++
  }

  // Update error rate
  apiMetrics.errorRate = apiMetrics.totalRequests > 0
    ? errorCount / apiMetrics.totalRequests
    : 0
}

/**
 * Record an API timeout
 */
export function recordApiTimeout(): void {
  apiMetrics.timeouts++
  recordApiRequest(60000, true) // Assume max timeout
}

/**
 * Reset metrics (call periodically to prevent overflow)
 */
export function resetMetrics(): void {
  cacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: cacheMetrics.size,
    evictions: 0,
    lastReset: new Date().toISOString(),
  }

  apiMetrics = {
    totalRequests: 0,
    averageResponseTimeMs: 0,
    errorRate: 0,
    slowRequests: 0,
    timeouts: 0,
  }

  errorCount = 0
  responseTimeWindow.length = 0

  logger.info('[Metrics] Reset metrics')
}

// ============================================
// Metric Retrieval
// ============================================

/**
 * Get current cache metrics
 */
export function getCacheMetrics(): CacheMetrics {
  return { ...cacheMetrics }
}

/**
 * Get current API metrics
 */
export function getApiMetrics(): ApiMetrics {
  return { ...apiMetrics }
}

/**
 * Get all system metrics
 * Note: Queue metrics should be obtained from the queue module directly
 */
export function getSystemMetrics(queueMetrics?: QueueMetrics): SystemMetrics {
  return {
    queue: queueMetrics || {
      currentSize: 0,
      activeRequests: 0,
      maxConcurrent: 120,
      averageWaitTimeMs: 0,
      totalProcessed: 0,
      successRate: 1,
      circuitBreakerState: 'closed',
    },
    cache: getCacheMetrics(),
    api: getApiMetrics(),
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  }
}

// ============================================
// Health Check Helpers
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    cache: { status: string; hitRate: number }
    api: { status: string; errorRate: number; avgResponseTime: number }
    queue: { status: string; depth: number }
  }
  timestamp: string
}

/**
 * Get health status based on metrics
 */
export function getHealthStatus(queueDepth: number = 0): HealthStatus {
  const cache = getCacheMetrics()
  const api = getApiMetrics()

  // Determine cache health
  const cacheStatus = cache.hitRate >= 0.7 ? 'healthy' :
    cache.hitRate >= 0.5 ? 'degraded' : 'unhealthy'

  // Determine API health
  const apiStatus = api.errorRate <= 0.01 && api.averageResponseTimeMs < 500 ? 'healthy' :
    api.errorRate <= 0.05 && api.averageResponseTimeMs < 1000 ? 'degraded' : 'unhealthy'

  // Determine queue health
  const queueStatus = queueDepth < 100 ? 'healthy' :
    queueDepth < 500 ? 'degraded' : 'unhealthy'

  // Overall status
  const statuses = [cacheStatus, apiStatus, queueStatus]
  const overallStatus: HealthStatus['status'] =
    statuses.every(s => s === 'healthy') ? 'healthy' :
    statuses.some(s => s === 'unhealthy') ? 'unhealthy' : 'degraded'

  return {
    status: overallStatus,
    checks: {
      cache: { status: cacheStatus, hitRate: Math.round(cache.hitRate * 100) },
      api: { status: apiStatus, errorRate: Math.round(api.errorRate * 100), avgResponseTime: api.averageResponseTimeMs },
      queue: { status: queueStatus, depth: queueDepth },
    },
    timestamp: new Date().toISOString(),
  }
}

// ============================================
// Auto-reset metrics every hour
// ============================================

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    // Log metrics before reset
    logger.info('[Metrics] Hourly metrics summary', {
      cache: getCacheMetrics(),
      api: getApiMetrics(),
    })

    // Keep running totals but reset rates
    const currentCache = getCacheMetrics()
    cacheMetrics.hits = 0
    cacheMetrics.misses = 0
    cacheMetrics.hitRate = currentCache.hitRate // Keep last rate

    responseTimeWindow.length = 0
    errorCount = 0
  }, 60 * 60 * 1000) // Every hour
}
