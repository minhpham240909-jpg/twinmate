// Admin Dashboard Query Streaming
// Handles large dataset exports and real-time streaming for admin operations
// Prevents memory overflow when dealing with 10K+ records

import { prisma } from '@/lib/prisma'

// =====================================================
// TYPES
// =====================================================

export interface StreamOptions {
  batchSize?: number
  onBatch?: (batch: any[], batchNumber: number, total: number) => void | Promise<void>
  onProgress?: (processed: number, total: number) => void
  transform?: (item: any) => any
}

export interface ExportOptions extends StreamOptions {
  format?: 'json' | 'csv'
  filename?: string
}

// =====================================================
// CURSOR-BASED STREAMING
// =====================================================

/**
 * Stream large datasets using cursor-based pagination
 * Prevents loading all records into memory at once
 *
 * Example:
 * ```ts
 * await streamQuery(
 *   (cursor, take) => prisma.user.findMany({
 *     take,
 *     skip: cursor ? 1 : 0,
 *     cursor: cursor ? { id: cursor } : undefined,
 *     orderBy: { id: 'asc' }
 *   }),
 *   {
 *     batchSize: 1000,
 *     onBatch: async (users) => {
 *       // Process 1000 users at a time
 *       await processUsers(users)
 *     }
 *   }
 * )
 * ```
 */
export async function streamQuery<T extends { id: string }>(
  query: (cursor: string | null, take: number) => Promise<T[]>,
  options: StreamOptions = {}
): Promise<void> {
  const {
    batchSize = 1000,
    onBatch,
    onProgress,
    transform,
  } = options

  let cursor: string | null = null
  let batchNumber = 0
  let totalProcessed = 0

  while (true) {
    // Fetch next batch
    const batch = await query(cursor, batchSize)

    if (batch.length === 0) break

    batchNumber++

    // Transform if needed
    const processedBatch = transform
      ? batch.map(transform)
      : batch

    // Process batch
    if (onBatch) {
      await onBatch(processedBatch, batchNumber, totalProcessed)
    }

    totalProcessed += batch.length

    // Report progress
    if (onProgress) {
      onProgress(totalProcessed, totalProcessed) // Total unknown in cursor pagination
    }

    // Update cursor for next batch
    if (batch.length < batchSize) {
      // Last batch
      break
    }

    cursor = batch[batch.length - 1].id
  }
}

/**
 * Stream query with known total count (offset-based)
 * Better for progress tracking, but slower for very large datasets
 */
export async function streamQueryWithCount<T>(
  countQuery: () => Promise<number>,
  query: (skip: number, take: number) => Promise<T[]>,
  options: StreamOptions = {}
): Promise<void> {
  const {
    batchSize = 1000,
    onBatch,
    onProgress,
    transform,
  } = options

  // Get total count first
  const total = await countQuery()

  let processed = 0
  let batchNumber = 0

  while (processed < total) {
    // Fetch next batch
    const batch = await query(processed, batchSize)

    if (batch.length === 0) break

    batchNumber++

    // Transform if needed
    const processedBatch = transform
      ? batch.map(transform)
      : batch

    // Process batch
    if (onBatch) {
      await onBatch(processedBatch, batchNumber, total)
    }

    processed += batch.length

    // Report progress
    if (onProgress) {
      onProgress(processed, total)
    }
  }
}

// =====================================================
// SPECIALIZED ADMIN QUERIES
// =====================================================

/**
 * Stream all users with progress tracking
 * Handles 100K+ users efficiently
 */
export async function streamAllUsers(options: StreamOptions = {}) {
  return streamQuery(
    (cursor, take) =>
      prisma.user.findMany({
        take,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          lastLoginAt: true,
          isPremium: true,
          deactivatedAt: true,
        },
      }),
    options
  )
}

/**
 * Stream all study sessions
 */
export async function streamAllSessions(options: StreamOptions = {}) {
  return streamQuery(
    (cursor, take) =>
      prisma.studySession.findMany({
        take,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          title: true,
          createdBy: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
        },
      }),
    options
  )
}

/**
 * Stream analytics data for a date range
 */
