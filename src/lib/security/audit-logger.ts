/**
 * Comprehensive Audit Logging System
 * 
 * Provides detailed audit trail for:
 * - Security events (authentication, authorization)
 * - Admin actions
 * - Data modifications
 * - System events
 * 
 * SCALABILITY: Designed for high-throughput with async batch writes
 * COMPLIANCE: Supports GDPR, SOC2, and other compliance requirements
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

// ===== TYPES =====

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'user_management'
  | 'data_access'
  | 'data_modification'
  | 'security'
  | 'admin'
  | 'system'
  | 'content_moderation'
  | 'billing'

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export interface AuditEvent {
  // Event identification
  category: AuditCategory
  action: string
  
  // Actor information
  userId?: string | null
  adminId?: string | null
  sessionId?: string | null
  deviceId?: string | null
  
  // Target information
  targetType?: string
  targetId?: string
  targetUserId?: string
  
  // Request context
  ip?: string
  userAgent?: string
  method?: string
  path?: string
  origin?: string
  
  // Event details
  details?: Record<string, unknown>
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  
  // Severity and result
  severity?: AuditSeverity
  success?: boolean
  errorMessage?: string
  
  // Timing
  durationMs?: number
}

// ===== CONFIGURATION =====

const AUDIT_CONFIG = {
  // Enable async batch writes for performance
  batchEnabled: process.env.AUDIT_BATCH_ENABLED !== 'false',
  batchSize: parseInt(process.env.AUDIT_BATCH_SIZE || '50'),
  batchIntervalMs: parseInt(process.env.AUDIT_BATCH_INTERVAL_MS || '5000'),
  
  // Retention settings (days)
  retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365'),
  
  // Enable database persistence
  persistToDb: process.env.AUDIT_PERSIST_DB !== 'false',
  
  // Send high-severity events to Sentry
  sentryEnabled: process.env.NODE_ENV === 'production',
}

// ===== BATCH QUEUE =====

let auditQueue: Array<AuditEvent & { timestamp: Date }> = []
let batchTimer: NodeJS.Timeout | null = null

/**
 * Flush audit queue to database
 */
async function flushAuditQueue(): Promise<void> {
  if (auditQueue.length === 0) return
  
  const eventsToWrite = [...auditQueue]
  auditQueue = []
  
  if (!AUDIT_CONFIG.persistToDb) {
    // Just log to console if DB persistence disabled
    eventsToWrite.forEach(event => {
      logger.info(`[AUDIT] ${event.category}:${event.action}`, event)
    })
    return
  }
  
  try {
    // Batch insert to AdminAuditLog table
    // FIX: Properly serialize JSON fields for Prisma
    await prisma.adminAuditLog.createMany({
      data: eventsToWrite.map(event => ({
        adminId: event.adminId || event.userId || null,
        adminName: null, // Will be populated from cache if needed
        adminEmail: null,
        action: `${event.category}:${event.action}`,
        targetType: event.targetType || 'system',
        targetId: event.targetId || event.targetUserId || 'n/a',
        details: JSON.parse(JSON.stringify({
          ...event.details,
          severity: event.severity,
          success: event.success,
          errorMessage: event.errorMessage,
          previousState: event.previousState,
          newState: event.newState,
          durationMs: event.durationMs,
          sessionId: event.sessionId,
          deviceId: event.deviceId,
          method: event.method,
          path: event.path,
          origin: event.origin,
          timestamp: event.timestamp.toISOString(),
        })),
        ipAddress: sanitizeIp(event.ip),
        userAgent: event.userAgent?.substring(0, 500),
        createdAt: event.timestamp,
      })),
      skipDuplicates: true,
    })
    
    logger.debug(`[AUDIT] Flushed ${eventsToWrite.length} audit events to database`)
  } catch (error) {
    logger.error('[AUDIT] Failed to flush audit queue', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventCount: eventsToWrite.length,
    })
    
    // Re-queue failed events (with limit to prevent memory issues)
    if (auditQueue.length < 1000) {
      auditQueue.push(...eventsToWrite)
    }
  }
}

/**
 * Start batch flush timer
 */
function startBatchTimer(): void {
  if (batchTimer || !AUDIT_CONFIG.batchEnabled) return
  
  batchTimer = setInterval(() => {
    flushAuditQueue().catch(err => {
      logger.error('[AUDIT] Batch timer flush failed', { error: err })
    })
  }, AUDIT_CONFIG.batchIntervalMs)
}

