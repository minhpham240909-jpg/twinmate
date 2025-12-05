import { NextRequest, NextResponse } from 'next/server'
import { cleanupPresence } from '@/lib/cron/cleanup-presence'
import crypto from 'crypto'

// This endpoint is called by Vercel Cron every minute
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    const expectedAuth = `Bearer ${cronSecret}`
    const isValid = authHeader &&
      authHeader.length === expectedAuth.length &&
      crypto.timingSafeEqual(
        Buffer.from(authHeader),
        Buffer.from(expectedAuth)
      )

    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Run cleanup job
    await cleanupPresence()

    return NextResponse.json({
      success: true,
      message: 'Presence cleanup job completed',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON ERROR]', error)

    return NextResponse.json(
      { error: 'Cleanup job failed', details: String(error) },
      { status: 500 }
    )
  }
}
