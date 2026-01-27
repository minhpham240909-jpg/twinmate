/**
 * ROADMAP SHARING SERVICE
 *
 * Manages sharing completed roadmaps publicly.
 * Features:
 * - Generate shareable links
 * - Track views and copies
 * - Privacy controls
 * - Copy roadmap to personal account
 */

import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import crypto from 'crypto'

// ============================================
// TYPES
// ============================================

export interface SharedRoadmapData {
  id: string
  shareCode: string
  roadmapId: string
  userId: string
  title: string
  goal: string
  overview: string | null
  subject: string | null
  totalSteps: number
  estimatedMinutes: number
  completedAt: Date | null
  viewCount: number
  copyCount: number
  isPublic: boolean
  allowCopy: boolean
  createdAt: Date
  roadmap: {
    id: string
    title: string
    goal: string
    overview: string | null
    subject: string | null
    pitfalls: string[]
    successLooksLike: string | null
    steps: {
      order: number
      title: string
      description: string
      timeframe: string | null
      method: string | null
      avoid: string | null
      doneWhen: string | null
      duration: number | null
    }[]
  }
}

export interface ShareRoadmapInput {
  roadmapId: string
  customTitle?: string
  customDescription?: string
  isPublic?: boolean
  allowCopy?: boolean
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate a unique shareable code
 */
function generateShareCode(): string {
  // Generate 8 character alphanumeric code
  return crypto.randomBytes(4).toString('hex')
}

// ============================================
// SHARING FUNCTIONS
// ============================================

/**
 * Share a completed roadmap publicly
 */
export async function shareRoadmap(
  userId: string,
  input: ShareRoadmapInput
): Promise<SharedRoadmapData> {
  const { roadmapId, customTitle, customDescription, isPublic = true, allowCopy = true } = input

  // Get the roadmap with steps
  const roadmap = await prisma.learningRoadmap.findFirst({
    where: {
      id: roadmapId,
      userId,
      status: 'COMPLETED',
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!roadmap) {
    throw new Error('Completed roadmap not found')
  }

  // Check if already shared
  const existing = await prisma.sharedRoadmap.findFirst({
    where: { roadmapId, userId },
  })

  if (existing) {
    // Update existing share
    const updated = await prisma.sharedRoadmap.update({
      where: { id: existing.id },
      data: {
        customTitle,
        customDescription,
        isPublic,
        allowCopy,
      },
    })

    logger.info('[Share] Updated shared roadmap', {
      userId,
      shareId: updated.id,
      shareCode: updated.shareCode,
    })

    return buildShareData(updated, roadmap)
  }

  // Create new share
  const shareCode = generateShareCode()

  const shared = await prisma.sharedRoadmap.create({
    data: {
      shareCode,
      roadmapId,
      userId,
      customTitle,
      customDescription,
      isPublic,
      allowCopy,
    },
  })

  logger.info('[Share] Created shared roadmap', {
    userId,
    shareId: shared.id,
    shareCode: shared.shareCode,
    roadmapId,
  })

  return buildShareData(shared, roadmap)
}

/**
 * Get a shared roadmap by share code (public access)
 */
export async function getSharedRoadmap(shareCode: string): Promise<SharedRoadmapData | null> {
  const shared = await prisma.sharedRoadmap.findFirst({
    where: {
      shareCode,
      isPublic: true,
    },
  })

  if (!shared) {
    return null
  }

  // Get the roadmap
  const roadmap = await prisma.learningRoadmap.findUnique({
    where: { id: shared.roadmapId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!roadmap) {
    return null
  }

  // Increment view count
  await prisma.sharedRoadmap.update({
    where: { id: shared.id },
    data: { viewCount: { increment: 1 } },
  })

  return buildShareData(shared, roadmap)
}

/**
 * Get user's shared roadmaps
 */
export async function getUserSharedRoadmaps(
  userId: string
): Promise<SharedRoadmapData[]> {
  const sharedList = await prisma.sharedRoadmap.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  // Get all roadmaps for these shares
  const roadmapIds = sharedList.map(s => s.roadmapId)
  const roadmaps = await prisma.learningRoadmap.findMany({
    where: { id: { in: roadmapIds } },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  const roadmapMap = new Map(roadmaps.map(r => [r.id, r]))

  return sharedList
    .map(shared => {
      const roadmap = roadmapMap.get(shared.roadmapId)
      if (!roadmap) return null
      return buildShareData(shared, roadmap)
    })
    .filter((item): item is SharedRoadmapData => item !== null)
}

/**
 * Copy a shared roadmap to user's account
 */
export async function copyRoadmap(
  shareCode: string,
  userId: string
): Promise<string> {
  // Get the shared roadmap
  const shared = await prisma.sharedRoadmap.findFirst({
    where: {
      shareCode,
      isPublic: true,
      allowCopy: true,
    },
  })

  if (!shared) {
    throw new Error('Shared roadmap not found')
  }

  // Don't allow copying own roadmap
  if (shared.userId === userId) {
    throw new Error('Cannot copy your own roadmap')
  }

  // Get the source roadmap
  const sourceRoadmap = await prisma.learningRoadmap.findUnique({
    where: { id: shared.roadmapId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!sourceRoadmap) {
    throw new Error('Source roadmap not found')
  }

  // Create the copied roadmap
  const copied = await prisma.learningRoadmap.create({
    data: {
      userId,
      title: shared.customTitle || sourceRoadmap.title,
      goal: sourceRoadmap.goal,
      overview: sourceRoadmap.overview,
      subject: sourceRoadmap.subject,
      pitfalls: sourceRoadmap.pitfalls,
      successLooksLike: sourceRoadmap.successLooksLike,
      estimatedMinutes: sourceRoadmap.estimatedMinutes,
      status: 'ACTIVE',
      currentStepIndex: 0,
      totalSteps: sourceRoadmap.steps.length,
      completedSteps: 0,
      steps: {
        create: sourceRoadmap.steps.map((step) => ({
          order: step.order,
          title: step.title,
          description: step.description,
          timeframe: step.timeframe,
          method: step.method,
          avoid: step.avoid,
          doneWhen: step.doneWhen,
          duration: step.duration,
          status: step.order === 0 ? 'CURRENT' : 'LOCKED',
        })),
      },
    },
  })

  // Increment copy count
  await prisma.sharedRoadmap.update({
    where: { id: shared.id },
    data: { copyCount: { increment: 1 } },
  })

  logger.info('[Share] Roadmap copied', {
    userId,
    sharedId: shared.id,
    newRoadmapId: copied.id,
  })

  return copied.id
}

/**
 * Unshare a roadmap
 */
export async function unshareRoadmap(
  shareId: string,
  userId: string
): Promise<boolean> {
  const shared = await prisma.sharedRoadmap.findFirst({
    where: {
      id: shareId,
      userId,
    },
  })

  if (!shared) {
    return false
  }

  await prisma.sharedRoadmap.delete({
    where: { id: shareId },
  })

  logger.info('[Share] Unshared roadmap', {
    userId,
    shareId,
  })

  return true
}

/**
 * Update share visibility
 */
export async function updateShareVisibility(
  shareId: string,
  userId: string,
  isPublic: boolean
): Promise<SharedRoadmapData | null> {
  const shared = await prisma.sharedRoadmap.findFirst({
    where: {
      id: shareId,
      userId,
    },
  })

  if (!shared) {
    return null
  }

  const updated = await prisma.sharedRoadmap.update({
    where: { id: shareId },
    data: { isPublic },
  })

  // Get roadmap for full response
  const roadmap = await prisma.learningRoadmap.findUnique({
    where: { id: updated.roadmapId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!roadmap) {
    return null
  }

  return buildShareData(updated, roadmap)
}

/**
 * Get popular shared roadmaps (for discovery)
 */
export async function getPopularSharedRoadmaps(
  limit: number = 10,
  subject?: string
): Promise<SharedRoadmapData[]> {
  // First get roadmaps matching subject if provided
  let roadmapIds: string[] | undefined
  if (subject) {
    const roadmaps = await prisma.learningRoadmap.findMany({
      where: { subject },
      select: { id: true },
    })
    roadmapIds = roadmaps.map(r => r.id)
  }

  const sharedList = await prisma.sharedRoadmap.findMany({
    where: {
      isPublic: true,
      ...(roadmapIds ? { roadmapId: { in: roadmapIds } } : {}),
    },
    orderBy: [
      { copyCount: 'desc' },
      { viewCount: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  })

  // Get all roadmaps for these shares
  const allRoadmapIds = sharedList.map(s => s.roadmapId)
  const roadmaps = await prisma.learningRoadmap.findMany({
    where: { id: { in: allRoadmapIds } },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  })

  const roadmapMap = new Map(roadmaps.map(r => [r.id, r]))

  return sharedList
    .map(shared => {
      const roadmap = roadmapMap.get(shared.roadmapId)
      if (!roadmap) return null
      return buildShareData(shared, roadmap)
    })
    .filter((item): item is SharedRoadmapData => item !== null)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

interface SharedRecord {
  id: string
  shareCode: string
  roadmapId: string
  userId: string
  customTitle: string | null
  customDescription: string | null
  isPublic: boolean
  allowCopy: boolean
  viewCount: number
  copyCount: number
  createdAt: Date
}

interface RoadmapRecord {
  id: string
  title: string
  goal: string
  overview: string | null
  subject: string | null
  pitfalls: string[]
  successLooksLike: string | null
  estimatedMinutes: number | null
  completedAt: Date | null
  steps: {
    order: number
    title: string
    description: string
    timeframe: string | null
    method: string | null
    avoid: string | null
    doneWhen: string | null
    duration: number | null
  }[]
}

function buildShareData(
  shared: SharedRecord,
  roadmap: RoadmapRecord
): SharedRoadmapData {
  return {
    id: shared.id,
    shareCode: shared.shareCode,
    roadmapId: shared.roadmapId,
    userId: shared.userId,
    title: shared.customTitle || roadmap.title,
    goal: roadmap.goal,
    overview: shared.customDescription || roadmap.overview,
    subject: roadmap.subject,
    totalSteps: roadmap.steps.length,
    estimatedMinutes: roadmap.estimatedMinutes || 0,
    completedAt: roadmap.completedAt,
    viewCount: shared.viewCount,
    copyCount: shared.copyCount,
    isPublic: shared.isPublic,
    allowCopy: shared.allowCopy,
    createdAt: shared.createdAt,
    roadmap: {
      id: roadmap.id,
      title: roadmap.title,
      goal: roadmap.goal,
      overview: roadmap.overview,
      subject: roadmap.subject,
      pitfalls: roadmap.pitfalls,
      successLooksLike: roadmap.successLooksLike,
      steps: roadmap.steps.map((step) => ({
        order: step.order,
        title: step.title,
        description: step.description,
        timeframe: step.timeframe,
        method: step.method,
        avoid: step.avoid,
        doneWhen: step.doneWhen,
        duration: step.duration,
      })),
    },
  }
}
