/**
 * Blocked Users Utility Functions
 * Security-critical utilities for enforcing blocked user restrictions
 */

import { prisma } from '@/lib/prisma'

/**
 * Check if either user has blocked the other
 * Returns true if a block exists in either direction
 */
export async function isBlocked(userId1: string, userId2: string): Promise<boolean> {
  try {
    const block = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { userId: userId1, blockedUserId: userId2 },
          { userId: userId2, blockedUserId: userId1 },
        ],
      },
    })

    return block !== null
  } catch (error) {
    console.error('[BlockedUsers] Error checking block status:', error)
    // Fail safe - assume not blocked if error occurs
    return false
  }
}

/**
 * Check if user A has blocked user B (one-directional check)
 */
export async function hasBlocked(userId: string, blockedUserId: string): Promise<boolean> {
  try {
    const block = await prisma.blockedUser.findUnique({
      where: {
        userId_blockedUserId: {
          userId,
          blockedUserId,
        },
      },
    })

    return block !== null
  } catch (error) {
    console.error('[BlockedUsers] Error checking block status:', error)
    return false
  }
}

/**
 * Get all user IDs that should be excluded from a user's view
 * This includes users they blocked AND users who blocked them
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  try {
    const blocks = await prisma.blockedUser.findMany({
      where: {
        OR: [
          { userId: userId },
          { blockedUserId: userId },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    })

    // Extract all user IDs involved in blocks (except the current user)
    const blockedIds = new Set<string>()
    blocks.forEach(block => {
      if (block.userId !== userId) blockedIds.add(block.userId)
      if (block.blockedUserId !== userId) blockedIds.add(block.blockedUserId)
    })

    return Array.from(blockedIds)
  } catch (error) {
    console.error('[BlockedUsers] Error getting blocked user IDs:', error)
    return []
  }
}

/**
 * Get users blocked BY the given user
 */
export async function getUsersBlockedBy(userId: string): Promise<string[]> {
  try {
    const blocks = await prisma.blockedUser.findMany({
      where: { userId },
      select: { blockedUserId: true },
    })

    return blocks.map(b => b.blockedUserId)
  } catch (error) {
    console.error('[BlockedUsers] Error getting users blocked by:', error)
    return []
  }
}

/**
 * Get users who have blocked the given user
 */
export async function getUsersWhoBlocked(userId: string): Promise<string[]> {
  try {
    const blocks = await prisma.blockedUser.findMany({
      where: { blockedUserId: userId },
      select: { userId: true },
    })

    return blocks.map(b => b.userId)
  } catch (error) {
    console.error('[BlockedUsers] Error getting users who blocked:', error)
    return []
  }
}
