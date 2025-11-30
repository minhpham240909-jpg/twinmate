/**
 * User Ban Check Utility
 * Centralized function to check if a user is actively banned
 * Used across APIs to enforce ban restrictions
 */

import { prisma } from '@/lib/prisma'

export interface BanStatus {
  isBanned: boolean
  banType?: 'TEMPORARY' | 'PERMANENT'
  expiresAt?: Date | null
  reason?: string
  bannedAt?: Date
}

/**
 * Check if a user is currently banned
 * Handles both temporary and permanent bans
 * Automatically considers expired temporary bans as not banned
 */
export async function checkUserBan(userId: string): Promise<BanStatus> {
  try {
    const ban = await prisma.userBan.findUnique({
      where: { userId },
    })

    if (!ban) {
      return { isBanned: false }
    }

    // Check if temporary ban has expired
    if (ban.type === 'TEMPORARY' && ban.expiresAt) {
      const now = new Date()
      if (ban.expiresAt < now) {
        // Ban has expired - clean it up and return not banned
        await prisma.userBan.delete({
          where: { userId },
        })
        return { isBanned: false }
      }
    }

    // User is actively banned
    return {
      isBanned: true,
      banType: ban.type as 'TEMPORARY' | 'PERMANENT',
      expiresAt: ban.expiresAt,
      reason: ban.reason || undefined,
      bannedAt: ban.createdAt,
    }
  } catch (error) {
    console.error('[checkUserBan] Error checking ban status:', error)
    // On error, default to not banned to avoid blocking legitimate users
    return { isBanned: false }
  }
}

/**
 * Check if a user is deactivated
 */
export async function checkUserDeactivated(userId: string): Promise<{
  isDeactivated: boolean
  reason?: string
  deactivatedAt?: Date
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        deactivatedAt: true,
        deactivationReason: true,
      },
    })

    if (!user || !user.deactivatedAt) {
      return { isDeactivated: false }
    }

    return {
      isDeactivated: true,
      reason: user.deactivationReason || undefined,
      deactivatedAt: user.deactivatedAt,
    }
  } catch (error) {
    console.error('[checkUserDeactivated] Error:', error)
    return { isDeactivated: false }
  }
}

/**
 * Combined check for ban and deactivation status
 * Returns comprehensive user access status
 */
export async function checkUserAccess(userId: string): Promise<{
  canAccess: boolean
  reason?: string
  banStatus?: BanStatus
  isDeactivated?: boolean
}> {
  const [banStatus, deactivationStatus] = await Promise.all([
    checkUserBan(userId),
    checkUserDeactivated(userId),
  ])

  if (banStatus.isBanned) {
    const expiresText = banStatus.expiresAt
      ? ` until ${banStatus.expiresAt.toLocaleDateString()}`
      : ' permanently'
    return {
      canAccess: false,
      reason: `Your account has been banned${expiresText}. ${banStatus.reason || ''}`.trim(),
      banStatus,
    }
  }

  if (deactivationStatus.isDeactivated) {
    return {
      canAccess: false,
      reason: `Your account has been deactivated. ${deactivationStatus.reason || ''}`.trim(),
      isDeactivated: true,
    }
  }

  return { canAccess: true }
}

/**
 * Helper function for API routes to check access and return appropriate response
 */
export async function enforceUserAccess(userId: string): Promise<{
  allowed: boolean
  errorResponse?: {
    error: string
    code: 'BANNED' | 'DEACTIVATED'
    details?: {
      expiresAt?: string
      reason?: string
    }
  }
}> {
  const access = await checkUserAccess(userId)

  if (!access.canAccess) {
    if (access.banStatus?.isBanned) {
      return {
        allowed: false,
        errorResponse: {
          error: access.reason || 'Your account has been banned',
          code: 'BANNED',
          details: {
            expiresAt: access.banStatus.expiresAt?.toISOString(),
            reason: access.banStatus.reason,
          },
        },
      }
    }

    if (access.isDeactivated) {
      return {
        allowed: false,
        errorResponse: {
          error: access.reason || 'Your account has been deactivated',
          code: 'DEACTIVATED',
        },
      }
    }
  }

  return { allowed: true }
}
