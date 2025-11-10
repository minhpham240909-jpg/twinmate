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

    // 2. Get all users with device sessions
    const usersWithSessions = await prisma.user.findMany({
      where: {
        deviceSessions: {
          some: {},
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
          },
        },
      },
    })

    console.log(`[CLEANUP] Processing ${usersWithSessions.length} users...`)

    // 3. Update user presence based on active sessions
    let updatedCount = 0
    const awayThreshold = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

    for (const user of usersWithSessions) {
      const activeSessions = user.deviceSessions.filter((s) => s.isActive)
      const hasActiveSessions = activeSessions.length > 0

      let newStatus: 'online' | 'away' | 'offline'

      if (hasActiveSessions) {
        // At least one active session = online
        newStatus = 'online'
      } else {
        // No active sessions - check last activity
        const lastActivity = user.presence?.lastActivityAt || new Date(0)

        if (lastActivity < awayThreshold) {
          newStatus = 'offline' // Inactive for >5 minutes
        } else {
          newStatus = 'away' // Recently active but no current sessions
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
