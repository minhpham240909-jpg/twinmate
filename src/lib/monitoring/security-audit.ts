/**
 * Security Audit Logging
 * 
 * Provides comprehensive logging for security-relevant events including:
 * - Authentication attempts (success/failure)
 * - Authorization failures
 * - Suspicious activity detection
 * - Admin actions
 * - Rate limiting events
 * 
 * In production, logs are sent to Sentry for monitoring and alerting.
 */

import * as Sentry from '@sentry/nextjs'
import logger from '@/lib/logger'

// ===== TYPES =====

export type SecurityEventType =
  // Authentication Events
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.login.blocked'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.password_reset_request'
  | 'auth.password_reset_complete'
  | 'auth.2fa_enabled'
  | 'auth.2fa_disabled'
  | 'auth.2fa_success'
  | 'auth.2fa_failure'
  | 'auth.session_expired'
  | 'auth.session_rotated'
  // Authorization Events
  | 'authz.access_denied'
  | 'authz.admin_action'
  | 'authz.privilege_escalation_attempt'
  // Account Events
  | 'account.created'
  | 'account.deactivated'
  | 'account.reactivated'
  | 'account.deleted'
  | 'account.email_changed'
  | 'account.password_changed'
  // Security Events
  | 'security.rate_limited'
  | 'security.csrf_violation'
  | 'security.suspicious_activity'
  | 'security.ip_change'
  | 'security.blocked_user_attempt'
  // Admin Events
  | 'admin.user_banned'
  | 'admin.user_unbanned'
  | 'admin.user_warned'
  | 'admin.admin_granted'
  | 'admin.admin_revoked'

export interface SecurityEvent {
  type: SecurityEventType
  userId?: string
  targetUserId?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Severity levels for each event type
const EVENT_SEVERITY: Record<SecurityEventType, SecurityEvent['severity']> = {
  // Auth events
  'auth.login.success': 'low',
  'auth.login.failure': 'medium',
  'auth.login.blocked': 'high',
  'auth.logout': 'low',
  'auth.signup': 'low',
  'auth.password_reset_request': 'low',
  'auth.password_reset_complete': 'medium',
  'auth.2fa_enabled': 'low',
  'auth.2fa_disabled': 'medium',
  'auth.2fa_success': 'low',
  'auth.2fa_failure': 'medium',
  'auth.session_expired': 'low',
  'auth.session_rotated': 'medium',
  // Authz events
  'authz.access_denied': 'medium',
  'authz.admin_action': 'medium',
  'authz.privilege_escalation_attempt': 'critical',
  // Account events
  'account.created': 'low',
  'account.deactivated': 'medium',
  'account.reactivated': 'low',
  'account.deleted': 'high',
  'account.email_changed': 'medium',
  'account.password_changed': 'medium',
  // Security events
  'security.rate_limited': 'medium',
  'security.csrf_violation': 'high',
  'security.suspicious_activity': 'high',
  'security.ip_change': 'medium',
  'security.blocked_user_attempt': 'medium',
  // Admin events
  'admin.user_banned': 'medium',
  'admin.user_unbanned': 'medium',
  'admin.user_warned': 'low',
  'admin.admin_granted': 'high',
  'admin.admin_revoked': 'high',
}

// ===== CORE LOGGING FUNCTION =====

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'severity'>): void {
  const severity = EVENT_SEVERITY[event.type]
  const fullEvent: SecurityEvent = { ...event, severity }
  
  // Format log message
  const message = `[SECURITY] ${event.type}`
  const logData = {
    eventType: event.type,
    severity,
    userId: event.userId,
    targetUserId: event.targetUserId,
    ip: sanitizeIp(event.ip),
    userAgent: event.userAgent?.substring(0, 100), // Truncate user agent
    ...event.metadata,
    timestamp: new Date().toISOString(),
  }
  
  // Log based on severity
  switch (severity) {
    case 'critical':
      logger.error(message, logData)
      sendToSentry(fullEvent, 'fatal')
      break
    case 'high':
      logger.warn(message, logData)
      sendToSentry(fullEvent, 'error')
      break
    case 'medium':
      logger.info(message, logData)
      sendToSentry(fullEvent, 'warning')
      break
    case 'low':
      logger.debug(message, logData)
      // Low severity events are only logged, not sent to Sentry
      break
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Sanitize IP address for logging (mask last octet for privacy)
 */
function sanitizeIp(ip?: string): string | undefined {
  if (!ip) return undefined
  // For IPv4, mask last octet: 192.168.1.100 -> 192.168.1.xxx
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
  }
  // For IPv6, show only first 4 groups
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 4).join(':') + ':...'
  }
  return ip
}

