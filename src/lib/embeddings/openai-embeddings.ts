/**
 * OpenAI Embeddings Service
 *
 * Enterprise-level embedding generation with:
 * - Rate limiting to prevent API abuse
 * - Caching to reduce costs and latency
 * - Batch processing to minimize API calls
 * - Retry logic with exponential backoff
 */

import OpenAI from 'openai'

// ============================================
// Configuration
// ============================================

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

// Rate limiting: Max 3000 requests per minute for text-embedding-3-small
// We'll use a conservative limit of 100 requests per minute per user
const MAX_REQUESTS_PER_MINUTE = 100
const RATE_LIMIT_WINDOW_MS = 60 * 1000

// Batch processing: Max 2048 texts per batch
const MAX_BATCH_SIZE = 100

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

// ============================================
// Types
// ============================================

export interface EmbeddingResult {
  embedding: number[]
  tokensUsed: number
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  totalTokensUsed: number
}

interface RateLimitState {
  count: number
  windowStart: number
}

// ============================================
// OpenAI Client (Singleton)
// ============================================

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// ============================================
// In-Memory Rate Limiter
// ============================================

const rateLimitMap = new Map<string, RateLimitState>()

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const state = rateLimitMap.get(key)

  if (!state) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return { allowed: true }
  }

  // Reset window if expired
  if (now - state.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return { allowed: true }
  }

  // Check if under limit
  if (state.count < MAX_REQUESTS_PER_MINUTE) {
    state.count++
    return { allowed: true }
  }

  // Rate limited
  const retryAfter = Math.ceil((state.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
  return { allowed: false, retryAfter }
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, state] of rateLimitMap.entries()) {
    if (now - state.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW_MS)

// ============================================
// In-Memory Embedding Cache
// ============================================

interface CacheEntry {
  embedding: number[]
  expiresAt: number
}

const embeddingCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCacheKey(text: string): string {
  // Simple hash for cache key (production should use crypto)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `emb:${hash}:${text.length}`
}

function getFromCache(text: string): number[] | null {
  const key = getCacheKey(text)
  const entry = embeddingCache.get(key)

  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    embeddingCache.delete(key)
    return null
  }

  return entry.embedding
}

function setCache(text: string, embedding: number[]): void {
  // Limit cache size to prevent memory issues
  if (embeddingCache.size > 10000) {
    // Remove oldest entries (first 1000)
    const keysToDelete = Array.from(embeddingCache.keys()).slice(0, 1000)
    keysToDelete.forEach(key => embeddingCache.delete(key))
  }

  const key = getCacheKey(text)
  embeddingCache.set(key, {
    embedding,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

// ============================================
// Core Embedding Functions
// ============================================

/**
 * Generate embedding for a single text with retry logic
 */
async function generateEmbeddingWithRetry(
  text: string,
  retryCount = 0
): Promise<EmbeddingResult> {
  const client = getOpenAIClient()

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage.total_tokens,
    }
  } catch (error) {
    // Retry on rate limit or server errors
    if (retryCount < MAX_RETRIES) {
      const isRateLimitError = error instanceof OpenAI.RateLimitError
      const isServerError = error instanceof OpenAI.InternalServerError

      if (isRateLimitError || isServerError) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return generateEmbeddingWithRetry(text, retryCount + 1)
      }
    }

    throw error
  }
}

/**
 * Generate embedding for a single text
 * Includes rate limiting and caching
 */
