/**
 * Session Management Security
 * 
 * Provides comprehensive session management including:
 * - Concurrent session limiting
 * - Session inactivity timeout
 * - Device fingerprinting
 */

import { prisma } from '@/lib/prisma'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'
import crypto from 'crypto'

// ===== CONSTANTS =====

/** Maximum concurrent sessions per user */
export const MAX_CONCURRENT_SESSIONS = 5

/** Session inactivity timeout in milliseconds (30 minutes) */
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

/** Session inactivity timeout in seconds */
export const SESSION_INACTIVITY_TIMEOUT_SECONDS = 30 * 60

// ===== TYPES =====

export interface DeviceFingerprint {
  userAgent: string
  ip: string
  acceptLanguage: string
  screenResolution?: string
  timezone?: string
}

export interface SessionInfo {
  id: string
  deviceId: string
  userAgent: string | null
  ipAddress: string | null
  lastActivity: Date
  createdAt: Date
  isActive: boolean
}

// ===== DEVICE FINGERPRINTING =====

/**
 * Generate a device fingerprint hash from request headers
 */
export function generateDeviceFingerprint(fingerprint: DeviceFingerprint): string {
  const data = [
    fingerprint.userAgent,
    fingerprint.acceptLanguage,
    fingerprint.screenResolution || '',
    fingerprint.timezone || '',
  ].join('|')
  
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
    .substring(0, 32)
}

/**
 * Extract fingerprint data from request headers
 */
export function extractFingerprint(headers: Headers): DeviceFingerprint {
  return {
    userAgent: headers.get('user-agent') || 'unknown',
    ip: headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        headers.get('x-real-ip') ||
        'unknown',
    acceptLanguage: headers.get('accept-language') || 'unknown',
    screenResolution: headers.get('x-screen-resolution') || undefined,
    timezone: headers.get('x-timezone') || undefined,
  }
}

// ===== SESSION TRACKING =====

/**
 * Record session activity (heartbeat)
 */
export async function recordSessionActivity(
  userId: string,
  deviceId: string,
  headers: Headers
): Promise<void> {
  try {
    const fingerprint = extractFingerprint(headers)
    
    await prisma.deviceSession.upsert({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
      create: {
        userId,
        deviceId,
        lastHeartbeatAt: new Date(),
        isActive: true,
        userAgent: fingerprint.userAgent,
        ipAddress: fingerprint.ip,
      },
      update: {
        lastHeartbeatAt: new Date(),
        isActive: true,
        userAgent: fingerprint.userAgent,
        ipAddress: fingerprint.ip,
      },
    })
  } catch (error) {
    // Non-critical - log and continue
    logger.warn('Failed to record session activity', { userId, deviceId })
  }
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.deviceSession.findMany({
    where: {
      userId,
      isActive: true,
      lastHeartbeatAt: {
        gte: new Date(Date.now() - SESSION_INACTIVITY_TIMEOUT_MS),
      },
    },
    orderBy: {
      lastHeartbeatAt: 'desc',
    },
    select: {
      id: true,
      deviceId: true,
      userAgent: true,
      ipAddress: true,
      lastHeartbeatAt: true,
      createdAt: true,
      isActive: true,
    },
  })
  
  return sessions.map(s => ({
    id: s.id,
    deviceId: s.deviceId,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    lastActivity: s.lastHeartbeatAt,
    createdAt: s.createdAt,
    isActive: s.isActive,
  }))
}

/**
 * Count active sessions for a user
 */
export async function countActiveSessions(userId: string): Promise<number> {
  return await prisma.deviceSession.count({
    where: {
      userId,
      isActive: true,
      lastHeartbeatAt: {
        gte: new Date(Date.now() - SESSION_INACTIVITY_TIMEOUT_MS),
      },
    },
  })
}

/**
 * Check if user has exceeded maximum concurrent sessions
 */
export async function hasExceededSessionLimit(userId: string): Promise<boolean> {
  const count = await countActiveSessions(userId)
  return count >= MAX_CONCURRENT_SESSIONS
}

/**
 * Invalidate oldest session if limit exceeded
 * Returns true if a session was invalidated
 */
