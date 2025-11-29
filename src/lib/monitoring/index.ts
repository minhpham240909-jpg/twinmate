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

