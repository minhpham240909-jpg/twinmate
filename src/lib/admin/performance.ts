// Admin Dashboard Performance Monitoring
// Tracks API response times, cache hit rates, and query performance
// Provides visibility into admin dashboard health and bottlenecks

import { getOrSetCached } from '@/lib/cache'

// =====================================================
// TYPES
// =====================================================

export interface PerformanceMetric {
  endpoint: string
  method: string
  duration: number
  timestamp: number
  cacheHit: boolean
  error?: string
  statusCode?: number
}

export interface PerformanceStats {
  totalRequests: number
  avgDuration: number
  p50Duration: number
  p95Duration: number
  p99Duration: number
  cacheHitRate: number
  errorRate: number
  slowRequests: number // Requests > 1000ms
}

export interface EndpointStats extends PerformanceStats {
  endpoint: string
  lastHour: PerformanceStats
  last24Hours: PerformanceStats
}

// =====================================================
// CONSTANTS
// =====================================================

const METRICS_TTL = 3600 // 1 hour
const SLOW_REQUEST_THRESHOLD = 1000 // 1 second

// In-memory fallback
const inMemoryMetrics: PerformanceMetric[] = []
const MAX_IN_MEMORY_METRICS = 10000

// =====================================================
// PERFORMANCE TRACKER
// =====================================================

export class PerformanceTracker {
  private startTime: number
  private endpoint: string
  private method: string
  private cacheHit: boolean = false

  constructor(endpoint: string, method: string = 'GET') {
    this.startTime = performance.now()
    this.endpoint = endpoint
    this.method = method
  }

  /**
   * Mark this request as a cache hit
   */
  setCacheHit(hit: boolean = true): void {
    this.cacheHit = hit
  }

  /**
   * End tracking and record the metric
   */
  async end(statusCode: number = 200, error?: string): Promise<number> {
    const duration = performance.now() - this.startTime

    const metric: PerformanceMetric = {
      endpoint: this.endpoint,
      method: this.method,
      duration: Math.round(duration),
      timestamp: Date.now(),
      cacheHit: this.cacheHit,
      statusCode,
      error,
    }

    await recordMetric(metric)

    // Log slow requests
    if (duration > SLOW_REQUEST_THRESHOLD) {
      console.warn(`[Perf] Slow request: ${this.method} ${this.endpoint} took ${Math.round(duration)}ms`)
    }

    return duration
  }
}

/**
 * Create a performance tracker for an endpoint
 */
export function trackPerformance(endpoint: string, method: string = 'GET'): PerformanceTracker {
  return new PerformanceTracker(endpoint, method)
}

/**
 * Higher-order function to wrap async handlers with performance tracking
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  endpoint: string,
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const tracker = trackPerformance(endpoint)
    try {
      const result = await handler(...args)
      await tracker.end(200)
      return result
    } catch (error: any) {
      await tracker.end(500, error.message)
      throw error
    }
  }) as T
}

// =====================================================
// METRICS STORAGE
// =====================================================

/**
 * Record a performance metric
 * Uses in-memory storage for simplicity (Redis sorted sets via REST API are complex)
 */
async function recordMetric(metric: PerformanceMetric): Promise<void> {
  try {
    // Use in-memory storage for performance metrics
    // Redis sorted sets via REST API would require multiple round trips
    inMemoryMetrics.push(metric)

    // Trim if too many
    if (inMemoryMetrics.length > MAX_IN_MEMORY_METRICS) {
      inMemoryMetrics.splice(0, inMemoryMetrics.length - MAX_IN_MEMORY_METRICS)
    }

    // Also trim old entries (keep last hour)
    const cutoff = Date.now() - (METRICS_TTL * 1000)
    const firstValidIndex = inMemoryMetrics.findIndex(m => m.timestamp > cutoff)
    if (firstValidIndex > 0) {
      inMemoryMetrics.splice(0, firstValidIndex)
    }
  } catch (error) {
    console.error('[Perf] Error recording metric:', error)
  }
}

/**
 * Get metrics for a specific endpoint
 * Uses in-memory storage for performance metrics
 */
async function getMetrics(endpoint?: string, timeRangeMs: number = 3600000): Promise<PerformanceMetric[]> {
  const cutoff = Date.now() - timeRangeMs

  return inMemoryMetrics.filter(m => {
    if (m.timestamp < cutoff) return false
    if (endpoint && m.endpoint !== endpoint) return false
    return true
  })
}

// =====================================================
// STATISTICS CALCULATION
// =====================================================

/**
 * Calculate statistics from metrics
 */
