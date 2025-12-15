/**
 * AI Response Caching System (Legacy Wrapper)
 *
 * This module provides backward compatibility with the old caching API
 * while using the new response-cache.ts implementation under the hood.
 *
 * For new code, use the response-cache.ts module directly from ./intelligence
 */

import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import {
  lookupCache,
  writeCache,
  cleanupExpiredCache as cleanupCache,
  getCacheStats as getStats,
  checkMemoryCache,
  addToMemoryCache,
  normalizeQuery,
  hashQuery,
} from './intelligence'

// Types for backward compatibility
interface CacheEntry {
  response: string
  tokens: {
    prompt: number
    completion: number
    total: number
  }
  createdAt: Date
  accessCount: number
  lastAccessed: Date
}

interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  totalCached: number
  memoryEntries: number
  dbEntries: number
}

// In-memory LRU Cache (still used for fast access)
class LRUCache<K, V> {
  private maxSize: number
  private cache: Map<K, V>

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    // Delete if exists to update position
    this.cache.delete(key)

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries()
  }
}

// Global cache instance
const memoryCache = new LRUCache<string, CacheEntry>(500)

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
}

/**
 * Generate a cache key from prompt content
 * Uses hashing to create consistent, collision-resistant keys
 */
export function generateCacheKey(
  systemPrompt: string,
  userMessage: string,
  options?: {
    model?: string
    temperature?: number
  }
): string {
  // Normalize inputs
  const normalizedSystem = systemPrompt.toLowerCase().trim()
  const normalizedUser = userMessage.toLowerCase().trim()

  // Include relevant options in key
  const optionsStr = JSON.stringify({
    model: options?.model || 'default',
    temp: options?.temperature?.toFixed(1) || '0.7',
  })

  // Create hash
  const content = `${normalizedSystem}|${normalizedUser}|${optionsStr}`
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32)
}

/**
 * Check if a response should be cached
 * Some responses shouldn't be cached (personalized, time-sensitive)
 */
export function shouldCache(
  systemPrompt: string,
  userMessage: string,
  response: string
): boolean {
  // Don't cache very short or very long responses
  if (response.length < 50 || response.length > 5000) return false

  // Don't cache if it contains time-sensitive information
  const timeSensitivePatterns = [
    /today|tomorrow|yesterday/i,
    /this (week|month|year)/i,
    /\d{1,2}:\d{2}/,  // Time patterns
    /current(ly)?/i,
  ]

  if (timeSensitivePatterns.some(p => p.test(response))) return false

  // Don't cache highly personalized responses (names, specific user data)
  const personalPatterns = [
    /your score|your progress|you've (done|completed|studied)/i,
    /based on your/i,
  ]

  if (personalPatterns.some(p => p.test(response))) return false

  // Cache educational content, explanations, definitions
  const cachablePatterns = [
    /definition|meaning|concept/i,
    /example|such as|for instance/i,
    /steps?:|here's how|to do this/i,
    /formula|equation|rule/i,
  ]

  return cachablePatterns.some(p => p.test(response)) || userMessage.length > 20
}

/**
 * Get cached response from memory or database
 * Now uses the new response-cache system
 */
