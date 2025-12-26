import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

// Request validation schema
const HeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  userAgent: z.string().optional(),
})

// OPTIMIZATION: Per-user deduplication to prevent duplicate heartbeats
// This prevents the same user from sending multiple heartbeats within 10 seconds
const recentHeartbeats = new Map<string, number>()
const DEDUP_WINDOW_MS = 10000 // 10 seconds

// Cleanup old entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, timestamp] of recentHeartbeats.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentHeartbeats.delete(key)
      }
    }
  }, 60000)
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

    // 2.5. OPTIMIZATION: Deduplicate rapid heartbeats from same user
    const dedupKey = `${user.id}:${deviceId}`
    const lastHeartbeat = recentHeartbeats.get(dedupKey)
    const now = Date.now()

    if (lastHeartbeat && now - lastHeartbeat < DEDUP_WINDOW_MS) {
      // Skip duplicate heartbeat but return success
      return NextResponse.json({
        success: true,
        message: 'Heartbeat deduplicated',
        deviceSession: { id: 'cached', lastHeartbeatAt: new Date(lastHeartbeat).toISOString() },
        presence: { status: 'online', lastSeenAt: new Date(lastHeartbeat).toISOString() },
      })
    }

    // Record this heartbeat for deduplication
    recentHeartbeats.set(dedupKey, now)

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
      console.error('[HEARTBEAT] Error upserting device session:', error)
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
        console.error('[HEARTBEAT] Error creating/updating device session:', retryError)
        throw retryError
      }
    }

    // 5. Update user presence to "online"
    // Note: UserPresence model only has 'status' field, not 'onlineStatus'
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
        },
        create: {
          userId: user.id,
          status: 'online',
          lastActivityAt: nowDate,
          lastSeenAt: nowDate,
        },
      })
    } catch (error) {
      console.error('[HEARTBEAT] Error upserting user presence:', error)
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
        console.error('[HEARTBEAT] Error creating/updating user presence:', retryError)
        // Don't throw - presence is optional, continue with response
        userPresence = { status: 'online', lastSeenAt: nowDate }
      }
    }

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
    console.error('[HEARTBEAT ERROR]', error)
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('[HEARTBEAT ERROR DETAILS]', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }

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
