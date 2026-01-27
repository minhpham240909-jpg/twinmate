/**
 * LEARNING CAPTURE SERVICE
 *
 * Manages quick captures - notes, insights, photos users save during learning.
 * Includes spaced repetition for review.
 *
 * Key Features:
 * - Create captures (note, photo, link)
 * - Link to roadmap/step context
 * - Tag organization
 * - Spaced repetition review scheduling
 * - SM-2 algorithm for retention
 */

import { prisma } from '@/lib/prisma'
import { CaptureType } from '@prisma/client'
import logger from '@/lib/logger'

// ============================================
// TYPES
// ============================================

export interface CaptureData {
  id: string
  type: CaptureType
  content: string
  title: string | null
  mediaUrl: string | null
  mediaType: string | null
  roadmapId: string | null
  stepId: string | null
  subject: string | null
  tags: string[]
  isFavorite: boolean
  isArchived: boolean
  nextReviewAt: Date | null
  reviewCount: number
  lastReviewedAt: Date | null
  retentionScore: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateCaptureInput {
  type?: CaptureType
  content: string
  title?: string
  mediaUrl?: string
  mediaType?: string
  roadmapId?: string
  stepId?: string
  subject?: string
  tags?: string[]
}

export interface CaptureFilters {
  roadmapId?: string
  stepId?: string
  subject?: string
  tags?: string[]
  isFavorite?: boolean
  isArchived?: boolean
  type?: CaptureType
}

// Simple review responses that map to SM-2 quality
export type ReviewResponseType = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

// Map simple responses to SM-2 quality scores
const RESPONSE_TO_QUALITY: Record<ReviewResponseType, number> = {
  AGAIN: 1, // Complete failure
  HARD: 3,  // Correct with difficulty
  GOOD: 4,  // Correct with hesitation
  EASY: 5,  // Perfect recall
}

// ============================================
// CAPTURE CRUD
// ============================================

/**
 * Create a new capture
 */
export async function createCapture(
  userId: string,
  input: CreateCaptureInput
): Promise<CaptureData> {
  const {
    type = 'NOTE',
    content,
    title,
    mediaUrl,
    mediaType,
    roadmapId,
    stepId,
    subject,
    tags = [],
  } = input

  // Validate content length
  if (!content || content.trim().length === 0) {
    throw new Error('Content is required')
  }

  if (content.length > 10000) {
    throw new Error('Content must be less than 10000 characters')
  }

  // Calculate first review date (1 day from now)
  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + 1)

  const capture = await prisma.learningCapture.create({
    data: {
      userId,
      type,
      content: content.trim(),
      title: title?.trim() || null,
      mediaUrl,
      mediaType,
      roadmapId,
      stepId,
      subject,
      tags,
      nextReviewAt,
    },
  })

  logger.info('[Capture] Created new capture', {
    userId,
    captureId: capture.id,
    type,
    hasRoadmap: !!roadmapId,
    hasStep: !!stepId,
  })

  return capture as CaptureData
}

/**
 * Get a capture by ID
 */
export async function getCapture(
  captureId: string,
  userId: string
): Promise<CaptureData | null> {
  const capture = await prisma.learningCapture.findFirst({
    where: {
      id: captureId,
      userId,
    },
  })

  return capture as CaptureData | null
}

// Alias for getCaptureById
export const getCaptureById = getCapture

/**
 * Update a capture
 */
export async function updateCapture(
  captureId: string,
  userId: string,
  data: {
    content?: string
    title?: string
    tags?: string[]
    isFavorite?: boolean
    isArchived?: boolean
    subject?: string
  }
): Promise<CaptureData | null> {
  // Verify ownership
  const existing = await prisma.learningCapture.findFirst({
    where: { id: captureId, userId },
  })

  if (!existing) {
    return null
  }

  const capture = await prisma.learningCapture.update({
    where: { id: captureId },
    data: {
      content: data.content?.trim(),
      title: data.title?.trim(),
      tags: data.tags,
      isFavorite: data.isFavorite,
      isArchived: data.isArchived,
      subject: data.subject,
    },
  })

  return capture as CaptureData
}

/**
 * Delete a capture
 */
export async function deleteCapture(
  captureId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const existing = await prisma.learningCapture.findFirst({
    where: { id: captureId, userId },
  })

  if (!existing) {
    return false
  }

  await prisma.learningCapture.delete({
    where: { id: captureId },
  })

  logger.info('[Capture] Deleted capture', {
    userId,
    captureId,
  })

  return true
}