/**
 * Stop batch flush timer (for graceful shutdown)
 */
export function stopBatchTimer(): void {
  if (batchTimer) {
    clearInterval(batchTimer)
    batchTimer = null
  }
}

// ===== CORE LOGGING FUNCTION =====

/**
 * Log an audit event
 * 
 * @param event - Audit event details
 */
export async function logAudit(event: AuditEvent): Promise<void> {
  const timestamp = new Date()
  const severity = event.severity || determineSeverity(event)
  
  const fullEvent = {
    ...event,
    severity,
    timestamp,
  }
  
  // Always log to console/logger
  const logLevel = severity === 'critical' || severity === 'error' ? 'error'
    : severity === 'warning' ? 'warn'
    : 'info'
  
  logger[logLevel](`[AUDIT] ${event.category}:${event.action}`, {
    userId: event.userId,
    targetId: event.targetId,
    success: event.success,
    ip: sanitizeIp(event.ip),
  })
  
  // Send high-severity to Sentry
  if (AUDIT_CONFIG.sentryEnabled && (severity === 'critical' || severity === 'error')) {
    Sentry.captureMessage(`Audit: ${event.category}:${event.action}`, {
      level: severity === 'critical' ? 'fatal' : 'error',
      tags: {
        audit_category: event.category,
        audit_action: event.action,
        audit_severity: severity,
      },
      extra: {
        userId: event.userId,
        targetId: event.targetId,
        success: event.success,
        errorMessage: event.errorMessage,
      },
    })
  }
  
  // Add to batch queue or write immediately
  if (AUDIT_CONFIG.batchEnabled) {
    auditQueue.push(fullEvent)
    
    // Flush immediately if queue is full
    if (auditQueue.length >= AUDIT_CONFIG.batchSize) {
      await flushAuditQueue()
    } else {
      startBatchTimer()
    }
  } else if (AUDIT_CONFIG.persistToDb) {
    // Write immediately (slower but synchronous)
    await flushSingleEvent(fullEvent)
  }
}

/**
 * Flush a single event immediately
 */
async function flushSingleEvent(event: AuditEvent & { timestamp: Date }): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: event.adminId || event.userId || null,
        action: `${event.category}:${event.action}`,
        targetType: event.targetType || 'system',
        targetId: event.targetId || event.targetUserId || 'n/a',
        details: JSON.parse(JSON.stringify({
          ...event.details,
          severity: event.severity,
          success: event.success,
          errorMessage: event.errorMessage,
        })),
        ipAddress: sanitizeIp(event.ip),
        userAgent: event.userAgent?.substring(0, 500),
        createdAt: event.timestamp,
      },
    })
  } catch (error) {
    logger.error('[AUDIT] Failed to write single event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      action: event.action,
    })
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Determine severity based on event type
 */
function determineSeverity(event: AuditEvent): AuditSeverity {
  // Failed security events are higher severity
  if (!event.success && event.category === 'authentication') return 'warning'
  if (!event.success && event.category === 'authorization') return 'warning'
  if (!event.success && event.category === 'security') return 'error'
  
  // Specific actions
  if (event.action.includes('delete') || event.action.includes('ban')) return 'warning'
  if (event.action.includes('escalation') || event.action.includes('privilege')) return 'critical'
  if (event.action.includes('password') || event.action.includes('2fa')) return 'info'
  
  // Admin actions
  if (event.category === 'admin') return 'info'
  
  // Default
  return 'info'
}

/**
 * Sanitize IP address for logging (privacy)
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
 * Extract request context from headers
 */
export function extractRequestContext(headers: Headers): {
  ip: string
  userAgent: string
  origin?: string
} {
  return {
    ip: headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        headers.get('x-real-ip') ||
        'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
    origin: headers.get('origin') || undefined,
  }
}

// ===== CONVENIENCE FUNCTIONS =====

// Authentication events
export function logLogin(params: {
  userId: string
  success: boolean
  method: 'password' | 'oauth' | '2fa' | 'backup_code'
  ip?: string
  userAgent?: string
  errorMessage?: string
}): Promise<void> {
  return logAudit({
    category: 'authentication',
    action: params.success ? 'login_success' : 'login_failure',
    userId: params.userId,
    ip: params.ip,
    userAgent: params.userAgent,
    success: params.success,
    errorMessage: params.errorMessage,
    details: { method: params.method },
  })
}

