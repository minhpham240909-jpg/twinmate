// Presence Heartbeat API - Stub for PWA 2.0
// Real-time presence features removed, this stub prevents 404 errors

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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
