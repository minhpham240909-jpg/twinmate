import { NextRequest, NextResponse } from 'next/server'
import { cleanupPresence } from '@/lib/cron/cleanup-presence'

// This endpoint is called by Vercel Cron every minute
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