export function logLogout(params: {
  userId: string
  reason: 'user_initiated' | 'session_expired' | 'password_changed' | 'admin_action' | 'security'
  ip?: string
}): Promise<void> {
  return logAudit({
    category: 'authentication',
    action: 'logout',
    userId: params.userId,
    ip: params.ip,
    success: true,
    details: { reason: params.reason },
  })
}

export function logPasswordChange(params: {
  userId: string
  success: boolean
  ip?: string
  invalidatedSessions?: number
}): Promise<void> {
  return logAudit({
    category: 'authentication',
    action: 'password_changed',
    userId: params.userId,
    ip: params.ip,
    success: params.success,
    details: { invalidatedSessions: params.invalidatedSessions },
  })
}

export function log2FAChange(params: {
  userId: string
  action: 'enabled' | 'disabled' | 'verified'
  success: boolean
  ip?: string
}): Promise<void> {
  return logAudit({
    category: 'authentication',
    action: `2fa_${params.action}`,
    userId: params.userId,
    ip: params.ip,
    success: params.success,
  })
}

// Authorization events
export function logAccessDenied(params: {
  userId: string
  resource: string
  reason: string
  ip?: string
}): Promise<void> {
  return logAudit({
    category: 'authorization',
    action: 'access_denied',
    userId: params.userId,
    targetType: 'resource',
    targetId: params.resource,
    ip: params.ip,
    success: false,
    errorMessage: params.reason,
  })
}

// Admin events
export function logAdminAction(params: {
  adminId: string
  action: string
  targetType: string
  targetId: string
  targetUserId?: string
  details?: Record<string, unknown>
  ip?: string
}): Promise<void> {
  return logAudit({
    category: 'admin',
    action: params.action,
    adminId: params.adminId,
    targetType: params.targetType,
    targetId: params.targetId,
    targetUserId: params.targetUserId,
    ip: params.ip,
    success: true,
    details: params.details,
  })
}

// Data modification events
export function logDataModification(params: {
  userId: string
  action: 'create' | 'update' | 'delete'
  targetType: string
  targetId: string
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  ip?: string
}): Promise<void> {
  return logAudit({
    category: 'data_modification',
    action: params.action,
    userId: params.userId,
    targetType: params.targetType,
    targetId: params.targetId,
    previousState: params.previousState,
    newState: params.newState,
    ip: params.ip,
    success: true,
  })
}

// Security events
export function logSecurityEvent(params: {
  type: 'rate_limited' | 'csrf_violation' | 'suspicious_activity' | 'blocked_request' | 'session_hijack_attempt'
  userId?: string
  ip?: string
  details?: Record<string, unknown>
}): Promise<void> {
  return logAudit({
    category: 'security',
    action: params.type,
    userId: params.userId,
    ip: params.ip,
    success: false,
    severity: params.type === 'session_hijack_attempt' ? 'critical' : 'warning',
    details: params.details,
  })
}

// Content moderation events
export function logModerationAction(params: {
  adminId?: string
  action: 'flagged' | 'approved' | 'removed' | 'warned' | 'banned'
  contentType: string
  contentId: string
  targetUserId: string
  reason?: string
  ip?: string
}): Promise<void> {
  return logAudit({
    category: 'content_moderation',
    action: params.action,
    adminId: params.adminId,
    targetType: params.contentType,
    targetId: params.contentId,
    targetUserId: params.targetUserId,
    ip: params.ip,
    success: true,
    details: { reason: params.reason },
  })
}

// ===== CLEANUP =====

/**
 * Clean up old audit logs (for scheduled maintenance)
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_CONFIG.retentionDays)
  
  try {
    const result = await prisma.adminAuditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })
    
    logger.info(`[AUDIT] Cleaned up ${result.count} old audit logs`)
    return result.count
  } catch (error) {
    logger.error('[AUDIT] Failed to cleanup old logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return 0
  }
}

// Start batch timer on module load
if (typeof setInterval !== 'undefined' && AUDIT_CONFIG.batchEnabled) {
  startBatchTimer()
}

export default {
  logAudit,
  logLogin,
  logLogout,
  logPasswordChange,
  log2FAChange,
  logAccessDenied,
  logAdminAction,
  logDataModification,
  logSecurityEvent,
  logModerationAction,
  extractRequestContext,
  cleanupOldAuditLogs,
  flushAuditQueue,
  stopBatchTimer,
}
