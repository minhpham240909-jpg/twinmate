/**
 * Destructive Action Guard
 * 
 * FIX: Adds confirmation requirements for destructive/irreversible actions
 * This prevents accidental data loss and ensures admin accountability
 * 
 * Security features:
 * - Requires explicit confirmation token for destructive actions
 * - Time-limited confirmation tokens (5 minutes)
 * - Logs all destructive actions for audit
 * - Supports 2FA verification for highest-risk actions
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import crypto from 'crypto'

// Configuration
const CONFIRMATION_TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CONFIRMATION_ATTEMPTS = 3

// In-memory store for confirmation tokens (use Redis in production for multi-instance)
// Token format: { userId, action, targetId, expiresAt, attempts }
const confirmationTokens = new Map<string, {
  userId: string
  action: string
  targetId: string
  expiresAt: number
  attempts: number
}>()

// Cleanup expired tokens periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [token, data] of confirmationTokens.entries()) {
      if (data.expiresAt < now) {
        confirmationTokens.delete(token)
      }
    }
  }, 60 * 1000) // Every minute
}

/**
 * Actions that require confirmation
 */
export type DestructiveAction = 
  | 'permanent_delete_user'
  | 'permanent_delete_content'
  | 'revoke_admin'
  | 'bulk_ban_users'
  | 'delete_group'
  | 'purge_messages'

/**
 * Risk level determines confirmation requirements
 */
export const ACTION_RISK_LEVELS: Record<DestructiveAction, 'high' | 'critical'> = {
  permanent_delete_user: 'critical',
  permanent_delete_content: 'high',
  revoke_admin: 'critical',
  bulk_ban_users: 'high',
  delete_group: 'high',
  purge_messages: 'high',
}

/**
 * Generate a confirmation token for a destructive action
 * Returns the token that must be provided to confirm the action
 */
export async function requestConfirmation(params: {
  userId: string
  action: DestructiveAction
  targetId: string
  details?: Record<string, unknown>
}): Promise<{
  confirmationToken: string
  expiresAt: Date
  requiresTwoFactor: boolean
}> {
  const { userId, action, targetId, details } = params
  
  // Generate secure random token
  const confirmationToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + CONFIRMATION_TOKEN_TTL_MS
  
  // Store token
  confirmationTokens.set(confirmationToken, {
    userId,
    action,
    targetId,
    expiresAt,
    attempts: 0,
  })
  
  // Check if action requires 2FA
  const riskLevel = ACTION_RISK_LEVELS[action]
  const requiresTwoFactor = riskLevel === 'critical'
  
  // Log the confirmation request
  logger.info('Destructive action confirmation requested', {
    userId,
    action,
    targetId,
    riskLevel,
    details,
  })
  
  return {
    confirmationToken,
    expiresAt: new Date(expiresAt),
    requiresTwoFactor,
  }
}

/**
 * Verify a confirmation token and execute the action
 * For critical actions, also verifies 2FA if enabled
 */
export async function verifyConfirmation(params: {
  confirmationToken: string
  userId: string
  twoFactorCode?: string
}): Promise<{
  valid: boolean
  error?: string
  action?: DestructiveAction
  targetId?: string
}> {
  const { confirmationToken, userId, twoFactorCode } = params
  
  // Get token data
  const tokenData = confirmationTokens.get(confirmationToken)
  
  if (!tokenData) {
    return { valid: false, error: 'Invalid or expired confirmation token' }
  }
  
  // Check if token expired
  if (tokenData.expiresAt < Date.now()) {
    confirmationTokens.delete(confirmationToken)
    return { valid: false, error: 'Confirmation token has expired' }
  }
  
  // Check if user matches
  if (tokenData.userId !== userId) {
    // Track attempt but don't reveal the user mismatch
    tokenData.attempts++
    if (tokenData.attempts >= MAX_CONFIRMATION_ATTEMPTS) {
      confirmationTokens.delete(confirmationToken)
      logger.warn('Confirmation token max attempts exceeded', { userId, action: tokenData.action })
    }
    return { valid: false, error: 'Invalid confirmation token' }
  }
  
  // Check if 2FA is required for this action
  const riskLevel = ACTION_RISK_LEVELS[tokenData.action as DestructiveAction]
  
  if (riskLevel === 'critical') {
    // Verify user has 2FA enabled and code is provided
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })
    
    if (user?.twoFactorEnabled) {
      if (!twoFactorCode) {
        return { valid: false, error: 'Two-factor authentication code required for this action' }
      }
      
      // Verify 2FA code
      const isValid2FA = await verify2FACode(user.twoFactorSecret, twoFactorCode)
      if (!isValid2FA) {
        tokenData.attempts++
        if (tokenData.attempts >= MAX_CONFIRMATION_ATTEMPTS) {
          confirmationTokens.delete(confirmationToken)
        }
        return { valid: false, error: 'Invalid two-factor authentication code' }
      }
    }
  }
  
  // Token is valid - consume it
  confirmationTokens.delete(confirmationToken)
  
  logger.info('Destructive action confirmed', {
    userId,
    action: tokenData.action,
    targetId: tokenData.targetId,
  })
  
  return {
    valid: true,
    action: tokenData.action as DestructiveAction,
    targetId: tokenData.targetId,
  }
}

/**
 * Verify 2FA TOTP code
 */
async function verify2FACode(secret: string | null, code: string): Promise<boolean> {
  if (!secret) return false
  
  try {
    // Use speakeasy or similar library for TOTP verification
    // For now, this is a placeholder - implement with your 2FA library
    const { authenticator } = await import('otplib')
    return authenticator.verify({ token: code, secret })
  } catch (error) {
    logger.error('Error verifying 2FA code', { error })
    return false
  }
}

/**
 * Middleware wrapper for destructive actions
 * Use this to wrap API route handlers that perform destructive actions
 */
export function withDestructiveActionGuard<T>(
  action: DestructiveAction,
  handler: (params: { targetId: string; userId: string }) => Promise<T>
) {
  return async (params: {
    confirmationToken: string
    userId: string
    twoFactorCode?: string
  }): Promise<T | { error: string; status: number }> => {
    const verification = await verifyConfirmation(params)
    
    if (!verification.valid) {
      return {
        error: verification.error || 'Confirmation failed',
        status: 403,
      }
    }
    
    if (verification.action !== action) {
      return {
        error: 'Confirmation token is for a different action',
        status: 400,
      }
    }
    
    return handler({
      targetId: verification.targetId!,
      userId: params.userId,
    })
  }
}

/**
 * Check if an action requires confirmation
 */
export function requiresConfirmation(action: string): action is DestructiveAction {
  return action in ACTION_RISK_LEVELS
}

/**
 * Get confirmation requirements for an action
 */
export function getConfirmationRequirements(action: DestructiveAction): {
  requiresTwoFactor: boolean
  riskLevel: 'high' | 'critical'
  expiresInMs: number
} {
  return {
    requiresTwoFactor: ACTION_RISK_LEVELS[action] === 'critical',
    riskLevel: ACTION_RISK_LEVELS[action],
    expiresInMs: CONFIRMATION_TOKEN_TTL_MS,
  }
}