/**
 * Send event to Sentry
 */
function sendToSentry(
  event: SecurityEvent,
  level: 'fatal' | 'error' | 'warning' | 'info'
): void {
  if (process.env.NODE_ENV === 'development') return
  
  Sentry.captureMessage(`Security Event: ${event.type}`, {
    level,
    tags: {
      security_event: event.type,
      severity: event.severity,
    },
    extra: {
      userId: event.userId,
      targetUserId: event.targetUserId,
      metadata: event.metadata,
    },
  })
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Log successful login
 */
export function logLoginSuccess(userId: string, ip?: string, userAgent?: string): void {
  logSecurityEvent({
    type: 'auth.login.success',
    userId,
    ip,
    userAgent,
  })
}

/**
 * Log failed login attempt
 */
export function logLoginFailure(
  email: string,
  reason: string,
  ip?: string,
  userAgent?: string
): void {
  logSecurityEvent({
    type: 'auth.login.failure',
    ip,
    userAgent,
    metadata: { email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), reason },
  })
}

/**
 * Log blocked login (account locked)
 */
export function logLoginBlocked(
  email: string,
  reason: string,
  ip?: string
): void {
  logSecurityEvent({
    type: 'auth.login.blocked',
    ip,
    metadata: { email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), reason },
  })
}

/**
 * Log rate limiting event
 */
export function logRateLimited(
  endpoint: string,
  userId?: string,
  ip?: string
): void {
  logSecurityEvent({
    type: 'security.rate_limited',
    userId,
    ip,
    metadata: { endpoint },
  })
}

/**
 * Log CSRF violation
 */
export function logCsrfViolation(
  endpoint: string,
  ip?: string,
  origin?: string
): void {
  logSecurityEvent({
    type: 'security.csrf_violation',
    ip,
    metadata: { endpoint, origin },
  })
}

/**
 * Log access denied
 */
export function logAccessDenied(
  userId: string,
  resource: string,
  reason: string,
  ip?: string
): void {
  logSecurityEvent({
    type: 'authz.access_denied',
    userId,
    ip,
    metadata: { resource, reason },
  })
}

/**
 * Log admin action
 */
export function logAdminAction(
  adminId: string,
  action: string,
  targetUserId?: string,
  metadata?: Record<string, any>
): void {
  logSecurityEvent({
    type: 'authz.admin_action',
    userId: adminId,
    targetUserId,
    metadata: { action, ...metadata },
  })
}

/**
 * Log suspicious activity
 */
export function logSuspiciousActivity(
  description: string,
  userId?: string,
  ip?: string,
  metadata?: Record<string, any>
): void {
  logSecurityEvent({
    type: 'security.suspicious_activity',
    userId,
    ip,
    metadata: { description, ...metadata },
  })
}

/**
 * Log privilege escalation attempt
 */
export function logPrivilegeEscalationAttempt(
  userId: string,
  attemptedAction: string,
  ip?: string
): void {
  logSecurityEvent({
    type: 'authz.privilege_escalation_attempt',
    userId,
    ip,
    metadata: { attemptedAction },
  })
}

