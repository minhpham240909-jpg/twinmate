// Admin Dashboard Monitoring & Alerts
// Real-time health monitoring and alerting for admin dashboard performance
// Detects issues before they impact users

import { prisma } from '@/lib/prisma'
import { getPoolStats } from './connection-pool'
import { getAdminPerformanceStats } from './performance'

// =====================================================
// TYPES
// =====================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  metric: string
  value: number
  threshold: number
  timestamp: Date
  resolved: boolean
}

export interface HealthCheck {
  healthy: boolean
  score: number // 0-100
  checks: Array<{
    name: string
    status: 'pass' | 'warn' | 'fail'
    message: string
    duration?: number
  }>
  alerts: Alert[]
  timestamp: Date
}

// =====================================================
// HEALTH MONITORING
// =====================================================

/**
 * Run comprehensive health check on admin dashboard
 * Returns overall health score and specific issues
 */
export async function runHealthCheck(): Promise<HealthCheck> {
  const startTime = Date.now()
  const checks: HealthCheck['checks'] = []
  const alerts: Alert[] = []

  // 1. Database connection check
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbDuration = Date.now() - dbStart

    checks.push({
      name: 'Database Connection',
      status: dbDuration < 100 ? 'pass' : dbDuration < 500 ? 'warn' : 'fail',
      message: `Database responding in ${dbDuration}ms`,
      duration: dbDuration,
    })

    if (dbDuration > 500) {
      alerts.push({
        id: `db-slow-${Date.now()}`,
        severity: 'warning',
        title: 'Slow Database Response',
        message: `Database query took ${dbDuration}ms (threshold: 500ms)`,
        metric: 'database_latency',
        value: dbDuration,
        threshold: 500,
        timestamp: new Date(),
        resolved: false,
      })
    }
  } catch (error: any) {
    checks.push({
      name: 'Database Connection',
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
    })

    alerts.push({
      id: `db-error-${Date.now()}`,
      severity: 'critical',
      title: 'Database Connection Failed',
      message: error.message,
      metric: 'database_available',
      value: 0,
      threshold: 1,
      timestamp: new Date(),
      resolved: false,
    })
  }

  // 2. Connection pool health
  try {
    const poolStats = await getPoolStats(prisma)

    const poolStatus =
      poolStats.utilization < 70 ? 'pass' :
      poolStats.utilization < 90 ? 'warn' : 'fail'

    checks.push({
      name: 'Connection Pool',
      status: poolStatus,
      message: `Pool utilization: ${poolStats.utilization}% (${poolStats.active}/${poolStats.total} active)`,
    })

    if (poolStats.utilization > 80) {
      alerts.push({
        id: `pool-high-${Date.now()}`,
        severity: poolStats.utilization > 90 ? 'error' : 'warning',
        title: 'High Connection Pool Utilization',
        message: `Connection pool at ${poolStats.utilization}% capacity`,
        metric: 'pool_utilization',
        value: poolStats.utilization,
        threshold: 80,
        timestamp: new Date(),
        resolved: false,
      })
    }
  } catch (error: any) {
    checks.push({
      name: 'Connection Pool',
      status: 'warn',
      message: `Could not check pool stats: ${error.message}`,
    })
  }

  // 3. Materialized view freshness
  try {
    const viewStatus = await prisma.$queryRaw<Array<{
      generated_at: Date
      cache_age_seconds: number
    }>>`
      SELECT
        generated_at,
        EXTRACT(EPOCH FROM (NOW() - generated_at))::INTEGER as cache_age_seconds
      FROM admin_dashboard_stats
      ORDER BY generated_at DESC
      LIMIT 1
    `

    if (viewStatus.length > 0) {
      const age = viewStatus[0].cache_age_seconds

      const viewHealthStatus =
        age < 60 ? 'pass' :
        age < 300 ? 'warn' : 'fail'

      checks.push({
        name: 'Materialized Views',
        status: viewHealthStatus,
        message: `Views refreshed ${age}s ago`,
      })

      if (age > 120) {
        alerts.push({
          id: `view-stale-${Date.now()}`,
          severity: age > 300 ? 'error' : 'warning',
          title: 'Stale Materialized Views',
          message: `Dashboard views are ${age}s old (threshold: 120s)`,
          metric: 'view_age',
          value: age,
          threshold: 120,
          timestamp: new Date(),
          resolved: false,
        })
      }
    } else {
      checks.push({
        name: 'Materialized Views',
        status: 'fail',
        message: 'Materialized views not initialized',
      })
    }
  } catch (error: any) {
    checks.push({
      name: 'Materialized Views',
      status: 'warn',
      message: `Could not check view status: ${error.message}`,
    })
  }

  // 4. API performance check
  try {
    const perfStats = await getAdminPerformanceStats()

    const avgDuration = perfStats.overall.avgDuration
    const errorRate = perfStats.overall.errorRate

    const perfStatus =
      avgDuration < 500 && errorRate < 1 ? 'pass' :
      avgDuration < 1000 && errorRate < 5 ? 'warn' : 'fail'

    checks.push({
      name: 'API Performance',
      status: perfStatus,
      message: `Avg response: ${avgDuration}ms, Error rate: ${errorRate}%`,
      duration: avgDuration,
    })

    if (avgDuration > 1000) {
      alerts.push({
        id: `api-slow-${Date.now()}`,
        severity: 'warning',
        title: 'Slow API Response Times',
        message: `Average API response time is ${avgDuration}ms`,
        metric: 'api_avg_duration',
        value: avgDuration,
        threshold: 1000,
        timestamp: new Date(),
        resolved: false,
      })
    }

    if (errorRate > 5) {
      alerts.push({
        id: `api-errors-${Date.now()}`,
        severity: 'error',
        title: 'High API Error Rate',
        message: `API error rate is ${errorRate}%`,
        metric: 'api_error_rate',
        value: errorRate,
        threshold: 5,
        timestamp: new Date(),
        resolved: false,
      })
    }
  } catch (error: any) {
    checks.push({
      name: 'API Performance',
      status: 'warn',
      message: `Could not check API performance: ${error.message}`,
    })
  }

  // 5. Cache health check
  try {
    const cacheStart = Date.now()
    const { getOrSetCached } = await import('@/lib/cache')

    await getOrSetCached('health-check', 60, async () => 'ok')
    const cacheDuration = Date.now() - cacheStart

    checks.push({
      name: 'Cache System',
      status: cacheDuration < 50 ? 'pass' : 'warn',
      message: `Cache responding in ${cacheDuration}ms`,
      duration: cacheDuration,
    })
  } catch (error: any) {
    checks.push({
      name: 'Cache System',
      status: 'warn',
      message: `Cache check failed: ${error.message}`,
    })
  }

  // Calculate overall health score
  const passCount = checks.filter(c => c.status === 'pass').length
  const warnCount = checks.filter(c => c.status === 'warn').length
  const failCount = checks.filter(c => c.status === 'fail').length

  const score = Math.round(
    ((passCount * 1.0) + (warnCount * 0.5) + (failCount * 0.0)) / checks.length * 100
  )

  const healthy = failCount === 0 && warnCount < checks.length * 0.3

  return {
    healthy,
    score,
    checks,
    alerts,
    timestamp: new Date(),
  }
}

