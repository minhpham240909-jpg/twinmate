import { prisma } from '@/lib/prisma'

// Run this function every 60 seconds
export async function cleanupPresence() {
  console.log('[CLEANUP] Starting presence cleanup job...')

  try {
    // 1. Mark stale device sessions as inactive (no heartbeat for 60+ seconds)
    const staleThreshold = new Date(Date.now() - 60 * 1000) // 60 seconds ago

    const staleSessionsResult = await prisma.deviceSession.updateMany({
      where: {
        isActive: true,
        lastHeartbeatAt: {
          lt: staleThreshold,
        },
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })

    console.log(`[CLEANUP] Marked ${staleSessionsResult.count} stale sessions as inactive`)

    // 2. Get all users with presence records (including those without device sessions)
    // This ensures we check all users, not just those with active sessions
    const usersWithPresence = await prisma.user.findMany({
      where: {
        presence: {
          isNot: null,
        },
      },
      select: {
        id: true,
        deviceSessions: {
          select: {
            isActive: true,
            lastHeartbeatAt: true,
          },
        },
        presence: {
          select: {
            status: true,
            lastActivityAt: true,
            lastSeenAt: true,
          },
        },
      },
    })

    console.log(`[CLEANUP] Processing ${usersWithPresence.length} users...`)

    // 3. Update user presence based on active sessions (immediate offline)
    let updatedCount = 0
    // Reuse staleThreshold from above (60 seconds) for consistency
    // Users with no active sessions and last seen >60 seconds ago = offline

    for (const user of usersWithPresence) {
      const activeSessions = user.deviceSessions.filter((s) => s.isActive)
      const hasActiveSessions = activeSessions.length > 0

      let newStatus: 'online' | 'away' | 'offline'

      if (hasActiveSessions) {
        // At least one active session = online
        newStatus = 'online'
      } else {
        // No active sessions - check if last heartbeat was recent
        const lastSeen = user.presence?.lastSeenAt || user.presence?.lastActivityAt || new Date(0)

        if (lastSeen < staleThreshold) {
          // No heartbeat for >60 seconds = offline (immediate offline detection)
          newStatus = 'offline'
        } else {
          // Very recently disconnected (<60 seconds) - might be temporary network issue
          // Keep as online briefly, but will be marked offline on next cleanup cycle
          newStatus = 'online'
        }
      }

      // Update if status changed
      if (user.presence?.status !== newStatus) {
        await prisma.userPresence.update({
          where: { userId: user.id },
          data: {
            status: newStatus,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
        updatedCount++
      }
    }

    console.log(`[CLEANUP] Updated presence for ${updatedCount} users`)

    // 4. Delete expired typing indicators (>10 seconds old)
    const expiredTypingResult = await prisma.typingIndicator.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    console.log(`[CLEANUP] Deleted ${expiredTypingResult.count} expired typing indicators`)

    // 5. Delete old device sessions (>7 days old)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const oldSessionsResult = await prisma.deviceSession.deleteMany({
      where: {
        isActive: false,
        updatedAt: {
          lt: sevenDaysAgo,
        },
      },
    })

    console.log(`[CLEANUP] Deleted ${oldSessionsResult.count} old device sessions`)

    console.log('[CLEANUP] Presence cleanup job completed successfully')
  } catch (error) {
    console.error('[CLEANUP ERROR]', error)
    throw error
  }
}
