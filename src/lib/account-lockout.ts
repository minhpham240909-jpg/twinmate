/**
 * Account Lockout Mechanism
 * 
 * Protects accounts from brute force attacks by:
 * - Tracking failed login attempts
 * - Locking account after 5 consecutive failures
 * - Auto-unlocking after 15 minutes
 * - Using Redis for distributed tracking
 */

import { getCached, setCached, invalidateCache } from './cache'
import logger from './logger'

const LOCKOUT_CONFIG = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  ATTEMPT_WINDOW_MINUTES: 60, // Reset counter after 1 hour of inactivity
} as const

interface LockoutData {
  attempts: number
  lockedUntil: number | null
  lastAttempt: number
}

/**
 * Generate cache key for lockout tracking
 */
function getLockoutKey(identifier: string): string {
  return `lockout:${identifier}`
}

/**
 * Get lockout data for user
 */
export async function getLockoutData(identifier: string): Promise<LockoutData> {
  const key = getLockoutKey(identifier)
  const data = await getCached<LockoutData>(key)
  
  if (!data) {
    return {
      attempts: 0,
      lockedUntil: null,
      lastAttempt: 0,
    }
  }

  // Check if attempts should be reset (no activity for ATTEMPT_WINDOW_MINUTES)
  const now = Date.now()
  const minutesSinceLastAttempt = (now - data.lastAttempt) / (1000 * 60)
  
  if (minutesSinceLastAttempt > LOCKOUT_CONFIG.ATTEMPT_WINDOW_MINUTES) {
    // Reset attempts due to inactivity
    return {
      attempts: 0,
      lockedUntil: null,
      lastAttempt: 0,
    }
  }

  return data
}

/**
 * Check if account is currently locked
 */
export async function isAccountLocked(identifier: string): Promise<{
  locked: boolean
  remainingMinutes?: number
  attempts?: number
}> {
  const data = await getLockoutData(identifier)
  
  if (!data.lockedUntil) {
    return {
      locked: false,
      attempts: data.attempts,
    }
  }

  const now = Date.now()
  
  // Check if lockout has expired
  if (now >= data.lockedUntil) {
    // Lockout expired - clear it
    await clearLockout(identifier)
    return {
      locked: false,
      attempts: 0,
    }
  }

  // Still locked
  const remainingMs = data.lockedUntil - now
  const remainingMinutes = Math.ceil(remainingMs / (1000 * 60))
  
  return {
    locked: true,
    remainingMinutes,
    attempts: data.attempts,
  }
}

/**
 * Record a failed login attempt
 * Returns lockout status after recording
 */
export async function recordFailedAttempt(identifier: string): Promise<{
  locked: boolean
  attempts: number
  remainingAttempts: number
  lockedUntil?: Date
}> {
  const data = await getLockoutData(identifier)
  const now = Date.now()
  
  // Increment attempts
  const newAttempts = data.attempts + 1
  
  let lockedUntil: number | null = null
  let locked = false

  // Check if we should lock the account
  if (newAttempts >= LOCKOUT_CONFIG.MAX_ATTEMPTS) {
    lockedUntil = now + (LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000)
    locked = true
    
    logger.warn('Account locked due to failed login attempts', {
      identifier,
      attempts: newAttempts,
      lockedUntil: new Date(lockedUntil).toISOString(),
    })
  }

  // Save updated data
  const key = getLockoutKey(identifier)
  const ttl = locked 
    ? LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES * 60 
    : LOCKOUT_CONFIG.ATTEMPT_WINDOW_MINUTES * 60

  await setCached<LockoutData>(
    key,
    {
      attempts: newAttempts,
      lockedUntil,
      lastAttempt: now,
    },
    ttl
  )

  return {
    locked,
    attempts: newAttempts,
    remainingAttempts: Math.max(0, LOCKOUT_CONFIG.MAX_ATTEMPTS - newAttempts),
    lockedUntil: lockedUntil ? new Date(lockedUntil) : undefined,
  }
}

/**
 * Clear lockout and reset attempts (on successful login)
 */
export async function clearLockout(identifier: string): Promise<void> {
  const key = getLockoutKey(identifier)
  await invalidateCache(key)
  
  logger.info('Account lockout cleared', { identifier })
}

/**
 * Get remaining attempts before lockout
 */
export async function getRemainingAttempts(identifier: string): Promise<number> {
  const data = await getLockoutData(identifier)
  return Math.max(0, LOCKOUT_CONFIG.MAX_ATTEMPTS - data.attempts)
}

/**
 * Manually lock an account (for admin purposes)
 */
export async function manualLockAccount(
  identifier: string,
  durationMinutes: number = LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES
): Promise<void> {
  const now = Date.now()
  const lockedUntil = now + (durationMinutes * 60 * 1000)
  
  const key = getLockoutKey(identifier)
  await setCached<LockoutData>(
    key,
    {
      attempts: LOCKOUT_CONFIG.MAX_ATTEMPTS,
      lockedUntil,
      lastAttempt: now,
    },
    durationMinutes * 60
  )
  
  logger.warn('Account manually locked', {
    identifier,
    durationMinutes,
    lockedUntil: new Date(lockedUntil).toISOString(),
  })
}

/**
 * Manually unlock an account (for admin purposes)
 */
export async function manualUnlockAccount(identifier: string): Promise<void> {
  await clearLockout(identifier)
  logger.info('Account manually unlocked', { identifier })
}

/**
 * Get lockout configuration (for UI display)
 */
export function getLockoutConfig() {
  return {
    maxAttempts: LOCKOUT_CONFIG.MAX_ATTEMPTS,
    lockoutDurationMinutes: LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES,
    attemptWindowMinutes: LOCKOUT_CONFIG.ATTEMPT_WINDOW_MINUTES,
  }
}

/**
 * Format lockout error message for user
 */
export function formatLockoutMessage(remainingMinutes: number): string {
  if (remainingMinutes <= 1) {
    return 'Account is temporarily locked. Please try again in less than a minute.'
  }
  
  return `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
}
