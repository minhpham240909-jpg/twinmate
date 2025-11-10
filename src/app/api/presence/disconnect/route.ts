import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DisconnectSchema = z.object({
  deviceId: z.string().uuid(),
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
    const validation = DisconnectSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { deviceId } = validation.data

    // 3. Mark device session as inactive
    await prisma.deviceSession.update({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })

    // 4. Check if user has any active sessions
    const activeSessions = await prisma.deviceSession.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    })

    // 5. Update user presence
    let newStatus = 'online'
    if (activeSessions === 0) {
      newStatus = 'offline'
    }

    const userPresence = await prisma.userPresence.update({
      where: {
        userId: user.id,
      },
      data: {
        status: newStatus,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      presence: {
        status: userPresence.status,
        activeSessions,
      },
    })
  } catch (error) {
    console.error('[DISCONNECT ERROR]', error)

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
