// Presence Heartbeat API - Stub for PWA 2.0
// Real-time presence features removed, this stub prevents 404 errors

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // SCALABILITY: Rate limit heartbeat requests (realtime preset - high frequency)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.realtime)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  // Return success without doing anything
  // Presence tracking is disabled in PWA 2.0
  return NextResponse.json({
    success: true,
    message: 'Presence tracking disabled in PWA mode'
  })
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    status: 'disabled'
  })
}
