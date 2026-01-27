import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * Message Archival Cron Job
 * 
 * Schedule: Weekly (recommended to run on Sunday at 2 AM)
 * 
 * This endpoint archives old messages to prevent the Message table from 
 * growing unbounded with 3000 daily active users.
 * 
 * Strategy:
 * 1. Archive messages older than 90 days to ArchivedMessage table
 * 2. Keep original messages in place until successfully archived
 * 3. Delete archived originals in batches to avoid table locks
 * 4. Track job progress for monitoring
 * 
 * Data Retention:
 * - Messages < 90 days: Live in Message table
 * - Messages >= 90 days: Moved to ArchivedMessage table
 * - Archived messages kept indefinitely (can implement cold storage later)
 * 
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/archive-messages",
 *     "schedule": "0 2 * * 0"
 *   }]
 * }
 */

// Configuration
const MESSAGE_ARCHIVE_AGE_DAYS = 90 // Archive messages older than this
const BATCH_SIZE = 500 // Process in batches to avoid timeouts
const MAX_MESSAGES_PER_RUN = 50000 // Safety limit per run

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let jobId: string | null = null

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.error('[Message Archive] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Message Archive] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create job record for tracking
    const job = await prisma.messageArchiveJob.create({
      data: {
        status: 'running',
      },
    })
    jobId = job.id

    const results = {
      messagesFound: 0,
      messagesArchived: 0,
      messagesDeleted: 0,
      errors: [] as string[],
    }

    // Calculate cutoff date
    const archiveCutoff = new Date()
    archiveCutoff.setDate(archiveCutoff.getDate() - MESSAGE_ARCHIVE_AGE_DAYS)

    logger.info('[Message Archive] Starting archival job', {
      jobId,
      cutoffDate: archiveCutoff.toISOString(),
      batchSize: BATCH_SIZE,
    })

    // Find messages to archive (in batches)
    let totalProcessed = 0
    let hasMore = true

    while (hasMore && totalProcessed < MAX_MESSAGES_PER_RUN) {
      // Get batch of old messages
      const messagesToArchive = await prisma.message.findMany({
        where: {
          createdAt: { lt: archiveCutoff },
          // Don't re-archive if somehow missed during delete
          isDeleted: false,
        },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      })

      if (messagesToArchive.length === 0) {
        hasMore = false
        break
      }

      results.messagesFound += messagesToArchive.length

      // Archive messages in a transaction
      try {
        await prisma.$transaction(async (tx) => {
          // Insert into archive table
          await tx.archivedMessage.createMany({
            data: messagesToArchive.map((msg) => ({
              originalId: msg.id,
              content: msg.content,
              type: msg.type,
              senderId: msg.senderId,
              senderName: msg.senderName,
              senderEmail: msg.senderEmail,
              senderAvatarUrl: msg.senderAvatarUrl,
              groupId: msg.groupId,
              recipientId: msg.recipientId,
              recipientName: msg.recipientName,
              recipientEmail: msg.recipientEmail,
              fileUrl: msg.fileUrl,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              callType: msg.callType,
              callDuration: msg.callDuration,
              callStatus: msg.callStatus,
              callStartedAt: msg.callStartedAt,
              originalCreatedAt: msg.createdAt,
              archiveReason: 'age',
            })),
            skipDuplicates: true, // Skip if already archived (idempotent)
          })

          // Delete original messages
          const messageIds = messagesToArchive.map((m) => m.id)
          
          // First delete related MessageReadStatus records
          await tx.messageReadStatus.deleteMany({
            where: { messageId: { in: messageIds } },
          })

          // Then delete the messages
          await tx.message.deleteMany({
            where: { id: { in: messageIds } },
          })

          results.messagesArchived += messagesToArchive.length
          results.messagesDeleted += messagesToArchive.length
        })
      } catch (batchError) {
        const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown batch error'
        results.errors.push(`Batch error: ${errorMsg}`)
        logger.error('[Message Archive] Batch processing error', { error: errorMsg, totalProcessed })
        
        // Continue with next batch instead of failing completely
        hasMore = messagesToArchive.length === BATCH_SIZE
      }

      totalProcessed += messagesToArchive.length

      // Check if there might be more messages
      hasMore = messagesToArchive.length === BATCH_SIZE
    }

    const duration = Date.now() - startTime

    // Update job record with results
    await prisma.messageArchiveJob.update({
      where: { id: jobId },
      data: {
        status: results.errors.length === 0 ? 'completed' : 'completed_with_errors',
        messagesFound: results.messagesFound,
        messagesArchived: results.messagesArchived,
        error: results.errors.length > 0 ? results.errors.join('; ') : null,
        completedAt: new Date(),
        durationMs: duration,
      },
    })

    logger.info('[Message Archive] Job completed', {
      jobId,
      duration,
      messagesFound: results.messagesFound,
      messagesArchived: results.messagesArchived,
      messagesDeleted: results.messagesDeleted,
      errorCount: results.errors.length,
    })

    return NextResponse.json({
      success: results.errors.length === 0,
      jobId,
      ...results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[Message Archive] Critical error', { error: errorMsg, jobId })

    // Update job record if it was created
    if (jobId) {
      await prisma.messageArchiveJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: errorMsg,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      }).catch(() => {}) // Ignore error updating job record
    }

    return NextResponse.json(
      {
        error: 'Archive failed',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}

// Support POST for manual triggering from admin dashboard
export async function POST(request: NextRequest) {
  return GET(request)
}
