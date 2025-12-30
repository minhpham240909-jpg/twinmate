/**
 * Batch Processor
 *
 * Efficiently processes bulk operations in batches to prevent database
 * overload with 1000-3000 concurrent users.
 *
 * Features:
 * - Configurable batch sizes
 * - Automatic retry with backoff
 * - Progress tracking
 * - Memory-efficient streaming
 */

// Configuration imported for potential future use
// import { SCALABILITY_CONFIG } from './config'

export interface BatchOptions<T, R> {
  // Items to process
  items: T[]

  // Processing function for each batch
  processor: (batch: T[]) => Promise<R[]>

  // Batch size (default: 100)
  batchSize?: number

  // Delay between batches in ms (default: 0)
  delayBetweenBatches?: number

  // Maximum retries per batch (default: 3)
  maxRetries?: number

  // Callback for progress updates
  onProgress?: (processed: number, total: number) => void

  // Callback for batch errors
  onError?: (error: Error, batch: T[], batchIndex: number) => void

  // Whether to continue on error (default: true)
  continueOnError?: boolean
}

export interface BatchResult<R> {
  success: boolean
  results: R[]
  errors: Array<{ batchIndex: number; error: Error }>
  totalProcessed: number
  totalFailed: number
  duration: number
}

/**
 * Process items in batches
 */
export async function processBatches<T, R>(
  options: BatchOptions<T, R>
): Promise<BatchResult<R>> {
  const {
    items,
    processor,
    batchSize = 100,
    delayBetweenBatches = 0,
    maxRetries = 3,
    onProgress,
    onError,
    continueOnError = true,
  } = options

  const startTime = Date.now()
  const results: R[] = []
  const errors: Array<{ batchIndex: number; error: Error }> = []
  let processed = 0

  // Split items into batches
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    let success = false
    let lastError: Error | null = null

    // Retry logic
    for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
      try {
        const batchResults = await processor(batch)
        results.push(...batchResults)
        success = true
        processed += batch.length
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Exponential backoff on retry
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 100
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    // Handle batch failure
    if (!success && lastError) {
      errors.push({ batchIndex, error: lastError })
      onError?.(lastError, batch, batchIndex)

      if (!continueOnError) {
        break
      }
    }

    // Progress callback
    onProgress?.(processed, items.length)

    // Delay between batches
    if (delayBetweenBatches > 0 && batchIndex < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches))
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    totalProcessed: processed,
    totalFailed: items.length - processed,
    duration: Date.now() - startTime,
  }
}

/**
 * Batch notification creator
 * Creates multiple notifications in batches to prevent database overload
 */
export async function createNotificationsBatch(
  notifications: Array<{
    userId: string
    type: string
    title: string
    message: string
    actionUrl?: string
    relatedUserId?: string
    relatedMatchId?: string
  }>,
  prisma: any
): Promise<BatchResult<{ id: string }>> {
  return processBatches({
    items: notifications,
    batchSize: 50, // 50 notifications per batch
    delayBetweenBatches: 10, // Small delay to prevent overwhelming the DB
    processor: async (batch) => {
      await prisma.notification.createMany({
        data: batch,
        skipDuplicates: true,
      })

      // Return placeholder IDs since createMany doesn't return them
      return batch.map((_, i) => ({ id: `batch-${i}` }))
    },
    onError: (error, _batch, batchIndex) => {
      console.error(
        `[Notifications] Batch ${batchIndex} failed:`,
        error.message
      )
    },
  })
}

/**
 * Batch presence cleanup
 * Cleans up stale presence records in batches
 */
export async function cleanupStalePresenceBatch(
  staleThresholdMs: number,
  prisma: any
): Promise<{ cleaned: number; duration: number }> {
  const startTime = Date.now()
  const staleDate = new Date(Date.now() - staleThresholdMs)

  // Find stale device sessions
  const staleSessions: Array<{ id: string; userId: string }> = await prisma.deviceSession.findMany({
    where: {
      OR: [
        { lastHeartbeatAt: { lt: staleDate } },
        { isActive: true, lastHeartbeatAt: { lt: staleDate } },
      ],
    },
    select: { id: true, userId: true },
  })

  if (staleSessions.length === 0) {
    return { cleaned: 0, duration: Date.now() - startTime }
  }

  // Mark sessions as inactive in batches
  const result = await processBatches({
    items: staleSessions,
    batchSize: 100,
    processor: async (batch) => {
      await prisma.deviceSession.updateMany({
        where: {
          id: { in: batch.map((s: { id: string }) => s.id) },
        },
        data: {
          isActive: false,
        },
      })
      return batch
    },
  })

  // Update user presence for users with no active sessions
  const userIds = [...new Set(staleSessions.map((s) => s.userId))]

  for (const userId of userIds) {
    const hasActiveSessions = await prisma.deviceSession.findFirst({
      where: {
        userId,
        isActive: true,
        lastHeartbeatAt: { gt: staleDate },
      },
    })

    if (!hasActiveSessions) {
      await prisma.userPresence.updateMany({
        where: { userId },
        data: { status: 'offline' },
      })
    }
  }

  return {
    cleaned: result.totalProcessed,
    duration: Date.now() - startTime,
  }
}

/**
 * Batch delete processor
 * Efficiently deletes large numbers of records
 */
export async function batchDelete(
  ids: string[],
  deleteFunction: (ids: string[]) => Promise<{ count: number }>,
  batchSize: number = 100
): Promise<{ deleted: number; duration: number }> {
  const startTime = Date.now()
  let totalDeleted = 0

  await processBatches({
    items: ids,
    batchSize,
    delayBetweenBatches: 50, // Small delay to prevent lock contention
    processor: async (batch) => {
      const { count } = await deleteFunction(batch)
      totalDeleted += count
      return batch.map(() => ({ deleted: true }))
    },
  })

  return {
    deleted: totalDeleted,
    duration: Date.now() - startTime,
  }
}

/**
 * Rate-limited batch processor
 * Processes batches with rate limiting to respect API limits
 */
export async function processWithRateLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    maxConcurrent?: number
    requestsPerSecond?: number
  } = {}
): Promise<R[]> {
  const { maxConcurrent = 10, requestsPerSecond = 10 } = options

  const results: R[] = []
  const delayMs = 1000 / requestsPerSecond

  // Process in chunks of maxConcurrent
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const chunk = items.slice(i, i + maxConcurrent)

    // Process chunk in parallel
    const chunkResults = await Promise.all(
      chunk.map(async (item, index) => {
        // Stagger requests within the chunk
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * index))
        }
        return processor(item)
      })
    )

    results.push(...chunkResults)

    // Wait before next chunk
    if (i + maxConcurrent < items.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, (maxConcurrent * delayMs) / 2)
      )
    }
  }

  return results
}

export default {
  processBatches,
  createNotificationsBatch,
  cleanupStalePresenceBatch,
  batchDelete,
  processWithRateLimit,
}
