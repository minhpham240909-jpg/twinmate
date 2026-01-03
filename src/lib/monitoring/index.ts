/**
 * Monitoring Module
 *
 * Exports all monitoring and logging utilities.
 */

// Security Audit Logging
export {
  type SecurityEventType,
  type SecurityEvent,
  logSecurityEvent,
  logLoginSuccess,
  logLoginFailure,
  logLoginBlocked,
  logRateLimited,
  logCsrfViolation,
  logAccessDenied,
  logAdminAction,
  logSuspiciousActivity,
  logPrivilegeEscalationAttempt,
} from './security-audit'

// Performance Monitoring
export {
  trackRequestPerformance,
  getErrorRate,
  getPerformanceSummary,
  getSlowEndpoints,
  withPerformanceTracking,
  startTransaction,
} from './performance'

// Application Metrics
export {
  // Metric recording
  recordCacheHit,
  recordCacheMiss,
  updateCacheSize,
  recordCacheEviction,
  recordApiRequest,
  recordApiTimeout,
  resetMetrics,
  // Metric retrieval
  getCacheMetrics,
  getApiMetrics,
  getSystemMetrics,
  getHealthStatus,
  // Types
  type QueueMetrics,
  type CacheMetrics,
  type ApiMetrics,
  type SystemMetrics,
  type HealthStatus,
} from './metrics'