export async function getCachedResponse(
  cacheKey: string
): Promise<CacheEntry | null> {
  // Check memory cache first (fastest)
  const memoryEntry = memoryCache.get(cacheKey)
  if (memoryEntry) {
    // Update access stats
    memoryEntry.accessCount++
    memoryEntry.lastAccessed = new Date()
    cacheStats.hits++
    return memoryEntry
  }

  // Check database cache using new system
  try {
    const dbEntry = await prisma.aIResponseCache?.findFirst({
      where: { queryHash: cacheKey },
    })

    if (dbEntry && dbEntry.expiresAt > new Date()) {
      const metadata = dbEntry.metadata as { tokensUsed?: number } | null
      const entry: CacheEntry = {
        response: dbEntry.response,
        tokens: {
          prompt: 0,
          completion: metadata?.tokensUsed || 0,
          total: metadata?.tokensUsed || 0,
        },
        createdAt: dbEntry.createdAt,
        accessCount: dbEntry.hitCount + 1,
        lastAccessed: new Date(),
      }

      // Populate memory cache
      memoryCache.set(cacheKey, entry)

      // Update DB access stats (non-blocking)
      prisma.aIResponseCache?.update({
        where: { id: dbEntry.id },
        data: {
          hitCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      }).catch(() => {}) // Ignore errors

      cacheStats.hits++
      return entry
    }
  } catch {
    // Cache table might not exist yet, continue without DB cache
  }

  cacheStats.misses++
  return null
}

/**
 * Store response in cache
 * Now uses the new response-cache system
 */
export async function setCachedResponse(
  cacheKey: string,
  response: string,
  tokens: { prompt: number; completion: number; total: number },
  ttlHours: number = 24
): Promise<void> {
  const entry: CacheEntry = {
    response,
    tokens,
    createdAt: new Date(),
    accessCount: 1,
    lastAccessed: new Date(),
  }

  // Store in memory cache
  memoryCache.set(cacheKey, entry)

  // Store in database (for persistence across restarts)
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

    await prisma.aIResponseCache?.upsert({
      where: { queryHash: cacheKey },
      create: {
        queryHash: cacheKey,
        queryNormalized: cacheKey, // Use hash as normalized query for legacy entries
        response,
        scope: 'global',
        expiresAt,
        hitCount: 1,
        lastAccessedAt: new Date(),
        metadata: {
          tokensUsed: tokens.total,
          legacy: true,
        },
      },
      update: {
        response,
        expiresAt,
        hitCount: { increment: 1 },
        lastAccessedAt: new Date(),
        metadata: {
          tokensUsed: tokens.total,
          legacy: true,
        },
      },
    })
  } catch {
    // Cache table might not exist, continue with memory only
  }
}

/**
 * Invalidate cache entries matching a pattern
 */
export async function invalidateCache(pattern?: string): Promise<number> {
  let invalidated = 0

  if (pattern) {
    // Invalidate matching entries from memory
    for (const [key] of memoryCache.entries()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key)
        invalidated++
      }
    }

    // Invalidate from database
    try {
      const result = await prisma.aIResponseCache?.deleteMany({
        where: {
          queryHash: { contains: pattern },
        },
      })
      invalidated += result?.count || 0
    } catch {
      // Ignore if table doesn't exist
    }
  } else {
    // Clear all cache
    const memorySize = memoryCache.size()
    memoryCache.clear()

    try {
      const result = await prisma.aIResponseCache?.deleteMany({})
      invalidated = memorySize + (result?.count || 0)
    } catch {
      invalidated = memorySize
    }
  }

  return invalidated
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await prisma.aIResponseCache?.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
    return result?.count || 0
  } catch {
    return 0
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  let dbEntries = 0

  try {
    dbEntries = await prisma.aIResponseCache?.count() || 0
  } catch {
    // Table might not exist
  }

  const total = cacheStats.hits + cacheStats.misses
  const hitRate = total > 0 ? (cacheStats.hits / total) * 100 : 0

  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: Math.round(hitRate * 100) / 100,
    totalCached: memoryCache.size() + dbEntries,
    memoryEntries: memoryCache.size(),
    dbEntries,
  }
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheStats = { hits: 0, misses: 0 }
}

/**
 * Wrapper function for caching AI responses
 * Use this to wrap your AI call functions
 */
export async function withCache<T extends { content: string; promptTokens: number; completionTokens: number; totalTokens: number }>(
  systemPrompt: string,
  userMessage: string,
  aiCallFn: () => Promise<T>,
  options?: {
    model?: string
    temperature?: number
    ttlHours?: number
    forceRefresh?: boolean
  }
): Promise<T & { cached: boolean; cacheKey: string }> {
  const cacheKey = generateCacheKey(systemPrompt, userMessage, options)

  // Check cache unless force refresh
  if (!options?.forceRefresh) {
    const cached = await getCachedResponse(cacheKey)
    if (cached) {
      return {
        content: cached.response,
        promptTokens: cached.tokens.prompt,
        completionTokens: cached.tokens.completion,
        totalTokens: cached.tokens.total,
        cached: true,
        cacheKey,
      } as T & { cached: boolean; cacheKey: string }
    }
  }

  // Call AI
  const result = await aiCallFn()

  // Cache if appropriate
  if (shouldCache(systemPrompt, userMessage, result.content)) {
    await setCachedResponse(
      cacheKey,
      result.content,
      {
        prompt: result.promptTokens,
        completion: result.completionTokens,
        total: result.totalTokens,
      },
      options?.ttlHours
    )
  }

  return {
    ...result,
    cached: false,
    cacheKey,
  }
}
