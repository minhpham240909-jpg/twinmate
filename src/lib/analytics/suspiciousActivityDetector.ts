/**
 * Suspicious Activity Detection System
 * Detects and logs suspicious user behaviors
 */

import { prisma } from '@/lib/prisma'
import type { SuspiciousActivityType, SuspiciousActivitySeverity, Prisma } from '@prisma/client'

// Thresholds for suspicious activity detection
const THRESHOLDS = {
  // Messaging
  MESSAGES_PER_MINUTE: 20, // Max messages per minute
  MESSAGES_PER_HOUR: 200, // Max messages per hour
  DUPLICATE_MESSAGE_THRESHOLD: 3, // Same message sent this many times = suspicious

  // Connection requests
  CONNECTION_REQUESTS_PER_HOUR: 30,
  CONNECTION_REQUESTS_PER_DAY: 100,

  // Posts
  POSTS_PER_HOUR: 10,
  DUPLICATE_POST_THRESHOLD: 2,

  // Reports
  REPORTS_PER_HOUR: 10,
  REPORTS_PER_DAY: 20,

  // General actions
  ACTIONS_PER_MINUTE: 60, // General rate limit
  ACTIONS_PER_HOUR: 500,

  // Search
  SEARCHES_PER_MINUTE: 30,
  IDENTICAL_SEARCHES_THRESHOLD: 5,
}

interface DetectionResult {
  isSuspicious: boolean
  type?: SuspiciousActivityType
  severity?: SuspiciousActivitySeverity
  description?: string
  confidence?: number
  metadata?: Record<string, unknown>
}

/**
 * Check for rapid messaging (spam)
 */
export async function checkRapidMessaging(userId: string): Promise<DetectionResult> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [messagesLastMinute, messagesLastHour] = await Promise.all([
    prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: oneMinuteAgo },
        isDeleted: false,
      }
    }),
    prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: oneHourAgo },
        isDeleted: false,
      }
    })
  ])

  if (messagesLastMinute >= THRESHOLDS.MESSAGES_PER_MINUTE) {
    return {
      isSuspicious: true,
      type: 'RAPID_MESSAGING',
      severity: messagesLastMinute >= THRESHOLDS.MESSAGES_PER_MINUTE * 2 ? 'HIGH' : 'MEDIUM',
      description: `User sent ${messagesLastMinute} messages in the last minute (threshold: ${THRESHOLDS.MESSAGES_PER_MINUTE})`,
      confidence: 0.9,
      metadata: { messagesLastMinute, messagesLastHour }
    }
  }

  if (messagesLastHour >= THRESHOLDS.MESSAGES_PER_HOUR) {
    return {
      isSuspicious: true,
      type: 'RAPID_MESSAGING',
      severity: 'MEDIUM',
      description: `User sent ${messagesLastHour} messages in the last hour (threshold: ${THRESHOLDS.MESSAGES_PER_HOUR})`,
      confidence: 0.8,
      metadata: { messagesLastMinute, messagesLastHour }
    }
  }

  return { isSuspicious: false }
}

/**
 * Check for duplicate content (spam)
 */
export async function checkDuplicateContent(
  userId: string,
  content: string,
  contentType: 'message' | 'post'
): Promise<DetectionResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // Get recent content from user
  const recentContent = contentType === 'message'
    ? await prisma.message.findMany({
        where: {
          senderId: userId,
          createdAt: { gte: oneHourAgo },
          isDeleted: false,
        },
        select: { content: true }
      })
    : await prisma.post.findMany({
        where: {
          userId,
          createdAt: { gte: oneHourAgo },
          isDeleted: false,
        },
        select: { content: true }
      })

  // Count identical content
  const normalizedContent = content.toLowerCase().trim()
  const duplicateCount = recentContent.filter(
    item => item.content.toLowerCase().trim() === normalizedContent
  ).length

  const threshold = contentType === 'message'
    ? THRESHOLDS.DUPLICATE_MESSAGE_THRESHOLD
    : THRESHOLDS.DUPLICATE_POST_THRESHOLD

  if (duplicateCount >= threshold) {
    return {
      isSuspicious: true,
      type: 'DUPLICATE_CONTENT',
      severity: duplicateCount >= threshold * 2 ? 'HIGH' : 'MEDIUM',
      description: `User posted identical ${contentType} ${duplicateCount} times in the last hour`,
      confidence: 0.95,
      metadata: { duplicateCount, contentType, contentPreview: content.slice(0, 100) }
    }
  }

  return { isSuspicious: false }
}

