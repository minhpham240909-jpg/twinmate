/**
 * Cron Job: Cleanup Expired Bans
 * Runs periodically to delete expired temporary bans from the database
 *
 * Should be called by Vercel Cron or similar scheduler
 * Recommended frequency: Every hour
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Find and delete all expired temporary bans
    const expiredBans = await prisma.userBan.deleteMany({
      where: {
        type: 'TEMPORARY',
        expiresAt: {
          lt: now,
        },
      },
    })

    console.log(`[Cron] Cleaned up ${expiredBans.count} expired bans`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${expiredBans.count} expired bans`,
      count: expiredBans.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Error cleaning up expired bans:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup expired bans' },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
