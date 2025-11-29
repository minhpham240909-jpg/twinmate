/**
 * API Performance Monitoring
 * 
 * Provides utilities for tracking API response times and error rates.
 * Integrates with Sentry for production monitoring.
 */

import * as Sentry from '@sentry/nextjs'
import logger from '@/lib/logger'

// ===== TYPES =====

interface PerformanceMetric {
  endpoint: string
  method: string
  duration: number
  statusCode: number
  timestamp: Date
}

interface PerformanceThresholds {
  /** Slow request threshold in ms (default: 1000ms) */
  slowThreshold: number
  /** Very slow request threshold in ms (default: 3000ms) */
  verySlowThreshold: number
  /** Critical threshold in ms (default: 10000ms) */
  criticalThreshold: number
}

// ===== CONSTANTS =====

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  slowThreshold: 1000,
  verySlowThreshold: 3000,
  criticalThreshold: 10000,
}

// In-memory metrics for quick analysis (reset on restart)
const recentMetrics: PerformanceMetric[] = []
const MAX_METRICS = 1000

// Error rate tracking
const errorCounts: Map<string, { errors: number; total: number; lastReset: Date }> = new Map()
const ERROR_RATE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

// ===== CORE FUNCTIONS =====

/**
 * Track API request performance
 */
export function trackRequestPerformance(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  thresholds: Partial<PerformanceThresholds> = {}
): void {
  const { slowThreshold, verySlowThreshold, criticalThreshold } = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  }
  
  const metric: PerformanceMetric = {
    endpoint,
    method,
    duration,
    statusCode,
    timestamp: new Date(),
  }
  
  // Store metric
  recentMetrics.push(metric)
  if (recentMetrics.length > MAX_METRICS) {
    recentMetrics.shift()
  }
  
  // Track errors
  trackError(endpoint, statusCode >= 400)
  
  // Log based on duration
  if (duration >= criticalThreshold) {
    logger.error(`Critical slow request: ${method} ${endpoint}`, {
      duration: `${duration}ms`,
      statusCode,
    })
    
    // Send to Sentry
    if (process.env.NODE_ENV !== 'development') {
      Sentry.captureMessage(`Critical slow API request: ${endpoint}`, {
        level: 'error',
        tags: { endpoint, method, performance: 'critical' },
        extra: { duration, statusCode },
      })
    }
  } else if (duration >= verySlowThreshold) {
    logger.warn(`Very slow request: ${method} ${endpoint}`, {
      duration: `${duration}ms`,
      statusCode,
    })
  } else if (duration >= slowThreshold) {
    logger.info(`Slow request: ${method} ${endpoint}`, {
      duration: `${duration}ms`,
      statusCode,
    })
  }
}

/**
 * Track error for error rate calculation
 */
function trackError(endpoint: string, isError: boolean): void {
  const now = new Date()
  let record = errorCounts.get(endpoint)
  
  // Reset if window expired
  if (!record || now.getTime() - record.lastReset.getTime() > ERROR_RATE_WINDOW_MS) {
    record = { errors: 0, total: 0, lastReset: now }
  }
  
  record.total++
  if (isError) {
    record.errors++
  }
  
  errorCounts.set(endpoint, record)
  
  // Alert on high error rate
  if (record.total >= 10 && record.errors / record.total > 0.1) {
    const errorRate = (record.errors / record.total * 100).toFixed(1)
    logger.warn(`High error rate on ${endpoint}: ${errorRate}%`, {
      errors: record.errors,
      total: record.total,
    })
  }
}

/**
 * Get error rate for an endpoint
 */
export function getErrorRate(endpoint: string): number | null {
  const record = errorCounts.get(endpoint)
  if (!record || record.total === 0) return null
  return record.errors / record.total
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  avgDuration: number
  p50Duration: number
  p95Duration: number
  p99Duration: number
  errorRate: number
  totalRequests: number
} {
  if (recentMetrics.length === 0) {
    return {
      avgDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      errorRate: 0,
      totalRequests: 0,
    }
  }
  
  const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b)
  const errors = recentMetrics.filter(m => m.statusCode >= 400).length
  
  return {
    avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    p50Duration: durations[Math.floor(durations.length * 0.5)],
    p95Duration: durations[Math.floor(durations.length * 0.95)],
    p99Duration: durations[Math.floor(durations.length * 0.99)],
    errorRate: errors / recentMetrics.length,
    totalRequests: recentMetrics.length,
  }
}

/**
 * Get slow endpoints
 */
export function getSlowEndpoints(threshold: number = 1000): {
  endpoint: string
  avgDuration: number
  count: number
}[] {
  const endpointStats: Map<string, { total: number; count: number }> = new Map()
  
  for (const metric of recentMetrics) {
    const stats = endpointStats.get(metric.endpoint) || { total: 0, count: 0 }
    stats.total += metric.duration
    stats.count++
    endpointStats.set(metric.endpoint, stats)
  }
  
  return Array.from(endpointStats.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      avgDuration: Math.round(stats.total / stats.count),
      count: stats.count,
    }))
    .filter(s => s.avgDuration >= threshold)
    .sort((a, b) => b.avgDuration - a.avgDuration)
}

// ===== MIDDLEWARE HELPER =====

/**
 * Create a timing wrapper for API handlers
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<Response>>(
  endpoint: string,
  method: string,
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const start = performance.now()
    let statusCode = 200
    
    try {
      const response = await handler(...args)
      statusCode = response.status
      return response
    } catch (error) {
      statusCode = 500
      throw error
    } finally {
      const duration = Math.round(performance.now() - start)
      trackRequestPerformance(endpoint, method, duration, statusCode)
    }
  }) as T
}

/**
 * Track a transaction with Sentry
 */
export function startTransaction(
  name: string,
  op: string = 'http.server'
): { finish: () => void } {
  if (process.env.NODE_ENV === 'development') {
    return { finish: () => {} }
  }
  
  const transaction = Sentry.startInactiveSpan({
    name,
    op,
  })
  
  return {
    finish: () => transaction?.end(),
  }
}

