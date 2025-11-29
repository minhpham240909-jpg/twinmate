/**
 * Session Token Rotation & Security Utilities
 * 
 * Provides session token rotation capabilities for privilege changes.
 * This ensures that when a user's role changes (e.g., becomes admin),
 * their session token is refreshed to reflect the new permissions.
 */

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * Rotate session token for a user after privilege changes
 * This forces the user to get a new token with updated claims
 */
export async function rotateUserSession(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient()
    
    // Sign out all sessions for this user to force re-authentication
    // This ensures new role/permissions take effect
    const { error } = await adminClient.auth.admin.signOut(userId, 'global')
    
    if (error) {
      logger.error('Failed to rotate user session', { userId, error: error.message })
      return false
    }
    
    logger.info('Session rotated for user after privilege change', { data: { userId } })
    return true
  } catch (error) {
    logger.error('Session rotation error', error instanceof Error ? error : new Error(String(error)))
    return false
  }
}

/**
 * Check if user's role has changed and rotate session if needed
 * Call this after any admin action that changes user privileges
 */
export async function handlePrivilegeChange(
  userId: string,
  changes: {
    roleChanged?: boolean
    adminStatusChanged?: boolean
    accountStatusChanged?: boolean
  }
): Promise<void> {
  const { roleChanged, adminStatusChanged, accountStatusChanged } = changes
  
  // Rotate session if any privilege-related changes occurred
  if (roleChanged || adminStatusChanged || accountStatusChanged) {
    await rotateUserSession(userId)
    
    // Log the privilege change for audit purposes
    logger.info('Privilege change detected, session rotated', {
      data: { 
        userId, 
        roleChanged, 
        adminStatusChanged, 
        accountStatusChanged 
      }
    })
  }
}

/**
 * Validate current session and check for suspicious activity
 */
export async function validateSession(): Promise<{
  valid: boolean
  user: any | null
  reason?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { valid: false, user: null, reason: 'No valid session' }
    }
    
    // Check if user exists and is active in our database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        id: true, 
        email: true, 
        isAdmin: true, 
        role: true,
        deactivatedAt: true 
      }
    })
    
    if (!dbUser) {
      return { valid: false, user: null, reason: 'User not found in database' }
    }
    
    if (dbUser.deactivatedAt) {
      return { valid: false, user: null, reason: 'Account deactivated' }
    }
    
    return { valid: true, user: dbUser }
  } catch (error) {
    logger.error('Session validation error', error instanceof Error ? error : new Error(String(error)))
    return { valid: false, user: null, reason: 'Validation error' }
  }
}

/**
 * Record session activity for monitoring
 */
export async function recordSessionActivity(
  userId: string,
  activity: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // This can be extended to write to an audit log table
    logger.info('Session activity', {
      data: {
        userId,
        activity,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    // Don't throw - activity recording is non-critical
    logger.error('Failed to record session activity', error instanceof Error ? error : new Error(String(error)))
  }
}