// =====================================================
// PERFORMANCE METRICS
// =====================================================

export interface DashboardMetrics {
  responseTime: {
    p50: number
    p95: number
    p99: number
  }
  throughput: {
    requestsPerMinute: number
    requestsPerSecond: number
  }
  errors: {
    total: number
    rate: number
  }
  cache: {
    hitRate: number
    missRate: number
  }
  database: {
    activeConnections: number
    queryDuration: number
  }
}

/**
 * Get current dashboard performance metrics
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const perfStats = await getAdminPerformanceStats()
  const poolStats = await getPoolStats(prisma)

  return {
    responseTime: {
      p50: perfStats.overall.p50Duration,
      p95: perfStats.overall.p95Duration,
      p99: perfStats.overall.p99Duration,
    },
    throughput: {
      requestsPerMinute: Math.round((perfStats.overall.totalRequests / 60) * 100) / 100,
      requestsPerSecond: Math.round((perfStats.overall.totalRequests / 3600) * 100) / 100,
    },
    errors: {
      total: Math.round(perfStats.overall.totalRequests * (perfStats.overall.errorRate / 100)),
      rate: perfStats.overall.errorRate,
    },
    cache: {
      hitRate: perfStats.overall.cacheHitRate,
      missRate: 100 - perfStats.overall.cacheHitRate,
    },
    database: {
      activeConnections: poolStats.active,
      queryDuration: perfStats.overall.avgDuration,
    },
  }
}

// =====================================================
// ALERT MANAGEMENT
// =====================================================

const activeAlerts: Map<string, Alert> = new Map()

/**
 * Record a new alert
 */