function calculateStats(metrics: PerformanceMetric[]): PerformanceStats {
  if (metrics.length === 0) {
    return {
      totalRequests: 0,
      avgDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      cacheHitRate: 0,
      errorRate: 0,
      slowRequests: 0,
    }
  }

  const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
  const cacheHits = metrics.filter(m => m.cacheHit).length
  const errors = metrics.filter(m => m.error || (m.statusCode && m.statusCode >= 400)).length
  const slow = metrics.filter(m => m.duration > SLOW_REQUEST_THRESHOLD).length

  const total = metrics.length
  const sum = durations.reduce((a, b) => a + b, 0)

  return {
    totalRequests: total,
    avgDuration: Math.round(sum / total),
    p50Duration: durations[Math.floor(total * 0.5)] || 0,
    p95Duration: durations[Math.floor(total * 0.95)] || 0,
    p99Duration: durations[Math.floor(total * 0.99)] || 0,
    cacheHitRate: Math.round((cacheHits / total) * 100),
    errorRate: Math.round((errors / total) * 100),
    slowRequests: slow,
  }
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Get performance statistics for admin dashboard
 * Cached for 30 seconds to avoid self-referential performance overhead
 */
export async function getAdminPerformanceStats(): Promise<{
  overall: PerformanceStats
  byEndpoint: EndpointStats[]
  recentSlowRequests: PerformanceMetric[]
}> {
  return getOrSetCached('admin:perf:stats', 30, async () => {
    const now = Date.now()
    const hourAgo = now - 3600000

    // Get all metrics
    const allMetricsHour = await getMetrics(undefined, 3600000)
    const allMetricsDay = await getMetrics(undefined, 86400000)

    // Calculate overall stats
    const overall = calculateStats(allMetricsHour)

    // Group by endpoint for last hour
    const endpointMap = new Map<string, PerformanceMetric[]>()
    for (const metric of allMetricsDay) {
      const existing = endpointMap.get(metric.endpoint) || []
      existing.push(metric)
      endpointMap.set(metric.endpoint, existing)
    }

    // Calculate per-endpoint stats
    const byEndpoint: EndpointStats[] = []
    for (const [endpoint, metrics] of endpointMap) {
      const hourMetrics = metrics.filter(m => m.timestamp > hourAgo)
      const dayMetrics = metrics

      byEndpoint.push({
        endpoint,
        ...calculateStats(dayMetrics),
        lastHour: calculateStats(hourMetrics),
        last24Hours: calculateStats(dayMetrics),
      })
    }

    // Sort by total requests (most used first)
    byEndpoint.sort((a, b) => b.totalRequests - a.totalRequests)

    // Get recent slow requests
    const recentSlowRequests = allMetricsHour
      .filter(m => m.duration > SLOW_REQUEST_THRESHOLD)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)

    return {
      overall,
      byEndpoint: byEndpoint.slice(0, 20), // Top 20 endpoints
      recentSlowRequests,
    }
  })
}

/**
 * Get performance stats for a specific endpoint
 */
export async function getEndpointStats(endpoint: string): Promise<EndpointStats | null> {
  const metrics = await getMetrics(endpoint, 86400000) // 24 hours
  if (metrics.length === 0) return null

  const hourAgo = Date.now() - 3600000
  const hourMetrics = metrics.filter(m => m.timestamp > hourAgo)

  return {
    endpoint,
    ...calculateStats(metrics),
    lastHour: calculateStats(hourMetrics),
    last24Hours: calculateStats(metrics),
  }
}

/**
 * Clear all performance metrics (for testing)
 */
export async function clearPerformanceMetrics(): Promise<void> {
  inMemoryMetrics.length = 0
}

// =====================================================
// DATABASE QUERY TIMING
// =====================================================

/**
 * Time a database query and log if slow
 */
export async function timeQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  slowThresholdMs: number = 500
): Promise<T> {
  const start = performance.now()

  try {
    const result = await query()
    const duration = performance.now() - start

    if (duration > slowThresholdMs) {
      console.warn(`[DB] Slow query "${queryName}": ${Math.round(duration)}ms`)
    }

    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[DB] Query "${queryName}" failed after ${Math.round(duration)}ms:`, error)
    throw error
  }
}

/**
 * Decorator for timing async functions
 */
export function timed(name: string, slowThresholdMs: number = 500) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const start = performance.now()

      try {
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - start

        if (duration > slowThresholdMs) {
          console.warn(`[Timed] ${name}.${propertyKey}: ${Math.round(duration)}ms`)
        }

        return result
      } catch (error) {
        const duration = performance.now() - start
        console.error(`[Timed] ${name}.${propertyKey} failed after ${Math.round(duration)}ms`)
        throw error
      }
    }

    return descriptor
  }
}