// ============================================
// CAPTURE QUERIES
// ============================================

/**
 * Get user's captures with filters
 */
export async function getUserCaptures(
  userId: string,
  options: {
    filters?: CaptureFilters
    limit?: number
    offset?: number
    orderBy?: 'newest' | 'oldest' | 'nextReview'
  } = {}
): Promise<{ captures: CaptureData[]; total: number }> {
  const { filters = {}, limit = 20, offset = 0, orderBy = 'newest' } = options

  // Build where clause
  const where: Record<string, unknown> = {
    userId,
    isArchived: filters.isArchived ?? false,
  }

  if (filters.roadmapId) where.roadmapId = filters.roadmapId
  if (filters.stepId) where.stepId = filters.stepId
  if (filters.subject) where.subject = filters.subject
  if (filters.type) where.type = filters.type
  if (filters.isFavorite !== undefined) where.isFavorite = filters.isFavorite
  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags }
  }

  // Determine order
  let orderByClause: Record<string, string>
  switch (orderBy) {
    case 'oldest':
      orderByClause = { createdAt: 'asc' }
      break
    case 'nextReview':
      orderByClause = { nextReviewAt: 'asc' }
      break
    default:
      orderByClause = { createdAt: 'desc' }
  }

  // Execute queries in parallel (N+1 prevention)
  const [captures, total] = await Promise.all([
    prisma.learningCapture.findMany({
      where,
      orderBy: orderByClause,
      take: limit,
      skip: offset,
    }),
    prisma.learningCapture.count({ where }),
  ])

  return {
    captures: captures as CaptureData[],
    total,
  }
}

/**
 * Get captures grouped by subject
 */
