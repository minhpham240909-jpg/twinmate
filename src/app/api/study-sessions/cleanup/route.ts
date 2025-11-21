import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// This endpoint cleans up sessions that were created but never started within 30 minutes
// SECURITY: Protected by API key or Vercel Cron authentication
export async function POST(request: NextRequest) {
  try {
    // Check for Vercel Cron authentication (automatically added by Vercel)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = authHeader === `Bearer ${cronSecret}`

    // Also check for manual API key (for testing)
    const apiKey = request.headers.get('x-api-key')
    const validApiKey = process.env.CLEANUP_API_KEY
    const hasValidApiKey = apiKey && validApiKey && apiKey === validApiKey

    // Accept either Vercel Cron auth OR valid API key
    if (!isVercelCron && !hasValidApiKey) {
      console.warn('Unauthorized cleanup attempt - neither Vercel Cron nor valid API key')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    // Cleanup logic:
    // 1. Delete SCHEDULED sessions older than 30 minutes with no activity
    // 2. Auto-end IN_PROGRESS sessions older than 6 hours (likely abandoned)
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

    // Find SCHEDULED sessions to delete
    const scheduledSessionsToDelete = await prisma.studySession.findMany({
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
    const sessionIdsToDelete = scheduledSessionsToDelete
      .filter(session => !session.timer || session.timer.totalStudyTime === 0)
      .map(session => session.id)

    // Find ACTIVE sessions to auto-end (abandoned)
    const abandonedSessions = await prisma.studySession.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: {
          lt: sixHoursAgo,
        },
      },
    })

    let deletedCount = 0
    let autoEndedCount = 0

    // Delete SCHEDULED sessions
    if (sessionIdsToDelete.length > 0) {
      await prisma.studySession.deleteMany({
        where: {
          id: {
            in: sessionIdsToDelete,
          },
        },
      })
      deletedCount = sessionIdsToDelete.length
    }

    // Auto-end abandoned ACTIVE sessions
    if (abandonedSessions.length > 0) {
      for (const session of abandonedSessions) {
        try {
          const endedAt = new Date()
          const startedAt = new Date(session.startedAt!)
          const durationMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000)

          await prisma.$transaction(async (tx) => {
            // Update session status
            await tx.studySession.update({
              where: { id: session.id },
              data: {
                status: 'COMPLETED',
                endedAt,
                durationMinutes,
              },
            })

            // Update participants to LEFT
            await tx.sessionParticipant.updateMany({
              where: {
                sessionId: session.id,
                status: 'JOINED',
              },
              data: {
                status: 'LEFT',
                leftAt: endedAt,
              },
            })
          })

          autoEndedCount++
        } catch (err) {
          console.error(`Failed to auto-end session ${session.id}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      autoEndedCount,
      message: `Cleaned up ${deletedCount} inactive session(s) and auto-ended ${autoEndedCount} abandoned session(s)`,
    })
  } catch (error) {
    console.error('Error cleaning up sessions:', error)
    return NextResponse.json(
      { error: 'Failed to clean up sessions' },
      { status: 500 }
    )
  }
}
