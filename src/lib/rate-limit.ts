import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limit AI calls: 10 per minute per user
export const aiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'adecis:ai',
})

// Rate limit Slack events: 30 per minute per team
export const slackEventRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: 'adecis:slack',
})

// Rate limit email inbound: 20 per minute per user
export const emailRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '60 s'),
  prefix: 'adecis:email',
})

// Rate limit dashboard reads: 60 per minute per user (prevents refresh-spam and scraping)
export const readRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  prefix: 'adecis:read',
})

// Deduplication: prevent processing the same event twice
// Falls back to allowing the event if Redis is down (better to process twice than drop leads)
export async function isDuplicate(eventId: string): Promise<boolean> {
  try {
    const key = `adecis:dedup:${eventId}`
    const result = await redis.set(key, '1', { nx: true, ex: 86400 }) // 24h TTL
    return result === null // null = key already existed
  } catch (err) {
    console.error('Redis dedup check failed, allowing event:', err)
    return false
  }
}

// Email deduplication: hash of sender + subject + body prefix to prevent duplicates on SendGrid retries
export async function isDuplicateEmail(from: string, subject: string, bodyPrefix: string): Promise<boolean> {
  try {
    const raw = `${from}|${subject}|${bodyPrefix.substring(0, 200)}`
    // Simple hash using charCode sum — not cryptographic, just unique enough for dedup
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
    }
    const key = `adecis:email-dedup:${hash}`
    const result = await redis.set(key, '1', { nx: true, ex: 60 }) // 60s TTL — just enough to catch SendGrid retries
    return result === null // null = key already existed
  } catch (err) {
    console.error('Redis email dedup check failed, allowing email:', err)
    return false
  }
}

// Safe rate limit wrapper — if Redis is down, allow the request through
export async function safeRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean }> {
  try {
    return await limiter.limit(identifier)
  } catch (err) {
    console.error('Redis rate limit failed, allowing request:', err)
    return { success: true }
  }
}
