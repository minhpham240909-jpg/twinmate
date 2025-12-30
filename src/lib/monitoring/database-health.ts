/**
 * Database Health Monitoring
 *
 * Provides health checks, connection monitoring, and alerting for the database.
 * Designed to support 1000-3000 concurrent users with early warning detection.
 *
 * Features:
 * - Connection health checks
 * - Query performance monitoring
 * - Connection pool status
 * - Slow query detection
 * - Health status endpoint data
 */

import { prisma } from '@/lib/prisma'

// Health check configuration
const HEALTH_CONFIG = {
  // Query timeout for health checks (ms)
  healthCheckTimeoutMs: 5000,

  // Slow query threshold (ms)
  slowQueryThresholdMs: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '3000', 10),

  // Maximum acceptable connection time (ms)
  maxConnectionTimeMs: 2000,

  // Health check interval (ms)
  checkIntervalMs: 30000,

  // Number of recent queries to track for performance
  queryHistorySize: 100,
}

// Health status types
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface DatabaseHealth {
  status: HealthStatus
  responseTimeMs: number
  connectionPoolSize?: number
  activeConnections?: number
  lastCheckedAt: Date
  details: {
    canConnect: boolean
    canQuery: boolean
    connectionTimeMs: number
    queryTimeMs: number
    recentSlowQueries: number
    errorMessage?: string
  }
}

export interface QueryMetrics {
  totalQueries: number
  slowQueries: number
  averageQueryTimeMs: number
  errorCount: number
  queriesPerMinute: number
}

// State tracking
let lastHealthCheck: DatabaseHealth | null = null
let queryMetrics: QueryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  averageQueryTimeMs: 0,
  errorCount: 0,
  queriesPerMinute: 0,
}

const recentQueryTimes: number[] = []
const queryTimestamps: number[] = []
let healthCheckInterval: NodeJS.Timeout | null = null

/**
 * Perform a database health check
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now()
  let canConnect = false
  let canQuery = false
  let connectionTimeMs = 0
  let queryTimeMs = 0
  let errorMessage: string | undefined

  try {
    // Test connection with timeout
    const connectionStart = Date.now()
    const connectionResult = await Promise.race([
      prisma.$queryRaw`SELECT 1 as connection_test`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), HEALTH_CONFIG.healthCheckTimeoutMs)
      ),
    ])

    connectionTimeMs = Date.now() - connectionStart
    canConnect = true

    // Test actual query capability
    const queryStart = Date.now()
    await Promise.race([
      prisma.user.count(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), HEALTH_CONFIG.healthCheckTimeoutMs)
      ),
    ])

    queryTimeMs = Date.now() - queryStart
    canQuery = true

  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Database Health] Check failed:', errorMessage)
  }

  const totalTimeMs = Date.now() - startTime

  // Determine health status
  let status: HealthStatus = 'healthy'

  if (!canConnect || !canQuery) {
    status = 'unhealthy'
  } else if (
    connectionTimeMs > HEALTH_CONFIG.maxConnectionTimeMs ||
    queryTimeMs > HEALTH_CONFIG.slowQueryThresholdMs
  ) {
    status = 'degraded'
  }

  const health: DatabaseHealth = {
    status,
    responseTimeMs: totalTimeMs,
    lastCheckedAt: new Date(),
    details: {
      canConnect,
      canQuery,
      connectionTimeMs,
      queryTimeMs,
      recentSlowQueries: queryMetrics.slowQueries,
      errorMessage,
    },
  }

  lastHealthCheck = health

  // Log if not healthy
  if (status !== 'healthy') {
    console.warn('[Database Health] Status:', status, health.details)
  }

  return health
}

/**
 * Get the last health check result (cached)
 */
export function getLastHealthCheck(): DatabaseHealth | null {
  return lastHealthCheck
}

/**
 * Record a query execution time
 */