export async function getCapturesBySubject(
  userId: string
): Promise<Array<{ subject: string; count: number }>> {
  const result = await prisma.learningCapture.groupBy({
    by: ['subject'],
    where: {
      userId,
      isArchived: false,
      subject: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })

  return result.map((r) => ({
    subject: r.subject || 'Uncategorized',
    count: r._count.id,
  }))
}

/**
 * Get captures for a specific roadmap
 */
export async function getRoadmapCaptures(
  userId: string,
  roadmapId: string
): Promise<CaptureData[]> {
  const captures = await prisma.learningCapture.findMany({
    where: {
      userId,
      roadmapId,
      isArchived: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  return captures as CaptureData[]
}

/**
 * Search captures by content
 */
export async function searchCaptures(
  userId: string,
  query: string,
  limit: number = 20
): Promise<CaptureData[]> {
  const captures = await prisma.learningCapture.findMany({
    where: {
      userId,
      isArchived: false,
      OR: [
        { content: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return captures as CaptureData[]
}

// ============================================
// SPACED REPETITION / REVIEW
// ============================================

/**
 * Get captures due for review
 */
export async function getDueCaptures(
  userId: string,
  limit: number = 10,
  subject?: string
): Promise<{ captures: CaptureData[]; total: number }> {
  const now = new Date()

  const where: Record<string, unknown> = {
    userId,
    isArchived: false,
    nextReviewAt: { lte: now },
  }

  if (subject) {
    where.subject = subject
  }

  const [captures, total] = await Promise.all([
    prisma.learningCapture.findMany({
      where,
      orderBy: { nextReviewAt: 'asc' },
      take: limit,
    }),
    prisma.learningCapture.count({ where }),
  ])

  return {
    captures: captures as CaptureData[],
    total,
  }
}

/**
 * Count captures due for review
 */
export async function countDueCaptures(userId: string): Promise<number> {
  const now = new Date()

  const count = await prisma.learningCapture.count({
    where: {
      userId,
      isArchived: false,
      nextReviewAt: { lte: now },
    },
  })

  return count
}

/**
 * Record a review response using SM-2 algorithm
 *
 * SM-2 Algorithm:
 * - quality: 0-5 rating of recall quality
 * - easeFactor: adjusted based on quality (min 1.3)
 * - interval: days until next review
 * - repetitions: consecutive correct answers
 */
export async function recordReviewResponse(
  captureId: string,
  userId: string,
  response: ReviewResponseType
): Promise<CaptureData & { easeFactor: number; interval: number }> {
  const capture = await prisma.learningCapture.findFirst({
    where: { id: captureId, userId },
  })

  if (!capture) {
    throw new Error('Capture not found')
  }

  // Convert simple response to SM-2 quality score
  const quality = RESPONSE_TO_QUALITY[response]
  let { easeFactor, intervalDays, repetitions } = capture

  // SM-2 Algorithm implementation
  if (quality < 3) {
    // Failed recall - reset
    repetitions = 0
    intervalDays = 1
  } else {
    // Successful recall
    if (repetitions === 0) {
      intervalDays = 1
    } else if (repetitions === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * easeFactor)
    }
    repetitions += 1
  }

  // Update ease factor
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  // Calculate next review date
  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays)

  // Calculate retention score (0-1)
  const retentionScore = Math.min(1, (repetitions * 0.15) + (quality / 10))

  const updatedCapture = await prisma.learningCapture.update({
    where: { id: captureId },
    data: {
      easeFactor,
      intervalDays,
      repetitions,
      nextReviewAt,
      retentionScore,
      reviewCount: { increment: 1 },
      lastReviewedAt: new Date(),
    },
  })

  logger.info('[Capture] Recorded review', {
    userId,
    captureId,
    response,
    quality,
    newInterval: intervalDays,
    nextReview: nextReviewAt.toISOString().split('T')[0],
  })

  return {
    ...updatedCapture,
    easeFactor: updatedCapture.easeFactor,
    interval: updatedCapture.intervalDays,
  } as CaptureData & { easeFactor: number; interval: number }
}

/**
 * Start a review session
 */
export async function startReviewSession(
  userId: string,
  options: {
    subject?: string
    roadmapId?: string
    limit?: number
  } = {}
): Promise<{ sessionId: string; captures: CaptureData[] }> {
  const { subject, roadmapId, limit = 10 } = options
  const now = new Date()

  // Build where clause
  const where: Record<string, unknown> = {
    userId,
    isArchived: false,
    nextReviewAt: { lte: now },
  }

  if (subject) where.subject = subject
  if (roadmapId) where.roadmapId = roadmapId

  const captures = await prisma.learningCapture.findMany({
    where,
    orderBy: { nextReviewAt: 'asc' },
    take: limit,
  })

  // Create review session record
  const session = await prisma.reviewSession.create({
    data: {
      userId,
      subject,
      roadmapId,
    },
  })

  return {
    sessionId: session.id,
    captures: captures as CaptureData[],
  }
}

/**
 * Complete a review session
 */
export async function completeReviewSession(
  sessionId: string,
  userId: string,
  stats: {
    capturesReviewed: number
    capturesCorrect: number
    capturesPartial: number
    capturesForgot: number
    durationSeconds: number
  }
): Promise<void> {
  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      ...stats,
      completedAt: new Date(),
    },
  })

  logger.info('[Capture] Completed review session', {
    userId,
    sessionId,
    ...stats,
  })
}

// ============================================
// STATS
// ============================================

/**
 * Get user's capture statistics
 */
export async function getCaptureStats(userId: string): Promise<{
  totalCaptures: number
  byType: Record<string, number>
  bySubject: Array<{ subject: string; count: number }>
  dueForReview: number
  averageRetention: number
  totalReviews: number
}> {
  const now = new Date()

  // Get all stats in parallel (N+1 prevention)
  const [
    totalCaptures,
    typeGroups,
    subjectGroups,
    dueForReview,
    retentionData,
    reviewData,
  ] = await Promise.all([
    prisma.learningCapture.count({
      where: { userId, isArchived: false },
    }),
    prisma.learningCapture.groupBy({
      by: ['type'],
      where: { userId, isArchived: false },
      _count: { id: true },
    }),
    prisma.learningCapture.groupBy({
      by: ['subject'],
      where: { userId, isArchived: false, subject: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.learningCapture.count({
      where: { userId, isArchived: false, nextReviewAt: { lte: now } },
    }),
    prisma.learningCapture.aggregate({
      where: { userId, isArchived: false, reviewCount: { gt: 0 } },
      _avg: { retentionScore: true },
    }),
    prisma.learningCapture.aggregate({
      where: { userId, isArchived: false },
      _sum: { reviewCount: true },
    }),
  ])

  const byType: Record<string, number> = {}
  for (const group of typeGroups) {
    byType[group.type] = group._count.id
  }

  const bySubject = subjectGroups.map((g) => ({
    subject: g.subject || 'Uncategorized',
    count: g._count.id,
  }))

  return {
    totalCaptures,
    byType,
    bySubject,
    dueForReview,
    averageRetention: retentionData._avg.retentionScore || 0,
    totalReviews: reviewData._sum.reviewCount || 0,
  }
}