export async function enforceSessionLimit(userId: string): Promise<boolean> {
  const sessions = await getActiveSessions(userId)
  
  if (sessions.length < MAX_CONCURRENT_SESSIONS) {
    return false
  }
  
  // Get oldest session (last in the list since sorted by lastHeartbeatAt desc)
  const oldestSession = sessions[sessions.length - 1]
  
  await prisma.deviceSession.update({
    where: { id: oldestSession.id },
    data: { isActive: false },
  })
  
  logger.info('Invalidated oldest session due to limit', {
    data: { userId, sessionId: oldestSession.id }
  })
  
  return true
}

/**
 * Invalidate a specific session
 */
export async function invalidateSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  try {
    await prisma.deviceSession.update({
      where: {
        id: sessionId,
        userId, // Ensure user owns this session
      },
      data: { isActive: false },
    })
    
    logger.info('Session invalidated', { data: { userId, sessionId } })
    return true
  } catch (error) {
    logger.error('Failed to invalidate session', { userId, sessionId })
    return false
  }
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllSessions(userId: string): Promise<number> {
  const result = await prisma.deviceSession.updateMany({
    where: { userId },
    data: { isActive: false },
  })
  
  logger.info('All sessions invalidated', {
    data: { userId, count: result.count }
  })
  
  return result.count
}

// ===== INACTIVITY TIMEOUT =====

/**
 * Check if a session has timed out due to inactivity
 */
export function isSessionTimedOut(lastActivity: Date): boolean {
  const inactiveMs = Date.now() - lastActivity.getTime()
  return inactiveMs > SESSION_INACTIVITY_TIMEOUT_MS
}

/**
 * Clean up inactive sessions (can be run as cron job)
 */
export async function cleanupInactiveSessions(): Promise<number> {
  const cutoffTime = new Date(Date.now() - SESSION_INACTIVITY_TIMEOUT_MS)
  
  const result = await prisma.deviceSession.updateMany({
    where: {
      isActive: true,
      lastHeartbeatAt: {
        lt: cutoffTime,
      },
    },
    data: { isActive: false },
  })
  
  if (result.count > 0) {
    logger.info('Cleaned up inactive sessions', { data: { count: result.count } })
  }
  
  return result.count
}

// ===== SESSION VALIDATION =====

/**
 * Validate session and check for suspicious activity
 */
export async function validateSessionSecurity(
  userId: string,
  deviceId: string,
  headers: Headers
): Promise<{
  valid: boolean
  reason?: string
  shouldRotate?: boolean
}> {
  try {
    const session = await prisma.deviceSession.findUnique({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
    })
    
    if (!session) {
      // New device - allow but may need to enforce limit
      return { valid: true }
    }
    
    if (!session.isActive) {
      return { valid: false, reason: 'Session has been invalidated' }
    }
    
    if (isSessionTimedOut(session.lastHeartbeatAt)) {
      return { valid: false, reason: 'Session timed out due to inactivity' }
    }
    
    // Check for IP change (potential session hijacking)
    const currentIp = headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                      headers.get('x-real-ip') ||
                      'unknown'
    
    if (session.ipAddress && session.ipAddress !== currentIp) {
      // IP changed - flag for potential rotation but allow
      logger.warn('Session IP changed', {
        userId,
        oldIp: session.ipAddress.substring(0, 10) + '...',
        deviceId,
      })
      return { valid: true, shouldRotate: true }
    }
    
    return { valid: true }
  } catch (error) {
    logger.error('Session validation error', error instanceof Error ? error : new Error(String(error)))
    // Fail open - allow request but log
    return { valid: true }
  }
}

/**
 * Get session timeout configuration for client
 */
export function getSessionTimeoutConfig() {
  return {
    timeoutMs: SESSION_INACTIVITY_TIMEOUT_MS,
    timeoutSeconds: SESSION_INACTIVITY_TIMEOUT_SECONDS,
    warningBeforeTimeoutMs: 5 * 60 * 1000, // 5 minutes warning
    maxConcurrentSessions: MAX_CONCURRENT_SESSIONS,
  }
}

