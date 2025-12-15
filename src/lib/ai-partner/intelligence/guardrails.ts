/**
 * AI Partner Intelligence System - Guardrails
 *
 * Performance and safety guardrails to prevent overuse
 * and ensure system stability.
 *
 * Features:
 * - API call rate limiting
 * - Token budget management
 * - Memory limits
 * - Fallback controls
 */

import type { ResponseConfig, SessionContext, Guardrails } from './types'
import { DEFAULT_GUARDRAILS, DEFAULT_RESPONSE_CONFIG } from './types'

/**
 * Current guardrails configuration
 * Can be overridden for testing or special cases
 */
let currentGuardrails: Guardrails = { ...DEFAULT_GUARDRAILS }

/**
 * Set custom guardrails
 */
export function setGuardrails(guardrails: Partial<Guardrails>): void {
  currentGuardrails = { ...DEFAULT_GUARDRAILS, ...guardrails }
}

/**
 * Get current guardrails
 */
export function getGuardrails(): Guardrails {
  return { ...currentGuardrails }
}

/**
 * Reset to default guardrails
 */
export function resetGuardrails(): void {
  currentGuardrails = { ...DEFAULT_GUARDRAILS }
}

/**
 * Check if fallback API call should be allowed
 */
export function shouldUseFallback(sessionContext: SessionContext): boolean {
  return sessionContext.fallbackCallCount < currentGuardrails.maxFallbackCallsPerSession
}

/**
 * Check if session has remaining token budget
 */
export function hasTokenBudget(sessionContext: SessionContext, requestedTokens: number): boolean {
  return sessionContext.totalTokensUsed + requestedTokens <= currentGuardrails.maxTokensPerSession
}

/**
 * Enforce token limit on response config
 */
export function enforceTokenLimit(
  config: ResponseConfig,
  sessionContext: SessionContext
): ResponseConfig {
  const remaining = currentGuardrails.maxTokensPerSession - sessionContext.totalTokensUsed
  const maxAllowed = Math.min(
    config.maxTokens,
    remaining,
    currentGuardrails.maxTokensPerResponse
  )

  // If we're running low on tokens, reduce the max
  if (remaining < 2000) {
    return {
      ...config,
      maxTokens: Math.min(maxAllowed, 300), // Force short response
      length: 'short',
    }
  }

  return {
    ...config,
    maxTokens: maxAllowed,
  }
}

/**
 * Enforce all guardrails on response config
 */
export function enforceGuardrails(config: ResponseConfig): ResponseConfig {
  return {
    ...config,
    maxTokens: Math.min(config.maxTokens, currentGuardrails.maxTokensPerResponse),
  }
}

/**
 * Check if memory extraction should happen
 */
export function shouldExtractMemories(messageCount: number): boolean {
  return messageCount > 0 && messageCount % currentGuardrails.memoryExtractionInterval === 0
}

/**
 * Check if we've hit memory limit for session
 */
export function hasMemoryCapacity(currentMemoryCount: number): boolean {
  return currentMemoryCount < currentGuardrails.maxMemoriesPerSession
}

/**
 * Calculate safe token count based on content length
 * Rough estimate: 1 token ≈ 4 characters
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4) + 4 // +4 for message overhead
}

/**
 * Check if content is within safe limits
 */
export function isContentSafe(content: string, maxTokens: number = 4000): boolean {
  const estimated = estimateTokens(content)
  return estimated <= maxTokens
}

/**
 * Truncate content to fit token limit
 */
export function truncateToTokenLimit(content: string, maxTokens: number = 4000): string {
  const maxChars = maxTokens * 4 - 20 // Leave room for truncation indicator
  if (content.length <= maxChars) {
    return content
  }
  return content.substring(0, maxChars) + '...'
}

/**
 * Get timeout for fallback API call
 */
export function getFallbackTimeout(): number {
  return currentGuardrails.fallbackCallTimeoutMs
}

/**
 * Performance metrics for monitoring
 */
interface PerformanceMetrics {
  fallbackCallsUsed: number
  fallbackCallsRemaining: number
  tokensUsed: number
  tokensRemaining: number
  memoriesExtracted: number
  memoriesRemaining: number
  isHealthy: boolean
}

/**
 * Get current performance metrics for a session
 */
export function getSessionMetrics(
  sessionContext: SessionContext,
  memoriesExtracted: number = 0
): PerformanceMetrics {
  const fallbackCallsRemaining = currentGuardrails.maxFallbackCallsPerSession - sessionContext.fallbackCallCount
  const tokensRemaining = currentGuardrails.maxTokensPerSession - sessionContext.totalTokensUsed
  const memoriesRemaining = currentGuardrails.maxMemoriesPerSession - memoriesExtracted

  return {
    fallbackCallsUsed: sessionContext.fallbackCallCount,
    fallbackCallsRemaining,
    tokensUsed: sessionContext.totalTokensUsed,
    tokensRemaining,
    memoriesExtracted,
    memoriesRemaining,
    isHealthy: fallbackCallsRemaining > 2 && tokensRemaining > 5000,
  }
}

/**
 * Check if session is approaching limits
 */
export function isApproachingLimits(sessionContext: SessionContext): boolean {
  const fallbackCallsRemaining = currentGuardrails.maxFallbackCallsPerSession - sessionContext.fallbackCallCount
  const tokensRemaining = currentGuardrails.maxTokensPerSession - sessionContext.totalTokensUsed

  return fallbackCallsRemaining <= 2 || tokensRemaining <= 5000
}

/**
 * Get recommended response length based on remaining budget
 */
export function getRecommendedLength(sessionContext: SessionContext): 'short' | 'medium' | 'long' {
  const tokensRemaining = currentGuardrails.maxTokensPerSession - sessionContext.totalTokensUsed

  if (tokensRemaining < 3000) return 'short'
  if (tokensRemaining < 10000) return 'medium'
  return 'long'
}

/**
 * Safe wrapper for async operations with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    throw error
  }
}

/**
 * Rate limiter for API calls (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxCalls) {
    return false
  }

  entry.count++
  return true
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}