/**
 * Check for mass connection requests
 */
export async function checkMassConnectionRequests(userId: string): Promise<DetectionResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [requestsLastHour, requestsLastDay] = await Promise.all([
    prisma.match.count({
      where: {
        senderId: userId,
        createdAt: { gte: oneHourAgo },
      }
    }),
    prisma.match.count({
      where: {
        senderId: userId,
        createdAt: { gte: oneDayAgo },
      }
    })
  ])

  if (requestsLastHour >= THRESHOLDS.CONNECTION_REQUESTS_PER_HOUR) {
    return {
      isSuspicious: true,
      type: 'MASS_CONNECTION_REQUESTS',
      severity: 'HIGH',
      description: `User sent ${requestsLastHour} connection requests in the last hour`,
      confidence: 0.9,
      metadata: { requestsLastHour, requestsLastDay }
    }
  }

  if (requestsLastDay >= THRESHOLDS.CONNECTION_REQUESTS_PER_DAY) {
    return {
      isSuspicious: true,
      type: 'MASS_CONNECTION_REQUESTS',
      severity: 'MEDIUM',
      description: `User sent ${requestsLastDay} connection requests in the last 24 hours`,
      confidence: 0.8,
      metadata: { requestsLastHour, requestsLastDay }
    }
  }

  return { isSuspicious: false }
}

/**
 * Check for rapid report filing
 */
export async function checkRapidReporting(userId: string): Promise<DetectionResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [reportsLastHour, reportsLastDay] = await Promise.all([
    prisma.report.count({
      where: {
        reporterId: userId,
        createdAt: { gte: oneHourAgo },
      }
    }),
    prisma.report.count({
      where: {
        reporterId: userId,
        createdAt: { gte: oneDayAgo },
      }
    })
  ])

  if (reportsLastHour >= THRESHOLDS.REPORTS_PER_HOUR) {
    return {
      isSuspicious: true,
      type: 'RAPID_REPORTING',
      severity: 'MEDIUM',
      description: `User filed ${reportsLastHour} reports in the last hour`,
      confidence: 0.85,
      metadata: { reportsLastHour, reportsLastDay }
    }
  }

  if (reportsLastDay >= THRESHOLDS.REPORTS_PER_DAY) {
    return {
      isSuspicious: true,
      type: 'RAPID_REPORTING',
      severity: 'LOW',
      description: `User filed ${reportsLastDay} reports in the last 24 hours`,
      confidence: 0.7,
      metadata: { reportsLastHour, reportsLastDay }
    }
  }

  return { isSuspicious: false }
}

/**
 * Check for unusual search patterns
 */
export async function checkUnusualSearchPattern(userId: string): Promise<DetectionResult> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const recentSearches = await prisma.userSearchQuery.findMany({
    where: {
      userId,
      createdAt: { gte: fiveMinutesAgo },
    },
    orderBy: { createdAt: 'desc' }
  })

  // Check for too many searches
  if (recentSearches.length >= THRESHOLDS.SEARCHES_PER_MINUTE * 5) {
    return {
      isSuspicious: true,
      type: 'UNUSUAL_SEARCH_PATTERN',
      severity: 'MEDIUM',
      description: `User performed ${recentSearches.length} searches in the last 5 minutes`,
      confidence: 0.75,
      metadata: { searchCount: recentSearches.length }
    }
  }

  // Check for identical searches
  const searchCounts = new Map<string, number>()
  for (const search of recentSearches) {
    const key = search.query.toLowerCase().trim()
    searchCounts.set(key, (searchCounts.get(key) || 0) + 1)
  }

  const maxIdentical = Math.max(...searchCounts.values(), 0)
  if (maxIdentical >= THRESHOLDS.IDENTICAL_SEARCHES_THRESHOLD) {
    return {
      isSuspicious: true,
      type: 'UNUSUAL_SEARCH_PATTERN',
      severity: 'LOW',
      description: `User searched for the same query ${maxIdentical} times`,
      confidence: 0.6,
      metadata: { maxIdentical, totalSearches: recentSearches.length }
    }
  }

  return { isSuspicious: false }
}

