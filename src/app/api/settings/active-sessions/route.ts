import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit session list (lenient - read operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all active device sessions for the user
    const sessions = await prisma.deviceSession.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: {
        lastHeartbeatAt: 'desc',
      },
    })

    // Get current device ID from request headers or generate one
    const currentDeviceId = request.headers.get('x-device-id') || 'unknown'

    const formattedSessions = sessions.map((session) => {
      // Parse user agent to get device info
      const userAgent = session.userAgent || ''
      let deviceType = 'Unknown'
      let browser = 'Unknown'

      if (userAgent.includes('Mobile')) {
        deviceType = 'Mobile'
      } else if (userAgent.includes('Tablet')) {
        deviceType = 'Tablet'
      } else {
        deviceType = 'Desktop'
      }

      if (userAgent.includes('Chrome')) browser = 'Chrome'
      else if (userAgent.includes('Firefox')) browser = 'Firefox'
      else if (userAgent.includes('Safari')) browser = 'Safari'
      else if (userAgent.includes('Edge')) browser = 'Edge'

      return {
        id: session.id,
        deviceId: session.deviceId,
        deviceType,
        browser,
        ipAddress: session.ipAddress || 'Unknown',
        lastActive: session.lastHeartbeatAt,
        isCurrentDevice: session.deviceId === currentDeviceId,
        createdAt: session.createdAt,
      }
    })

    return NextResponse.json({
      sessions: formattedSessions,
      currentDeviceId,
    })
  } catch (error) {
    console.error('Get active sessions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active sessions' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  // SCALABILITY: Rate limit session logout (strict - security operation)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { deviceId, logoutAll } = body

    if (logoutAll) {
      // Log out all other devices (keep current device)
      const currentDeviceId = request.headers.get('x-device-id') || 'unknown'
      
      await prisma.deviceSession.updateMany({
        where: {
          userId: user.id,
          deviceId: { not: currentDeviceId },
        },
        data: {
          isActive: false,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'All other devices have been logged out',
      })
    } else if (deviceId) {
      // Log out specific device
      await prisma.deviceSession.updateMany({
        where: {
          userId: user.id,
          deviceId,
        },
        data: {
          isActive: false,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Device logged out successfully',
      })
    } else {
      return NextResponse.json(
        { error: 'Either deviceId or logoutAll must be provided' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Logout device error:', error)
    return NextResponse.json(
      { error: 'Failed to logout device' },
      { status: 500 }
    )
  }
}

