import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Request validation schema
const HeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  userAgent: z.string().optional(),
})

export async function POST(request: NextRequest) {
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

    // 3. Get client IP address
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'

    // 4. Update or create device session
    const now = new Date()
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
          lastHeartbeatAt: now,
          isActive: true,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null,
          updatedAt: now,
        },
        create: {
          userId: user.id,
          deviceId,
          lastHeartbeatAt: now,
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
              lastHeartbeatAt: now,
              isActive: true,
              userAgent: userAgent || null,
              ipAddress: ipAddress || null,
              updatedAt: now,
            },
          })
        } else {
          deviceSession = await prisma.deviceSession.create({
            data: {
              userId: user.id,
              deviceId,
              lastHeartbeatAt: now,
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
          lastActivityAt: now,
          lastSeenAt: now,
          updatedAt: now,
        },
        create: {
          userId: user.id,
          status: 'online',
          lastActivityAt: now,
          lastSeenAt: now,
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
              lastActivityAt: now,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
        } else {
          userPresence = await prisma.userPresence.create({
            data: {
              userId: user.id,
              status: 'online',
              lastActivityAt: now,
              lastSeenAt: now,
            },
          })
        }
      } catch (retryError) {
        console.error('[HEARTBEAT] Error creating/updating user presence:', retryError)
        // Don't throw - presence is optional, continue with response
        userPresence = { status: 'online', lastSeenAt: now }
      }
    }

    return NextResponse.json({
      success: true,
      deviceSession: {
        id: deviceSession?.id || 'unknown',
        lastHeartbeatAt: deviceSession?.lastHeartbeatAt || now.toISOString(),
      },
      presence: {
        status: userPresence?.status || 'online',
        lastSeenAt: userPresence?.lastSeenAt || now.toISOString(),
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
