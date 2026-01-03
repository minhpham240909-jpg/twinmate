/**
 * AI Monitoring System
 * Tracks usage, errors, costs, and performance metrics
 *
 * Features:
 * - Token usage tracking per user/session
 * - Cost estimation and tracking
 * - Error logging and alerting
 * - Performance metrics (latency, throughput)
 * - Daily/monthly usage summaries
 */

import { prisma } from '@/lib/prisma'
import { recordUsage } from './quota'

// Types
export interface AIUsageMetric {
  id?: string
  userId?: string
  sessionId?: string
  model: string
  operation: AIOperation
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  latencyMs: number
  cached: boolean
  success: boolean
  errorType?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
  createdAt?: Date
}

export type AIOperation =
  | 'chat'
  | 'chat_stream'
  | 'quiz_generation'
  | 'flashcard_generation'
  | 'whiteboard_analysis'
  | 'session_summary'
  | 'memory_extraction'
  | 'moderation'
  | 'content_safety'

export interface UsageSummary {
  period: 'day' | 'week' | 'month'
  totalTokens: number
  totalCost: number
  totalRequests: number
  successRate: number
  avgLatencyMs: number
  cacheHitRate: number
  tokensByModel: Record<string, number>
  tokensByOperation: Record<string, number>
  topUsers: Array<{ userId: string; tokens: number; cost: number }>
  errorBreakdown: Record<string, number>
}

export interface AlertConfig {
  dailyCostThreshold: number
  errorRateThreshold: number
  latencyThresholdMs: number
  tokenUsageThreshold: number
}

// Cost per 1K tokens (as of Dec 2024)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'o1': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'default': { input: 0.0005, output: 0.0015 },
}

// In-memory metrics buffer for batching
const metricsBuffer: AIUsageMetric[] = []
const BUFFER_FLUSH_SIZE = 50
const BUFFER_FLUSH_INTERVAL_MS = 30000

// Aggregate counters for real-time stats
let aggregateStats = {
  totalTokens: 0,
  totalCost: 0,
  totalRequests: 0,
  successCount: 0,
  cacheHits: 0,
  totalLatencyMs: 0,
  errors: {} as Record<string, number>,
  tokensByModel: {} as Record<string, number>,
  tokensByOperation: {} as Record<string, number>,
  lastReset: new Date(),
}

/**
 * Calculate estimated cost for token usage
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = TOKEN_COSTS[model] || TOKEN_COSTS.default
  const inputCost = (promptTokens / 1000) * costs.input
  const outputCost = (completionTokens / 1000) * costs.output
  return Math.round((inputCost + outputCost) * 1000000) / 1000000 // Round to 6 decimal places
}

/**
 * Track an AI usage metric
 */
export async function trackUsage(metric: AIUsageMetric): Promise<void> {
  // Calculate cost if not provided
  if (!metric.estimatedCost) {
    metric.estimatedCost = calculateCost(
      metric.model,
      metric.promptTokens,
      metric.completionTokens
    )
  }

  // Update in-memory aggregates
  aggregateStats.totalTokens += metric.totalTokens
  aggregateStats.totalCost += metric.estimatedCost
  aggregateStats.totalRequests++
  aggregateStats.totalLatencyMs += metric.latencyMs

  if (metric.success) {
    aggregateStats.successCount++
  }
  if (metric.cached) {
    aggregateStats.cacheHits++
  }
  if (metric.errorType) {
    aggregateStats.errors[metric.errorType] = (aggregateStats.errors[metric.errorType] || 0) + 1
  }

  // Track by model
  aggregateStats.tokensByModel[metric.model] =
    (aggregateStats.tokensByModel[metric.model] || 0) + metric.totalTokens

  // Track by operation
  aggregateStats.tokensByOperation[metric.operation] =
    (aggregateStats.tokensByOperation[metric.operation] || 0) + metric.totalTokens

  // Add to buffer
  metricsBuffer.push({
    ...metric,
    createdAt: new Date(),
  })

  // Flush if buffer is full
  if (metricsBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushMetricsBuffer()
  }

  // SCALABILITY: Update per-user quota tracking in Redis
  if (metric.userId && metric.success) {
    await recordUsage(metric.userId, metric.totalTokens, metric.estimatedCost)
  }
}

/**
 * Flush metrics buffer to database
 */