export function recordQueryTime(timeMs: number, isError: boolean = false): void {
  const now = Date.now()

  // Update totals
  queryMetrics.totalQueries++
  if (isError) {
    queryMetrics.errorCount++
  }
  if (timeMs > HEALTH_CONFIG.slowQueryThresholdMs) {
    queryMetrics.slowQueries++
  }

  // Track recent query times
  recentQueryTimes.push(timeMs)
  queryTimestamps.push(now)

  // Trim to history size
  while (recentQueryTimes.length > HEALTH_CONFIG.queryHistorySize) {
    recentQueryTimes.shift()
    queryTimestamps.shift()
  }

  // Calculate average
  queryMetrics.averageQueryTimeMs =
    recentQueryTimes.reduce((a, b) => a + b, 0) / recentQueryTimes.length

  // Calculate queries per minute (last 60 seconds)
  const oneMinuteAgo = now - 60000
  queryMetrics.queriesPerMinute = queryTimestamps.filter(t => t > oneMinuteAgo).length
}

/**
 * Get current query metrics
 */
export function getQueryMetrics(): QueryMetrics {
  return { ...queryMetrics }
}

/**
 * Create a Prisma query wrapper that tracks performance
 */
export function withQueryTracking<T>(
  queryFn: () => Promise<T>,
  queryName?: string
): Promise<T> {
  const startTime = Date.now()

  return queryFn()
    .then((result) => {
      const timeMs = Date.now() - startTime
      recordQueryTime(timeMs)

      // Log slow queries in development
      if (process.env.NODE_ENV === 'development' && timeMs > HEALTH_CONFIG.slowQueryThresholdMs) {
        console.warn(`[Slow Query] ${queryName || 'Unknown'}: ${timeMs}ms`)
      }

      return result
    })
    .catch((error) => {
      const timeMs = Date.now() - startTime
      recordQueryTime(timeMs, true)
      throw error
    })
}

/**
 * Get comprehensive health status for monitoring endpoints
 */
export async function getHealthStatus(): Promise<{
  database: DatabaseHealth
  queries: QueryMetrics
  overall: HealthStatus
}> {
  // Use cached health if recent enough, otherwise check
  let health = lastHealthCheck
  if (!health || Date.now() - health.lastCheckedAt.getTime() > HEALTH_CONFIG.checkIntervalMs) {
    health = await checkDatabaseHealth()
  }

  // Determine overall status
  let overall: HealthStatus = health.status

  // Downgrade if error rate is high
  const errorRate = queryMetrics.totalQueries > 0
    ? queryMetrics.errorCount / queryMetrics.totalQueries
    : 0

  if (errorRate > 0.1 && overall === 'healthy') {
    overall = 'degraded'
  }
  if (errorRate > 0.3 && overall !== 'unhealthy') {
    overall = 'unhealthy'
  }

  return {
    database: health,
    queries: getQueryMetrics(),
    overall,
  }
}

/**
 * Start periodic health checks
 */
export function startHealthChecks(): void {
  if (healthCheckInterval) {
    return // Already running
  }

  console.log('[Database Health] Starting periodic health checks')

  healthCheckInterval = setInterval(async () => {
    try {
      await checkDatabaseHealth()
    } catch (error) {
      console.error('[Database Health] Periodic check failed:', error)
    }
  }, HEALTH_CONFIG.checkIntervalMs)

  // Run initial check
  checkDatabaseHealth().catch(console.error)
}

/**
 * Stop periodic health checks
 */
export function stopHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
    console.log('[Database Health] Stopped periodic health checks')
  }
}

/**
 * Reset metrics (for testing or maintenance)
 */
export function resetMetrics(): void {
  queryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    averageQueryTimeMs: 0,
    errorCount: 0,
    queriesPerMinute: 0,
  }
  recentQueryTimes.length = 0
  queryTimestamps.length = 0
  lastHealthCheck = null
}

// Auto-start health checks in production
if (process.env.NODE_ENV === 'production' && typeof setInterval !== 'undefined') {
  startHealthChecks()
}

export default {
  checkDatabaseHealth,
  getLastHealthCheck,
  getQueryMetrics,
  getHealthStatus,
  recordQueryTime,
  withQueryTracking,
  startHealthChecks,
  stopHealthChecks,
  resetMetrics,
}
