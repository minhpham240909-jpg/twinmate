import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'

// Request validation schema
const HeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  userAgent: z.string().optional(),
})

// FIX: Improved deduplication with atomic check-and-set to prevent race conditions
interface HeartbeatEntry {
  timestamp: number
  processing: boolean // Lock to prevent concurrent processing
}

const recentHeartbeats = new Map<string, HeartbeatEntry>()
const DEDUP_WINDOW_MS = 10000 // 10 seconds
// PERF: Increased to 50K for 3000 concurrent users (each user + device = 1 entry)
// At 3000 users with avg 2 devices = 6000 entries, so 50K gives 8x headroom
const MAX_CACHE_SIZE = 50000 // Prevent unbounded growth

// Cleanup old entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, entry] of recentHeartbeats.entries()) {
      // Only delete if not currently processing and past window
      if (!entry.processing && now - entry.timestamp > DEDUP_WINDOW_MS * 2) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => recentHeartbeats.delete(key))
  }, 60000)
}

/**
 * FIX: Atomic check-and-lock for heartbeat deduplication
 * Returns true if this request should be processed, false if duplicate
 */
function tryAcquireHeartbeatLock(dedupKey: string): { shouldProcess: boolean; cachedTimestamp?: number } {
  const now = Date.now()
  const existing = recentHeartbeats.get(dedupKey)
  
  if (existing) {
    // Check if within dedup window
    if (now - existing.timestamp < DEDUP_WINDOW_MS) {
      return { shouldProcess: false, cachedTimestamp: existing.timestamp }
    }
    
    // Check if another request is processing
    if (existing.processing) {
      return { shouldProcess: false, cachedTimestamp: existing.timestamp }
    }
  }
  
  // Prevent unbounded cache growth
  if (recentHeartbeats.size >= MAX_CACHE_SIZE && !existing) {
    // Evict oldest entry
    const oldestKey = recentHeartbeats.keys().next().value
    if (oldestKey) recentHeartbeats.delete(oldestKey)
  }
  
  // Acquire lock atomically
  recentHeartbeats.set(dedupKey, { timestamp: now, processing: true })
  return { shouldProcess: true }
}

/**
 * Release heartbeat lock after processing
 */
function releaseHeartbeatLock(dedupKey: string): void {
  const entry = recentHeartbeats.get(dedupKey)
  if (entry) {
    entry.processing = false
    entry.timestamp = Date.now() // Update timestamp after successful processing
  }
}