async function flushMetricsBuffer(): Promise<void> {
  if (metricsBuffer.length === 0) return

  const metricsToFlush = [...metricsBuffer]
  metricsBuffer.length = 0

  try {
    // Store in AIUsageLog table (if exists)
    await prisma.aIUsageLog?.createMany({
      data: metricsToFlush.map(m => ({
        userId: m.userId || null,
        sessionId: m.sessionId || null,
        model: m.model,
        operation: m.operation,
        promptTokens: m.promptTokens,
        completionTokens: m.completionTokens,
        totalTokens: m.totalTokens,
        estimatedCost: m.estimatedCost,
        latencyMs: m.latencyMs,
        cached: m.cached,
        success: m.success,
        errorType: m.errorType || null,
        errorMessage: m.errorMessage || null,
        metadata: m.metadata as any || null,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    // Table might not exist, log to console instead
    console.log(`[AI Monitoring] Flushed ${metricsToFlush.length} metrics (DB not available)`)
  }
}

/**
 * Get real-time aggregate stats
 */
export function getRealTimeStats(): {
  totalTokens: number
  totalCost: number
  totalRequests: number
  successRate: number
  avgLatencyMs: number
  cacheHitRate: number
  tokensByModel: Record<string, number>
  tokensByOperation: Record<string, number>
  errors: Record<string, number>
  periodStart: Date
} {
  const successRate = aggregateStats.totalRequests > 0
    ? (aggregateStats.successCount / aggregateStats.totalRequests) * 100
    : 100

  const avgLatencyMs = aggregateStats.totalRequests > 0
    ? aggregateStats.totalLatencyMs / aggregateStats.totalRequests
    : 0

  const cacheHitRate = aggregateStats.totalRequests > 0
    ? (aggregateStats.cacheHits / aggregateStats.totalRequests) * 100
    : 0

  return {
    totalTokens: aggregateStats.totalTokens,
    totalCost: Math.round(aggregateStats.totalCost * 10000) / 10000,
    totalRequests: aggregateStats.totalRequests,
    successRate: Math.round(successRate * 100) / 100,
    avgLatencyMs: Math.round(avgLatencyMs),
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    tokensByModel: { ...aggregateStats.tokensByModel },
    tokensByOperation: { ...aggregateStats.tokensByOperation },
    errors: { ...aggregateStats.errors },
    periodStart: aggregateStats.lastReset,
  }
}

/**
 * Reset aggregate stats (call daily or on demand)
 */
export function resetAggregateStats(): void {
  aggregateStats = {
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    successCount: 0,
    cacheHits: 0,
    totalLatencyMs: 0,
    errors: {},
    tokensByModel: {},
    tokensByOperation: {},
    lastReset: new Date(),
  }
}

/**
 * Get usage summary for a period
 */
export async function getUsageSummary(
  period: 'day' | 'week' | 'month',
  userId?: string
): Promise<UsageSummary | null> {
  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7))
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }

  try {
    // Try to get from database
    const logs = await prisma.aIUsageLog?.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(userId ? { userId } : {}),
      },
    })

    if (!logs || logs.length === 0) {
      // Return real-time stats if no DB data
      const realTime = getRealTimeStats()
      return {
        period,
        totalTokens: realTime.totalTokens,
        totalCost: realTime.totalCost,
        totalRequests: realTime.totalRequests,
        successRate: realTime.successRate,
        avgLatencyMs: realTime.avgLatencyMs,
        cacheHitRate: realTime.cacheHitRate,
        tokensByModel: realTime.tokensByModel,
        tokensByOperation: realTime.tokensByOperation,
        topUsers: [],
        errorBreakdown: realTime.errors,
      }
    }

    // Aggregate from logs
    let totalTokens = 0
    let totalCost = 0
    let successCount = 0
    let cacheHits = 0
    let totalLatency = 0
    const tokensByModel: Record<string, number> = {}
    const tokensByOperation: Record<string, number> = {}
    const errorBreakdown: Record<string, number> = {}
    const userTokens: Record<string, { tokens: number; cost: number }> = {}

    for (const log of logs) {
      totalTokens += log.totalTokens
      totalCost += log.estimatedCost
      totalLatency += log.latencyMs

      if (log.success) successCount++
      if (log.cached) cacheHits++
      if (log.errorType) {
        errorBreakdown[log.errorType] = (errorBreakdown[log.errorType] || 0) + 1
      }

      tokensByModel[log.model] = (tokensByModel[log.model] || 0) + log.totalTokens
      tokensByOperation[log.operation] = (tokensByOperation[log.operation] || 0) + log.totalTokens

      if (log.userId) {
        if (!userTokens[log.userId]) {
          userTokens[log.userId] = { tokens: 0, cost: 0 }
        }
        userTokens[log.userId].tokens += log.totalTokens
        userTokens[log.userId].cost += log.estimatedCost
      }
    }

    const topUsers = Object.entries(userTokens)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10)

    return {
      period,
      totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalRequests: logs.length,
      successRate: Math.round((successCount / logs.length) * 10000) / 100,
      avgLatencyMs: Math.round(totalLatency / logs.length),
      cacheHitRate: Math.round((cacheHits / logs.length) * 10000) / 100,
      tokensByModel,
      tokensByOperation,
      topUsers,
      errorBreakdown,
    }
  } catch {
    // Database not available, return real-time stats
    const realTime = getRealTimeStats()
    return {
      period,
      totalTokens: realTime.totalTokens,
      totalCost: realTime.totalCost,
      totalRequests: realTime.totalRequests,
      successRate: realTime.successRate,
      avgLatencyMs: realTime.avgLatencyMs,
      cacheHitRate: realTime.cacheHitRate,
      tokensByModel: realTime.tokensByModel,
      tokensByOperation: realTime.tokensByOperation,
      topUsers: [],
      errorBreakdown: realTime.errors,
    }
  }
}