export function recordAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): Alert {
  const fullAlert: Alert = {
    ...alert,
    id: `${alert.metric}-${Date.now()}`,
    timestamp: new Date(),
    resolved: false,
  }

  activeAlerts.set(fullAlert.id, fullAlert)

  // Log critical alerts
  if (alert.severity === 'critical' || alert.severity === 'error') {
    console.error(`[Alert] ${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`)
  } else {
    console.warn(`[Alert] ${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`)
  }

  return fullAlert
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string): void {
  const alert = activeAlerts.get(alertId)
  if (alert) {
    alert.resolved = true
    console.log(`[Alert] Resolved: ${alert.title}`)
  }
}

/**
 * Get all active alerts
 */
export function getActiveAlerts(): Alert[] {
  return Array.from(activeAlerts.values()).filter(a => !a.resolved)
}

/**
 * Clear old resolved alerts (keep last 24 hours)
 */
export function clearOldAlerts(): void {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000)

  for (const [id, alert] of activeAlerts.entries()) {
    if (alert.resolved && alert.timestamp.getTime() < cutoff) {
      activeAlerts.delete(id)
    }
  }
}

// =====================================================
// AUTOMATED MONITORING
// =====================================================

let monitoringInterval: NodeJS.Timeout | null = null

/**
 * Start automated health monitoring
 * Runs health check every minute and generates alerts
 */
export function startMonitoring(intervalMs: number = 60000): void {
  if (monitoringInterval) {
    console.warn('[Monitoring] Already running')
    return
  }

  console.log('[Monitoring] Starting automated health monitoring')

  monitoringInterval = setInterval(async () => {
    try {
      const health = await runHealthCheck()

      if (!health.healthy) {
        console.warn(`[Monitoring] Health check failed (score: ${health.score}/100)`)
      }

      // Clear old alerts
      clearOldAlerts()
    } catch (error) {
      console.error('[Monitoring] Health check error:', error)
    }
  }, intervalMs)
}

/**
 * Stop automated monitoring
 */
export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
    console.log('[Monitoring] Stopped automated health monitoring')
  }
}

// =====================================================
// DIAGNOSTIC UTILITIES
// =====================================================

/**
 * Generate diagnostic report for troubleshooting
 */
export async function generateDiagnosticReport(): Promise<{
  health: HealthCheck
  metrics: DashboardMetrics
  alerts: Alert[]
  systemInfo: {
    nodeVersion: string
    platform: string
    memory: {
      used: number
      total: number
      percentage: number
    }
  }
}> {
  const health = await runHealthCheck()
  const metrics = await getDashboardMetrics()
  const alerts = getActiveAlerts()

  const memUsage = process.memoryUsage()

  return {
    health,
    metrics,
    alerts,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
    },
  }
}
