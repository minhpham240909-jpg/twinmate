import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Completed Roadmaps Cleanup Cron Job
 *
 * Schedule: Daily (recommended to run at off-peak hours like 4 AM)
 *
 * This endpoint automatically deletes completed roadmaps after a retention period.
 * When a user completes a roadmap, it stays for X days then is auto-deleted.
 *
 * Actions:
 * 1. Delete completed roadmaps older than 7 days
 * 2. Delete abandoned roadmaps older than 30 days
 *
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-completed-roadmaps",
 *     "schedule": "0 4 * * *"
 *   }]
 * }
 */

// Configuration
const COMPLETED_ROADMAPS_RETENTION_DAYS = 7    // Delete completed roadmaps after 7 days
const ABANDONED_ROADMAPS_RETENTION_DAYS = 30   // Delete abandoned roadmaps after 30 days
const BATCH_SIZE = 100                          // Delete in batches to avoid timeouts

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[Roadmap Cleanup] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Roadmap Cleanup] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const startTime = Date.now()
    const results = {
      completedRoadmapsDeleted: 0,
      abandonedRoadmapsDeleted: 0,
      stepsDeleted: 0,
      microTasksDeleted: 0,
      errors: [] as string[],
    }

    // Calculate cutoff dates
    const completedCutoff = new Date()
    completedCutoff.setDate(completedCutoff.getDate() - COMPLETED_ROADMAPS_RETENTION_DAYS)

    const abandonedCutoff = new Date()
    abandonedCutoff.setDate(abandonedCutoff.getDate() - ABANDONED_ROADMAPS_RETENTION_DAYS)

    // 1. Delete old COMPLETED roadmaps (7+ days after completion)
    try {
      // Find completed roadmaps to delete
      const completedRoadmaps = await prisma.learningRoadmap.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: { lt: completedCutoff },
        },
        select: { id: true },
        take: BATCH_SIZE,
      })

      if (completedRoadmaps.length > 0) {
        const roadmapIds = completedRoadmaps.map(r => r.id)

        // Delete related micro tasks first
        const microTasksDeleted = await prisma.microTask.deleteMany({
          where: {
            step: {
              roadmapId: { in: roadmapIds }
            }
          }
        })
        results.microTasksDeleted += microTasksDeleted.count

        // Steps are deleted via cascade, but let's count them
        const stepsCount = await prisma.roadmapStep.count({
          where: { roadmapId: { in: roadmapIds } }
        })
        results.stepsDeleted += stepsCount

        // Delete the roadmaps (cascade will handle steps)
        const deleted = await prisma.learningRoadmap.deleteMany({
          where: { id: { in: roadmapIds } }
        })

        results.completedRoadmapsDeleted = deleted.count
        console.info(`[Roadmap Cleanup] Deleted ${deleted.count} completed roadmaps older than ${COMPLETED_ROADMAPS_RETENTION_DAYS} days`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Completed roadmaps: ${message}`)
      console.error('[Roadmap Cleanup] Error deleting completed roadmaps:', error)
    }

    // 2. Delete old ABANDONED roadmaps (30+ days since last activity)
    try {
      const abandonedRoadmaps = await prisma.learningRoadmap.findMany({
        where: {
          status: 'ABANDONED',
          lastActivityAt: { lt: abandonedCutoff },
        },
        select: { id: true },
        take: BATCH_SIZE,
      })

      if (abandonedRoadmaps.length > 0) {
        const roadmapIds = abandonedRoadmaps.map(r => r.id)

        // Delete related micro tasks first
        const microTasksDeleted = await prisma.microTask.deleteMany({
          where: {
            step: {
              roadmapId: { in: roadmapIds }
            }
          }
        })
        results.microTasksDeleted += microTasksDeleted.count

        // Count steps
        const stepsCount = await prisma.roadmapStep.count({
          where: { roadmapId: { in: roadmapIds } }
        })
        results.stepsDeleted += stepsCount

        // Delete the roadmaps
        const deleted = await prisma.learningRoadmap.deleteMany({
          where: { id: { in: roadmapIds } }
        })

        results.abandonedRoadmapsDeleted = deleted.count
        console.info(`[Roadmap Cleanup] Deleted ${deleted.count} abandoned roadmaps older than ${ABANDONED_ROADMAPS_RETENTION_DAYS} days`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Abandoned roadmaps: ${message}`)
      console.error('[Roadmap Cleanup] Error deleting abandoned roadmaps:', error)
    }

    const duration = Date.now() - startTime

    console.info(`[Roadmap Cleanup] Completed in ${duration}ms`, results)

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
      config: {
        completedRetentionDays: COMPLETED_ROADMAPS_RETENTION_DAYS,
        abandonedRetentionDays: ABANDONED_ROADMAPS_RETENTION_DAYS,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Roadmap Cleanup] Critical error:', error)
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering from admin dashboard
export async function POST(request: NextRequest) {
  return GET(request)
}
