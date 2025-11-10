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
    const deviceSession = await prisma.deviceSession.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      update: {
        lastHeartbeatAt: now,
        isActive: true,
        userAgent,
        ipAddress,
        updatedAt: now,
      },
      create: {
        userId: user.id,
        deviceId,
        lastHeartbeatAt: now,
        isActive: true,
        userAgent,
        ipAddress,
      },
    })

    // 5. Update user presence to "online"
    const userPresence = await prisma.userPresence.upsert({
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

    return NextResponse.json({
      success: true,
      deviceSession: {
        id: deviceSession.id,
        lastHeartbeatAt: deviceSession.lastHeartbeatAt,
      },
      presence: {
        status: userPresence.status,
        lastSeenAt: userPresence.lastSeenAt,
      },
    })
  } catch (error) {
    console.error('[HEARTBEAT ERROR]', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
