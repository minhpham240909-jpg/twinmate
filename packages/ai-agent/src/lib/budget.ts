/**
 * Per-User Budget Guards
 * Prevents excessive API usage and enforces cost limits
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { MemoryManager } from './memory'

export interface BudgetConfig {
  dailyRequestLimit: number
  dailyTokenLimit: number
  dailyCostLimit: number // in USD
}

export interface BudgetUsage {
  requests: number
  tokensUsed: number
  estimatedCost: number
  lastReset: Date
}

// Default limits by user role
const DEFAULT_LIMITS: Record<string, BudgetConfig> = {
  FREE: {
    dailyRequestLimit: 50,
    dailyTokenLimit: 50000,
    dailyCostLimit: 0.50, // $0.50/day
  },
  PREMIUM: {
    dailyRequestLimit: 500,
    dailyTokenLimit: 500000,
    dailyCostLimit: 5.00, // $5.00/day
  },
}

// Rough token cost estimates (per 1K tokens)
const TOKEN_COSTS = {
  'gpt-4-turbo-preview': {
    input: 0.01,
    output: 0.03,
  },
  'text-embedding-3-large': {
    input: 0.00013,
    output: 0,
  },
}

/**
 * Get user's budget config based on their role
 */
export function getBudgetConfig(userRole: string = 'FREE'): BudgetConfig {
  return DEFAULT_LIMITS[userRole] || DEFAULT_LIMITS.FREE
}

/**
 * Get current budget usage for user (from memory)
 */
export async function getBudgetUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<BudgetUsage> {
  const memory = new MemoryManager(supabase)
  const usage = await memory.loadPreference<BudgetUsage>(userId, 'budget_usage')

  if (!usage) {
    // Initialize new usage
    return {
      requests: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      lastReset: new Date(),
    }
  }

  // Check if we need to reset (new day)
  const lastReset = new Date(usage.lastReset)
  const now = new Date()
  const isNewDay =
    lastReset.getDate() !== now.getDate() ||
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear()

  if (isNewDay) {
    // Reset for new day
    return {
      requests: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      lastReset: now,
    }
  }

  return {
    ...usage,
    lastReset: new Date(usage.lastReset),
  }
}

/**
 * Update budget usage after an API call
 */
export async function updateBudgetUsage(
  supabase: SupabaseClient,
  userId: string,
  tokensUsed: number,
  model: string = 'gpt-4-turbo-preview'
): Promise<void> {
  const usage = await getBudgetUsage(supabase, userId)

  // Estimate cost
  const costs = TOKEN_COSTS[model as keyof typeof TOKEN_COSTS] || TOKEN_COSTS['gpt-4-turbo-preview']
  const inputCost = (tokensUsed * 0.7 * costs.input) / 1000 // Assume 70% input
  const outputCost = (tokensUsed * 0.3 * costs.output) / 1000 // Assume 30% output
  const estimatedCost = inputCost + outputCost

  // Update usage
  const newUsage: BudgetUsage = {
    requests: usage.requests + 1,
    tokensUsed: usage.tokensUsed + tokensUsed,
    estimatedCost: usage.estimatedCost + estimatedCost,
    lastReset: usage.lastReset,
  }

  // Store in memory (preference scope, no expiration)
  const memory = new MemoryManager(supabase)
  await memory.savePreference(userId, 'budget_usage', newUsage)
}

/**
 * Check if user can make a request (budget guard)
 */
export async function canMakeRequest(
  supabase: SupabaseClient,
  userId: string,
  userRole: string = 'FREE'
): Promise<{ allowed: boolean; reason?: string }> {
  const config = getBudgetConfig(userRole)
  const usage = await getBudgetUsage(supabase, userId)

  // Check request limit
  if (usage.requests >= config.dailyRequestLimit) {
    return {
      allowed: false,
      reason: `Daily request limit reached (${config.dailyRequestLimit}/day). Resets at midnight.`,
    }
  }

  // Check token limit
  if (usage.tokensUsed >= config.dailyTokenLimit) {
    return {
      allowed: false,
      reason: `Daily token limit reached (${config.dailyTokenLimit}/day). Resets at midnight.`,
    }
  }

  // Check cost limit
  if (usage.estimatedCost >= config.dailyCostLimit) {
    return {
      allowed: false,
      reason: `Daily cost limit reached ($${config.dailyCostLimit}/day). Resets at midnight.`,
    }
  }

  return { allowed: true }
}

/**
 * Get formatted usage summary for display
 */
export function formatUsageSummary(usage: BudgetUsage, config: BudgetConfig): string {
  const requestsPct = Math.round((usage.requests / config.dailyRequestLimit) * 100)
  const tokensPct = Math.round((usage.tokensUsed / config.dailyTokenLimit) * 100)
  const costPct = Math.round((usage.estimatedCost / config.dailyCostLimit) * 100)

  return [
    `Requests: ${usage.requests}/${config.dailyRequestLimit} (${requestsPct}%)`,
    `Tokens: ${usage.tokensUsed.toLocaleString()}/${config.dailyTokenLimit.toLocaleString()} (${tokensPct}%)`,
    `Cost: $${usage.estimatedCost.toFixed(2)}/$${config.dailyCostLimit.toFixed(2)} (${costPct}%)`,
  ].join('\n')
}

/**
 * Estimate tokens for a prompt (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4)
}
