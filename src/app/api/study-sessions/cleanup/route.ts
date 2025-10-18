import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// This endpoint cleans up sessions that were created but never started within 30 minutes
// SECURITY: Protected by API key to prevent unauthorized cleanup operations
export async function POST(request: NextRequest) {
  try {
    // Verify API key for cron job authentication
    const apiKey = request.headers.get('x-api-key')
    const validApiKey = process.env.CLEANUP_API_KEY

    // Reject if no API key is configured (security failsafe)
    if (!validApiKey) {
      console.error('CLEANUP_API_KEY not configured in environment variables')
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }

    // Reject if API key doesn't match
    if (!apiKey || apiKey !== validApiKey) {
      console.warn('Unauthorized cleanup attempt with invalid API key')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      )
    }
    // Find sessions that are SCHEDULED and older than 30 minutes with no study time
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    // Get sessions that match criteria:
    // 1. Status is SCHEDULED
    // 2. Created more than 30 minutes ago
    // 3. No timer has been started (or totalStudyTime is 0)
    const sessionsToDelete = await prisma.studySession.findMany({
      where: {
        status: 'SCHEDULED',
        createdAt: {
          lt: thirtyMinutesAgo,
        },
      },
      include: {
        timer: true,
      },
    })

    // Filter to only delete sessions where nobody has started studying
    const sessionIdsToDelete = sessionsToDelete
      .filter(session => !session.timer || session.timer.totalStudyTime === 0)
      .map(session => session.id)

    if (sessionIdsToDelete.length > 0) {
      // Delete the sessions (cascade will handle participants, goals, messages, timer)
      await prisma.studySession.deleteMany({
        where: {
          id: {
            in: sessionIdsToDelete,
          },
        },
      })

      return NextResponse.json({
        success: true,
        deletedCount: sessionIdsToDelete.length,
        message: `Cleaned up ${sessionIdsToDelete.length} inactive session(s)`,
      })
    }

    return NextResponse.json({
      success: true,
      deletedCount: 0,
      message: 'No sessions to clean up',
    })
  } catch (error) {
    console.error('Error cleaning up sessions:', error)
    return NextResponse.json(
      { error: 'Failed to clean up sessions' },
      { status: 500 }
    )
  }
}