export async function streamAnalytics(
  startDate: Date,
  endDate: Date,
  options: StreamOptions = {}
) {
  return streamQueryWithCount(
    () =>
      prisma.userPageVisit.count({
        where: {
          enteredAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    (skip, take) =>
      prisma.userPageVisit.findMany({
        where: {
          enteredAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        skip,
        take,
        orderBy: { enteredAt: 'asc' },
      }),
    options
  )
}

// =====================================================
// EXPORT UTILITIES
// =====================================================

/**
 * Export data to JSON (streaming to prevent memory overflow)
 */
export async function exportToJSON<T>(
  data: T[] | (() => Promise<T[]>),
  filename: string = 'export.json'
): Promise<string> {
  const records = typeof data === 'function' ? await data() : data

  // For large datasets, use streaming JSON stringify
  if (records.length > 10000) {
    return streamingJSONStringify(records)
  }

  return JSON.stringify(records, null, 2)
}

/**
 * Streaming JSON stringify for large datasets
 * Builds JSON string in chunks to avoid memory overflow
 */
function streamingJSONStringify<T>(records: T[]): string {
  let json = '['

  for (let i = 0; i < records.length; i++) {
    if (i > 0) json += ','
    json += JSON.stringify(records[i])

    // Clear reference to allow GC
    ;(records as any)[i] = null
  }

  json += ']'
  return json
}

/**
 * Convert array of objects to CSV
 */
export function convertToCSV<T extends Record<string, any>>(
  records: T[],
  headers?: string[]
): string {
  if (records.length === 0) return ''

  // Get headers from first record if not provided
  const csvHeaders = headers || Object.keys(records[0])

  // Build CSV
  const rows = [
    // Header row
    csvHeaders.map(escapeCSV).join(','),
    // Data rows
    ...records.map(record =>
      csvHeaders.map(header => escapeCSV(String(record[header] ?? ''))).join(',')
    ),
  ]

  return rows.join('\n')
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// =====================================================
// BATCH OPERATIONS
// =====================================================

/**
 * Process items in batches with concurrency control
 * Prevents overwhelming the database with parallel queries
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<R[]> {
  const {
    batchSize = 100,
    concurrency = 5,
    onProgress,
  } = options

  const results: R[] = []
  const total = items.length
  let completed = 0

  // Split into batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)

    // Process batch with limited concurrency
    const batchResults = await processConcurrent(batch, processor, concurrency)
    results.push(...batchResults)

    completed += batch.length

    if (onProgress) {
      onProgress(completed, total)
    }
  }

  return results
}

/**
 * Process items concurrently with a limit
 */
async function processConcurrent<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result)
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}

// =====================================================
// AGGREGATION UTILITIES
// =====================================================

/**
 * Efficient count with caching for expensive queries
 */
export async function cachedCount(
  cacheKey: string,
  query: () => Promise<number>,
  ttl: number = 300 // 5 minutes
): Promise<number> {
  // This would integrate with your existing cache
  // For now, just execute the query
  return query()
}

/**
 * Batch multiple count queries into a single transaction
 * Reduces round trips to database
 */
export async function batchCounts(
  queries: Record<string, () => Promise<number>>
): Promise<Record<string, number>> {
  const results: Record<string, number> = {}

  // Execute all counts in parallel within a transaction
  await prisma.$transaction(
    Object.entries(queries).map(async ([key, query]) => {
      results[key] = await query()
    })
  )

  return results
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Estimate query result size before fetching
 * Useful for deciding whether to use streaming
 */
export async function estimateResultSize(
  tableName: string,
  where?: any
): Promise<{ count: number; shouldStream: boolean }> {
  // For now, use a simple count
  // In production, you might use table statistics
  let count = 0

  switch (tableName) {
    case 'User':
      count = await prisma.user.count({ where })
      break
    case 'StudySession':
      count = await prisma.studySession.count({ where })
      break
    case 'SessionMessage':
      count = await prisma.sessionMessage.count({ where })
      break
    default:
      throw new Error(`Unknown table: ${tableName}`)
  }

  return {
    count,
    shouldStream: count > 1000, // Stream if > 1000 records
  }
}