export async function POST(request: NextRequest) {
  // Rate limit: 10 heartbeats per minute per user (way more than needed with 45-90s intervals)
  const rateLimitResult = await rateLimit(request, { max: 10, windowMs: 60000, keyPrefix: 'heartbeat' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: true, message: 'Rate limited, skipping heartbeat' },
      { status: 200, headers: rateLimitResult.headers } // Return 200 to prevent client retry storms
    )
  }

  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Validate request body
    const body = await request.json()
    const validation = HeartbeatSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { deviceId, userAgent } = validation.data

    // 2.5. FIX: Atomic deduplication with race condition protection
    const dedupKey = `${user.id}:${deviceId}`
    const lockResult = tryAcquireHeartbeatLock(dedupKey)

    if (!lockResult.shouldProcess) {
      // Skip duplicate heartbeat but return success
      const cachedTime = lockResult.cachedTimestamp || Date.now()
      return NextResponse.json({
        success: true,
        message: 'Heartbeat deduplicated',
        deviceSession: { id: 'cached', lastHeartbeatAt: new Date(cachedTime).toISOString() },
        presence: { status: 'online', lastSeenAt: new Date(cachedTime).toISOString() },
      })
    }
    
    // We have the lock - proceed with processing

    // 3. Get client IP address
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'

    // 4. Update or create device session
    const nowDate = new Date()
    let deviceSession
    try {
      deviceSession = await prisma.deviceSession.upsert({
        where: {
          userId_deviceId: {
            userId: user.id,
            deviceId,
          },
        },
        update: {
          lastHeartbeatAt: nowDate,
          isActive: true,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null,
          updatedAt: nowDate,
        },
        create: {
          userId: user.id,
          deviceId,
          lastHeartbeatAt: nowDate,
          isActive: true,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null,
        },
      })
    } catch (error) {
      logger.error('Error upserting device session', error instanceof Error ? error : { error })
      // Try to create if upsert fails (constraint might not exist)
      try {
        deviceSession = await prisma.deviceSession.findFirst({
          where: {
            userId: user.id,
            deviceId,
          },
        })
        if (deviceSession) {
          deviceSession = await prisma.deviceSession.update({
            where: { id: deviceSession.id },
            data: {
              lastHeartbeatAt: nowDate,
              isActive: true,
              userAgent: userAgent || null,
              ipAddress: ipAddress || null,
              updatedAt: nowDate,
            },
          })
        } else {
          deviceSession = await prisma.deviceSession.create({
            data: {
              userId: user.id,
              deviceId,
              lastHeartbeatAt: nowDate,
              isActive: true,
              userAgent: userAgent || null,
              ipAddress: ipAddress || null,
            },
          })
        }
      } catch (retryError) {
        logger.error('Error creating/updating device session', retryError instanceof Error ? retryError : { error: retryError })
        throw retryError
      }
    }

    // 5. Update user presence to "online"
    // IMPORTANT: Preserve activityType if user is studying/in_call/with_ai
    // This ensures users remain visible on partner board while in sessions
    // We DON'T update activityType here - that's done via /api/presence/activity
    let userPresence
    try {
      userPresence = await prisma.userPresence.upsert({
        where: {
          userId: user.id,
        },
        update: {
          status: 'online',
          lastActivityAt: nowDate,
          lastSeenAt: nowDate,
          updatedAt: nowDate,
          // PRESERVE activityType - don't reset it during heartbeat
          // This keeps users showing as "studying" on partner board
        },
        create: {
          userId: user.id,
          status: 'online',
          activityType: 'browsing', // Default for new users
          lastActivityAt: nowDate,
          lastSeenAt: nowDate,
        },
      })
    } catch (error) {
      logger.error('Error upserting user presence', error instanceof Error ? error : { error })
      // Try to create if upsert fails
      try {
        const existing = await prisma.userPresence.findUnique({
          where: { userId: user.id },
        })
        if (existing) {
          userPresence = await prisma.userPresence.update({
            where: { userId: user.id },
            data: {
              status: 'online',
              lastActivityAt: nowDate,
              lastSeenAt: nowDate,
              updatedAt: nowDate,
            },
          })
        } else {
          userPresence = await prisma.userPresence.create({
            data: {
              userId: user.id,
              status: 'online',
              lastActivityAt: nowDate,
              lastSeenAt: nowDate,
            },
          })
        }
      } catch (retryError) {
        logger.error('Error creating/updating user presence', retryError instanceof Error ? retryError : { error: retryError })
        // Don't throw - presence is optional, continue with response
        userPresence = { status: 'online', lastSeenAt: nowDate }
      }
    }

    // FIX: Release lock after successful processing
    releaseHeartbeatLock(dedupKey)

    return NextResponse.json({
      success: true,
      deviceSession: {
        id: deviceSession?.id || 'unknown',
        lastHeartbeatAt: deviceSession?.lastHeartbeatAt || nowDate.toISOString(),
      },
      presence: {
        status: userPresence?.status || 'online',
        lastSeenAt: userPresence?.lastSeenAt || nowDate.toISOString(),
      },
    })
  } catch (error) {
    logger.error('Heartbeat error', error instanceof Error ? error : { error })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      )
    }

    // Return success even on error to prevent infinite retries
    // The presence system will recover on the next heartbeat
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