/**
 * Check for bulk actions
 */
export async function checkBulkActions(userId: string): Promise<DetectionResult> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [actionsLastMinute, actionsLastHour] = await Promise.all([
    prisma.userFeatureUsage.count({
      where: {
        userId,
        createdAt: { gte: oneMinuteAgo },
      }
    }),
    prisma.userFeatureUsage.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      }
    })
  ])

  if (actionsLastMinute >= THRESHOLDS.ACTIONS_PER_MINUTE) {
    return {
      isSuspicious: true,
      type: 'BULK_ACTIONS',
      severity: 'HIGH',
      description: `User performed ${actionsLastMinute} actions in the last minute`,
      confidence: 0.85,
      metadata: { actionsLastMinute, actionsLastHour }
    }
  }

  if (actionsLastHour >= THRESHOLDS.ACTIONS_PER_HOUR) {
    return {
      isSuspicious: true,
      type: 'BULK_ACTIONS',
      severity: 'MEDIUM',
      description: `User performed ${actionsLastHour} actions in the last hour`,
      confidence: 0.7,
      metadata: { actionsLastMinute, actionsLastHour }
    }
  }

  return { isSuspicious: false }
}

/**
 * Log suspicious activity to database
 */
export async function logSuspiciousActivity(
  userId: string,
  result: DetectionResult,
  context?: {
    ipAddress?: string
    userAgent?: string
    deviceId?: string
    relatedType?: string
    relatedId?: string
  }
): Promise<void> {
  if (!result.isSuspicious || !result.type) return

  // Check if similar activity was logged recently (avoid duplicate logs)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const existingLog = await prisma.suspiciousActivityLog.findFirst({
    where: {
      userId,
      type: result.type,
      createdAt: { gte: fiveMinutesAgo },
    }
  })

  if (existingLog) return // Don't log duplicate within 5 minutes

  await prisma.suspiciousActivityLog.create({
    data: {
      userId,
      type: result.type,
      severity: result.severity || 'LOW',
      description: result.description || 'Suspicious activity detected',
      metadata: result.metadata as Prisma.InputJsonValue | undefined,
      detectedBy: 'system',
      confidence: result.confidence,
      relatedType: context?.relatedType,
      relatedId: context?.relatedId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceId: context?.deviceId,
    }
  })
}

/**
 * Run all suspicious activity checks for a user
 */
export async function runAllChecks(
  userId: string,
  context?: {
    ipAddress?: string
    userAgent?: string
    deviceId?: string
  }
): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []

  const checks = await Promise.all([
    checkRapidMessaging(userId),
    checkMassConnectionRequests(userId),
    checkRapidReporting(userId),
    checkUnusualSearchPattern(userId),
    checkBulkActions(userId),
  ])

  for (const result of checks) {
    if (result.isSuspicious) {
      results.push(result)
      await logSuspiciousActivity(userId, result, context)
    }
  }

  return results
}

/**
 * Check specific action and log if suspicious
 */
export async function checkAndLogAction(
  userId: string,
  actionType: 'message' | 'post' | 'connection_request' | 'report' | 'search',
  content?: string,
  context?: {
    ipAddress?: string
    userAgent?: string
    deviceId?: string
    relatedType?: string
    relatedId?: string
  }
): Promise<DetectionResult | null> {
  let result: DetectionResult = { isSuspicious: false }

  switch (actionType) {
    case 'message':
      result = await checkRapidMessaging(userId)
      if (!result.isSuspicious && content) {
        result = await checkDuplicateContent(userId, content, 'message')
      }
      break
    case 'post':
      if (content) {
        result = await checkDuplicateContent(userId, content, 'post')
      }
      break
    case 'connection_request':
      result = await checkMassConnectionRequests(userId)
      break
    case 'report':
      result = await checkRapidReporting(userId)
      break
    case 'search':
      result = await checkUnusualSearchPattern(userId)
      break
  }

  if (result.isSuspicious) {
    await logSuspiciousActivity(userId, result, context)
    return result
  }

  return null
}
