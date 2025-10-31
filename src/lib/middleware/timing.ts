/**
 * API Route Timing Middleware
 * 
 * Wraps API route handlers to measure execution time and log slow queries.
 * Helps identify N+1 problems and performance bottlenecks.
 * 
 * Usage in API routes:
 * export const GET = withTiming(async (request: NextRequest) => { ... })
 */

import { NextRequest, NextResponse } from 'next/server'

interface TimingOptions {
  /**
   * Threshold in milliseconds to log warnings for slow requests
   * @default 1000
   */
  slowThreshold?: number

  /**
   * Whether to log all requests in development
   * @default true
   */
  logInDev?: boolean

  /**
   * Custom name for the route (for better logging)
   */
  routeName?: string
}

const DEFAULT_OPTIONS: TimingOptions = {
  slowThreshold: 1000,
  logInDev: true,
}

/**
 * Wraps an API route handler with timing and performance logging
 */
export function withTiming<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options: TimingOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return (async (req: NextRequest, ...args: any[]) => {
    const start = performance.now()
    const path = req.nextUrl.pathname
    const method = req.method
    const routeName = opts.routeName || `${method} ${path}`

    try {
      const response = await handler(req, ...args)
      const duration = performance.now() - start
      const durationMs = Math.round(duration)

      // Log based on environment and threshold
      if (durationMs > opts.slowThreshold!) {
        console.warn(`[SLOW ${durationMs}ms] ${routeName}`, {
          duration: `${durationMs}ms`,
          threshold: `${opts.slowThreshold}ms`,
          status: response?.status,
          path,
          method,
        })
      } else if (opts.logInDev && process.env.NODE_ENV === 'development') {
        console.log(`[${durationMs}ms] ${routeName}`)
      }

      // Add timing header for debugging
      if (response instanceof NextResponse) {
        response.headers.set('X-Response-Time', `${durationMs}ms`)
        response.headers.set('Server-Timing', `total;dur=${durationMs}`)
      }

      // Track metrics (extend this for production monitoring)
      trackMetric(routeName, durationMs, response?.status || 200)

      return response
    } catch (error) {
      const duration = performance.now() - start
      const durationMs = Math.round(duration)

      console.error(`[ERROR ${durationMs}ms] ${routeName}`, {
        duration: `${durationMs}ms`,
        error: error instanceof Error ? error.message : String(error),
        path,
        method,
      })

      // Track error metrics
      trackMetric(routeName, durationMs, 500, true)

      throw error
    }
  }) as T
}

/**
 * Track metrics (placeholder - integrate with your monitoring solution)
 */
function trackMetric(
  routeName: string,
  duration: number,
  status: number,
  isError: boolean = false
): void {
  // In development, just log
  if (process.env.NODE_ENV === 'development') {
    return
  }

  // TODO: Integrate with monitoring service (Sentry, Datadog, etc.)
  // Example:
  // - Track histogram of request durations
  // - Count requests by route and status
  // - Alert on error rate spikes
  
  // For now, we'll collect stats in memory for debugging
  if (typeof global !== 'undefined') {
    if (!global.apiMetrics) {
      global.apiMetrics = new Map()
    }

    const key = `${routeName}:${status}`
    const current = global.apiMetrics.get(key) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errors: 0,
    }

    global.apiMetrics.set(key, {
      count: current.count + 1,
      totalDuration: current.totalDuration + duration,
      minDuration: Math.min(current.minDuration, duration),
      maxDuration: Math.max(current.maxDuration, duration),
      errors: current.errors + (isError ? 1 : 0),
    })
  }
}

/**
 * Get collected metrics (for debugging)
 * Call this from a debug API route to see performance stats
 */
export function getMetrics(): Record<string, any> {
  if (typeof global === 'undefined' || !global.apiMetrics) {
    return {}
  }

  const metrics: Record<string, any> = {}
  global.apiMetrics.forEach((value, key) => {
    metrics[key] = {
      ...value,
      avgDuration: Math.round(value.totalDuration / value.count),
      errorRate: value.errors / value.count,
    }
  })

  return metrics
}

/**
 * Reset collected metrics
 */
export function resetMetrics(): void {
  if (typeof global !== 'undefined') {
    global.apiMetrics = new Map()
  }
}

// Extend global type
declare global {
  var apiMetrics: Map<string, any> | undefined
}

/**
 * Measure database query time
 * Wrap Prisma queries with this to identify slow database operations
 */
export async function measureQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  slowThreshold: number = 100
): Promise<T> {
  const start = performance.now()
  
  try {
    const result = await query()
    const duration = performance.now() - start
    const durationMs = Math.round(duration)

    if (durationMs > slowThreshold) {
      console.warn(`[SLOW QUERY ${durationMs}ms] ${queryName}`)
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[QUERY ${durationMs}ms] ${queryName}`)
    }

    return result
  } catch (error) {
    const duration = performance.now() - start
    const durationMs = Math.round(duration)
    
    console.error(`[QUERY ERROR ${durationMs}ms] ${queryName}`, error)
    throw error
  }
}

/**
 * Detect N+1 query patterns
 * Wraps a function that might trigger N+1 queries and warns if it makes too many DB calls
 */
export async function detectN1<T>(
  operationName: string,
  operation: (tracker: QueryTracker) => Promise<T>,
  maxQueries: number = 10
): Promise<T> {
  const tracker = new QueryTracker()
  
  try {
    const result = await operation(tracker)
    
    if (tracker.count > maxQueries) {
      console.warn(
        `[N+1 WARNING] ${operationName} made ${tracker.count} queries (max: ${maxQueries})`,
        {
          queries: tracker.queries.slice(0, 5), // Show first 5 queries
          totalCount: tracker.count,
        }
      )
    }

    return result
  } catch (error) {
    console.error(`[N+1 ERROR] ${operationName} failed after ${tracker.count} queries`)
    throw error
  }
}

/**
 * Query tracker for detecting N+1 patterns
 */
export class QueryTracker {
  queries: string[] = []
  
  get count(): number {
    return this.queries.length
  }

  track(queryName: string): void {
    this.queries.push(queryName)
  }

  async trackQuery<T>(queryName: string, query: () => Promise<T>): Promise<T> {
    this.track(queryName)
    return await query()
  }
}