/**
 * Log an AI error
 */
export async function logError(
  error: Error,
  context: {
    userId?: string
    sessionId?: string
    operation: AIOperation
    model: string
    promptTokens?: number
  }
): Promise<void> {
  const errorType = error.name || 'UnknownError'
  const errorMessage = error.message.slice(0, 500)

  await trackUsage({
    userId: context.userId,
    sessionId: context.sessionId,
    model: context.model,
    operation: context.operation,
    promptTokens: context.promptTokens || 0,
    completionTokens: 0,
    totalTokens: context.promptTokens || 0,
    estimatedCost: 0,
    latencyMs: 0,
    cached: false,
    success: false,
    errorType,
    errorMessage,
  })

  // Log to console for immediate visibility
  console.error(`[AI Error] ${errorType}: ${errorMessage}`, {
    operation: context.operation,
    model: context.model,
    userId: context.userId,
  })
}

/**
 * Check if usage is within limits
 */
export async function checkUsageLimits(
  userId: string,
  limits: {
    dailyTokenLimit?: number
    dailyCostLimit?: number
  }
): Promise<{
  withinLimits: boolean
  currentTokens: number
  currentCost: number
  tokenLimit?: number
  costLimit?: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let currentTokens = 0
  let currentCost = 0

  try {
    const todayLogs = await prisma.aIUsageLog?.findMany({
      where: {
        userId,
        createdAt: { gte: today },
      },
      select: {
        totalTokens: true,
        estimatedCost: true,
      },
    })

    if (todayLogs) {
      for (const log of todayLogs) {
        currentTokens += log.totalTokens
        currentCost += log.estimatedCost
      }
    }
  } catch {
    // Use real-time stats as fallback
    // (This won't be per-user accurate but better than nothing)
  }

  const withinTokenLimit = !limits.dailyTokenLimit || currentTokens < limits.dailyTokenLimit
  const withinCostLimit = !limits.dailyCostLimit || currentCost < limits.dailyCostLimit

  return {
    withinLimits: withinTokenLimit && withinCostLimit,
    currentTokens,
    currentCost: Math.round(currentCost * 10000) / 10000,
    tokenLimit: limits.dailyTokenLimit,
    costLimit: limits.dailyCostLimit,
  }
}

/**
 * Performance tracking wrapper
 * Wraps an async function to automatically track metrics
 */
export function withMonitoring<T>(
  operation: AIOperation,
  model: string,
  context: { userId?: string; sessionId?: string },
  fn: () => Promise<T & { promptTokens: number; completionTokens: number; totalTokens: number }>
): () => Promise<T & { promptTokens: number; completionTokens: number; totalTokens: number }> {
  return async () => {
    const startTime = Date.now()
    let success = true
    let errorType: string | undefined
    let errorMessage: string | undefined

    try {
      const result = await fn()
      const latencyMs = Date.now() - startTime

      // Track successful call
      await trackUsage({
        userId: context.userId,
        sessionId: context.sessionId,
        model,
        operation,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        estimatedCost: calculateCost(model, result.promptTokens, result.completionTokens),
        latencyMs,
        cached: false,
        success: true,
      })

      return result
    } catch (error) {
      success = false
      errorType = (error as Error).name
      errorMessage = (error as Error).message

      await logError(error as Error, {
        userId: context.userId,
        sessionId: context.sessionId,
        operation,
        model,
      })

      throw error
    }
  }
}

// Auto-flush buffer periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    flushMetricsBuffer().catch(console.error)
  }, BUFFER_FLUSH_INTERVAL_MS)
}
