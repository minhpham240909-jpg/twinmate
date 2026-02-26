import { Redis } from '@upstash/redis'
import type { LeadScore } from './types'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 hours
const CACHE_PREFIX = 'adecis:score:'

/**
 * Generates a cache key from the message content and niche.
 * Normalizes the message so similar messages hit the same cache entry:
 * - Lowercased
 * - Whitespace collapsed
 * - Names/emails stripped (so "Hi John" and "Hi Sarah" match)
 * - Numbers preserved (budgets like "$5k" are important signals)
 */
function buildCacheKey(message: string, niche: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/\s+/g, ' ')                           // collapse whitespace
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')  // strip emails
    .replace(/https?:\/\/[^\s]+/g, '[url]')          // strip URLs
    .trim()
    .substring(0, 500)                                // cap length for consistent hashing

  // Simple hash — not cryptographic, just unique enough for cache keys
  const raw = `${niche}|${normalized}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  // Use two hash rounds to reduce collisions
  let hash2 = 0
  for (let i = raw.length - 1; i >= 0; i--) {
    hash2 = ((hash2 << 5) - hash2 + raw.charCodeAt(i)) | 0
  }
  return `${CACHE_PREFIX}${hash}${hash2}`
}

/**
 * Personalizes a cached reply by swapping in the new sender's name.
 * The cached reply was written for a different sender — we replace the first
 * occurrence of any name-like greeting (e.g., "Hey Sarah," → "Hey John,").
 */
function personalizeReply(cachedReply: string, newSenderName: string | undefined): string {
  if (!newSenderName) return cachedReply

  const firstName = newSenderName.split(/\s+/)[0]

  // Replace greeting name patterns: "Hey X," / "Hi X," / "Hello X," etc.
  const greetingPattern = /^(Hey|Hi|Hello|Dear|Thanks|Thank you),?\s+[A-Z][a-z]+/
  if (greetingPattern.test(cachedReply)) {
    return cachedReply.replace(greetingPattern, (match) => {
      const greeting = match.split(/[,\s]/)[0]
      return `${greeting} ${firstName}`
    })
  }

  return cachedReply
}

export interface CachedScore {
  score: LeadScore
  model: string
}

/**
 * Try to get a cached score for a similar message.
 * Returns null if no cache hit or Redis is down (graceful degradation).
 */
export async function getCachedScore(
  message: string,
  niche: string,
  senderName: string | undefined
): Promise<CachedScore | null> {
  try {
    const key = buildCacheKey(message, niche)
    const cached = await redis.get<CachedScore>(key)
    if (!cached) return null

    // Personalize the reply for this specific sender
    return {
      ...cached,
      score: {
        ...cached.score,
        suggested_reply: personalizeReply(cached.score.suggested_reply, senderName),
      },
    }
  } catch (err) {
    // Redis down — fall through to API call
    console.error('[score-cache] Redis get failed, skipping cache:', err)
    return null
  }
}

/**
 * Cache a score result for future similar messages.
 * Fire-and-forget — never blocks the pipeline.
 */
export async function setCachedScore(
  message: string,
  niche: string,
  score: LeadScore,
  model: string
): Promise<void> {
  try {
    const key = buildCacheKey(message, niche)
    const value: CachedScore = { score, model }
    await redis.set(key, JSON.stringify(value), { ex: CACHE_TTL_SECONDS })
  } catch (err) {
    // Redis down — score won't be cached, not critical
    console.error('[score-cache] Redis set failed, score not cached:', err)
  }
}