export async function generateEmbedding(
  text: string,
  rateLimitKey = 'global'
): Promise<EmbeddingResult> {
  // Normalize text
  const normalizedText = normalizeText(text)

  if (!normalizedText) {
    throw new Error('Empty text provided for embedding generation')
  }

  // Check cache first
  const cached = getFromCache(normalizedText)
  if (cached) {
    return { embedding: cached, tokensUsed: 0 }
  }

  // Check rate limit
  const { allowed, retryAfter } = checkRateLimit(rateLimitKey)
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`)
  }

  // Generate embedding
  const result = await generateEmbeddingWithRetry(normalizedText)

  // Cache the result
  setCache(normalizedText, result.embedding)

  return result
}

/**
 * Generate embeddings for multiple texts in a batch
 * More efficient than individual calls
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  rateLimitKey = 'global'
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], totalTokensUsed: 0 }
  }

  // Normalize and deduplicate texts
  const normalizedTexts = texts.map(normalizeText).filter(Boolean)
  const uniqueTexts = [...new Set(normalizedTexts)]

  // Check cache for each text
  const uncachedTexts: string[] = []
  const cachedResults = new Map<string, number[]>()

  for (const text of uniqueTexts) {
    const cached = getFromCache(text)
    if (cached) {
      cachedResults.set(text, cached)
    } else {
      uncachedTexts.push(text)
    }
  }

  // Generate embeddings for uncached texts in batches
  const newEmbeddings = new Map<string, number[]>()
  let totalTokensUsed = 0

  for (let i = 0; i < uncachedTexts.length; i += MAX_BATCH_SIZE) {
    const batch = uncachedTexts.slice(i, i + MAX_BATCH_SIZE)

    // Check rate limit for each batch
    const { allowed, retryAfter } = checkRateLimit(rateLimitKey)
    if (!allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`)
    }

    const client = getOpenAIClient()

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      })

      // Map results back to texts
      for (let j = 0; j < batch.length; j++) {
        const embedding = response.data[j].embedding
        newEmbeddings.set(batch[j], embedding)
        setCache(batch[j], embedding)
      }

      totalTokensUsed += response.usage.total_tokens
    } catch (error) {
      // On error, try individual requests for this batch
      for (const text of batch) {
        try {
          const result = await generateEmbedding(text, rateLimitKey)
          newEmbeddings.set(text, result.embedding)
          totalTokensUsed += result.tokensUsed
        } catch (individualError) {
          console.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`, individualError)
        }
      }
    }
  }

  // Combine cached and new embeddings in original order
  const embeddings: number[][] = normalizedTexts.map(text => {
    return cachedResults.get(text) || newEmbeddings.get(text) || []
  }).filter(e => e.length > 0)

  return { embeddings, totalTokensUsed }
}

// ============================================
// Text Normalization
// ============================================

/**
 * Normalize text for embedding generation
 * Removes extra whitespace, lowercases, etc.
 */
export function normalizeText(text: string): string {
  if (!text) return ''

  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000) // OpenAI limit is ~8k tokens
}

/**
 * Build a searchable text from profile fields
 * Combines all relevant fields for embedding
 */
export function buildProfileSearchText(profile: {
  bio?: string | null
  subjects?: string[]
  interests?: string[]
  goals?: string[]
  skillLevel?: string | null
  studyStyle?: string | null
  subjectCustomDescription?: string | null
  skillLevelCustomDescription?: string | null
  studyStyleCustomDescription?: string | null
  interestsCustomDescription?: string | null
  aboutYourself?: string | null
}): string {
  const parts: string[] = []

  if (profile.bio) parts.push(profile.bio)
  if (profile.subjects?.length) parts.push(`subjects: ${profile.subjects.join(', ')}`)
  if (profile.interests?.length) parts.push(`interests: ${profile.interests.join(', ')}`)
  if (profile.goals?.length) parts.push(`goals: ${profile.goals.join(', ')}`)
  if (profile.skillLevel) parts.push(`skill level: ${profile.skillLevel}`)
  if (profile.studyStyle) parts.push(`study style: ${profile.studyStyle}`)
  if (profile.subjectCustomDescription) parts.push(profile.subjectCustomDescription)
  if (profile.skillLevelCustomDescription) parts.push(profile.skillLevelCustomDescription)
  if (profile.studyStyleCustomDescription) parts.push(profile.studyStyleCustomDescription)
  if (profile.interestsCustomDescription) parts.push(profile.interestsCustomDescription)
  if (profile.aboutYourself) parts.push(profile.aboutYourself)

  return parts.join(' ').trim()
}

/**
 * Build a searchable text from group fields
 */
export function buildGroupSearchText(group: {
  name: string
  description?: string | null
  subject: string
  subjectCustomDescription?: string | null
  skillLevel?: string | null
  skillLevelCustomDescription?: string | null
}): string {
  const parts: string[] = []

  parts.push(group.name)
  if (group.description) parts.push(group.description)
  parts.push(`subject: ${group.subject}`)
  if (group.subjectCustomDescription) parts.push(group.subjectCustomDescription)
  if (group.skillLevel) parts.push(`skill level: ${group.skillLevel}`)
  if (group.skillLevelCustomDescription) parts.push(group.skillLevelCustomDescription)

  return parts.join(' ').trim()
}

// ============================================
// Similarity Calculation
// ============================================

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between 0 and 1 (1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ============================================
// Export Constants
// ============================================

export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  maxBatchSize: MAX_BATCH_SIZE,
  maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
  cacheTtlMs: CACHE_TTL_MS,
}
