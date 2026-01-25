/**
 * Presence Heartbeat API
 *
 * Tracks user presence for real-time online users feature.
 * Updates DeviceSession with heartbeat timestamps.
 *
 * Rate limited to prevent abuse while allowing frequent heartbeats.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// Heartbeat threshold - users are considered online if heartbeat within this time
const HEARTBEAT_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

export async function POST(request: NextRequest) {
  // Rate limit heartbeat requests (realtime preset - high frequency allowed)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.realtime)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Silently accept for unauthenticated users (guests)
      return NextResponse.json({
        success: true,
        authenticated: false,
      })
    }

    // Parse request body for device info
    let deviceId = 'default'
    let currentPage: string | null = null

    try {
      const body = await request.json()
      deviceId = body.deviceId || 'default'
      currentPage = body.currentPage || null
    } catch {
      // Body parsing failed - use defaults
    }

    // Get request headers for device info
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                      request.headers.get('x-real-ip') ||
                      'unknown'

    // Upsert device session with heartbeat
    await prisma.deviceSession.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      create: {
        userId: user.id,
        deviceId,
        lastHeartbeatAt: new Date(),
        isActive: true,
        userAgent,
        ipAddress,
      },
      update: {
        lastHeartbeatAt: new Date(),
        isActive: true,
        userAgent,
        ipAddress,
      },
    })

    // Also track page visit if provided
    if (currentPage) {
      await prisma.userPageVisit.create({
        data: {
          userId: user.id,
          path: currentPage,
        },
      }).catch(() => {
        // Ignore page visit errors - non-critical
      })
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      thresholdMs: HEARTBEAT_THRESHOLD_MS,
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    // Return success even on error to not break client
    return NextResponse.json({
      success: true,
      error: 'Internal error - heartbeat may not have been recorded',
    })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    status: 'enabled',
    thresholdMs: HEARTBEAT_THRESHOLD_MS,
  })
}
