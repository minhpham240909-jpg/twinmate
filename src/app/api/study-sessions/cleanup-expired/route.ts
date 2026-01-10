import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// This endpoint will be called by a cron job or can be triggered manually
// It deletes all WAITING sessions that have expired (waitingExpiresAt < now)
export async function POST() {
  try {
    const now = new Date()

    // Find all expired waiting sessions
    // SCALABILITY: Limit to prevent unbounded cleanup operations
    const expiredSessions = await prisma.studySession.findMany({
      where: {
        status: 'WAITING',
        waitingExpiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        title: true,
        waitingExpiresAt: true,
      },
      take: 1000,
    })

    if (expiredSessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired sessions to clean up',
        deletedCount: 0,
      })
    }

    // Delete expired sessions
    const deleteResult = await prisma.studySession.deleteMany({
      where: {
        id: {
          in: expiredSessions.map((s) => s.id),
        },
      },
    })

    console.log(`Cleaned up ${deleteResult.count} expired waiting sessions:`, expiredSessions)

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleteResult.count} expired session(s)`,
      deletedCount: deleteResult.count,
      deletedSessions: expiredSessions.map((s) => ({
        id: s.id,
        title: s.title,
        expiredAt: s.waitingExpiresAt,
      })),
    })
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clean up expired sessions',
      },
      { status: 500 }
    )
  }
}

// Also allow GET requests for easy testing
export async function GET() {
  return POST()
}
