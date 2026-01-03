# Scalability Roadmap - Tier 2 & Tier 3

This document outlines the remaining scalability improvements needed to scale beyond 5,000+ DAU.

---

## Tier 2 - Required for 5,000+ DAU

### 1. Redis Session Store

**Why:** Currently sessions are stored in-memory per server instance. With multiple servers, users get logged out when routed to different instances.

**Implementation:**

```bash
npm install ioredis connect-redis
```

```typescript
// src/lib/redis/session-store.ts
import Redis from 'ioredis'
import { SessionStore } from 'next-auth'

const redis = new Redis(process.env.REDIS_URL!)

export const redisSessionStore: SessionStore = {
  async get(sessionId: string) {
    const data = await redis.get(`session:${sessionId}`)
    return data ? JSON.parse(data) : null
  },

  async set(sessionId: string, session: any, maxAge?: number) {
    const ttl = maxAge || 30 * 24 * 60 * 60 // 30 days default
    await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(session))
  },

  async destroy(sessionId: string) {
    await redis.del(`session:${sessionId}`)
  }
}
```

**Environment Variables:**
```env
REDIS_URL=redis://default:password@your-redis-host:6379
```

**Estimated Time:** 2-3 hours
**Cost Impact:** +$10-50/month (Redis hosting)

---

### 2. Query Result Caching

**Why:** Frequently accessed data (user profiles, partner lists, study sessions) are fetched from database repeatedly. Caching reduces database load by 60-80%.

**Implementation:**

```typescript
// src/lib/cache/redis-cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

interface CacheOptions {
  ttl?: number // seconds
  tags?: string[] // for cache invalidation
}

export const queryCache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(`cache:${key}`)
    return data ? JSON.parse(data) : null
  },

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 300 // 5 minutes default
    await redis.setex(`cache:${key}`, ttl, JSON.stringify(value))

    // Track tags for invalidation
    if (options.tags) {
      for (const tag of options.tags) {
        await redis.sadd(`cache-tag:${tag}`, `cache:${key}`)
      }
    }
  },

  async invalidate(key: string): Promise<void> {
    await redis.del(`cache:${key}`)
  },

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await redis.smembers(`cache-tag:${tag}`)
    if (keys.length > 0) {
      await redis.del(...keys)
      await redis.del(`cache-tag:${tag}`)
    }
  }
}

// Usage example:
// const user = await queryCache.get(`user:${userId}`)
// if (!user) {
//   user = await prisma.user.findUnique({ where: { id: userId } })
//   await queryCache.set(`user:${userId}`, user, { ttl: 300, tags: ['users'] })
// }
```

**High-Priority Caches:**
| Data | TTL | Cache Key Pattern |
|------|-----|-------------------|
| User profile | 5 min | `user:{userId}` |
| Partner matches | 10 min | `partners:{userId}:{hash}` |
| Study sessions list | 2 min | `sessions:{userId}` |
| Achievements | 30 min | `achievements:{userId}` |
| Static config | 1 hour | `config:{key}` |

**Estimated Time:** 4-6 hours
**Cost Impact:** Uses same Redis instance

---

### 3. TURN Server for WebRTC

**Why:** STUN servers only work for users with direct internet access. Users behind corporate firewalls, strict NATs, or VPNs need TURN servers to relay video/audio traffic.

**Options:**

#### Option A: Self-hosted (Coturn)
```bash
# Docker deployment
docker run -d --network=host \
  -e TURN_PORT=3478 \
  -e TURN_REALM=yourdomain.com \
  -e TURN_CREDENTIALS=username:password \
  coturn/coturn
```

Configuration:
```typescript
// src/lib/webrtc/config.ts
export const iceServers = [
  // STUN servers (free)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },

  // TURN server (self-hosted)
  {
    urls: 'turn:turn.yourdomain.com:3478',
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_PASSWORD,
  },
  {
    urls: 'turns:turn.yourdomain.com:5349',
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_PASSWORD,
  },
]
```

#### Option B: Managed Service (Twilio/Daily.co)
```typescript
// Using Twilio Network Traversal Service
const twilioIceServers = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Tokens.json`,
  { method: 'POST', headers: { Authorization: `Basic ${credentials}` } }
).then(r => r.json())
```

**Estimated Time:** 4-8 hours (self-hosted) or 1-2 hours (managed)
**Cost Impact:**
- Self-hosted: $20-50/month (small VPS)
- Twilio: $0.0004/minute (~$12/month per 1000 call-minutes)

---

### 4. Increase Supabase Realtime Limits

**Why:** Default limit of 10 events/second caps real-time features at ~100-200 concurrent users.

**Implementation:**

1. **Upgrade Supabase Plan** (Pro plan: 500 events/sec, Team: 2000/sec)

2. **Optimize realtime usage:**
```typescript
// src/lib/supabase/realtime-config.ts

// Batch presence updates (don't send on every keystroke)
const PRESENCE_DEBOUNCE_MS = 2000

// Use channels efficiently
const channelConfig = {
  config: {
    broadcast: { self: false }, // Don't echo to sender
    presence: { key: userId },
  },
}

// Throttle typing indicators
const sendTypingIndicator = throttle((channelId: string) => {
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId, timestamp: Date.now() }
  })
}, 3000) // Max once per 3 seconds
```

3. **Implement message batching:**
```typescript
// Batch multiple small messages into one
const messageBatcher = {
  queue: [] as Message[],

  add(message: Message) {
    this.queue.push(message)
    this.scheduleFlush()
  },

  scheduleFlush: debounce(function() {
    if (this.queue.length > 0) {
      channel.send({
        type: 'broadcast',
        event: 'messages',
        payload: this.queue.splice(0)
      })
    }
  }, 100)
}
```

**Estimated Time:** 2-4 hours
**Cost Impact:** Supabase Pro: $25/month, Team: $599/month

---

### 5. Background Job Queue for AI Calls

**Why:** AI calls (OpenAI, partner matching) are slow (2-10 seconds). Running them synchronously blocks the request and causes timeouts. A job queue processes them asynchronously.

**Implementation with BullMQ:**

```bash
npm install bullmq
```

```typescript
// src/lib/queue/ai-queue.ts
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })

// Define queues
export const aiQueue = new Queue('ai-tasks', { connection })
export const matchingQueue = new Queue('partner-matching', { connection })

// AI Task Worker
new Worker('ai-tasks', async (job) => {
  const { type, data } = job.data

  switch (type) {
    case 'chat-completion':
      return await processAIChat(data)
    case 'progress-analysis':
      return await processProgressAnalysis(data)
    case 'engagement-prediction':
      return await processEngagementPrediction(data)
  }
}, { connection, concurrency: 5 })

// Partner Matching Worker
new Worker('partner-matching', async (job) => {
  const { userId, preferences } = job.data
  const matches = await calculatePartnerMatches(userId, preferences)

  // Store results in cache
  await queryCache.set(`partners:${userId}`, matches, { ttl: 600 })

  // Notify user via realtime
  await supabase.channel(`user:${userId}`).send({
    type: 'broadcast',
    event: 'matching-complete',
    payload: { matchCount: matches.length }
  })

  return matches
}, { connection, concurrency: 3 })

// API usage
export async function queueAITask(type: string, data: any) {
  const job = await aiQueue.add(type, { type, data }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  })
  return job.id
}
```

**API Route Update:**
```typescript
// src/app/api/partners/matching/route.ts
export async function POST(request: Request) {
  const { userId, preferences } = await request.json()

  // Check cache first
  const cached = await queryCache.get(`partners:${userId}`)
  if (cached) return Response.json(cached)

  // Queue background job
  const jobId = await matchingQueue.add('find-partners', { userId, preferences })

  // Return job ID for polling
  return Response.json({
    status: 'processing',
    jobId,
    message: 'Finding your perfect study partners...'
  })
}

// Polling endpoint
// GET /api/jobs/[jobId]/status
export async function GET(request: Request, { params }) {
  const job = await aiQueue.getJob(params.jobId)
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

  const state = await job.getState()
  const result = job.returnvalue

  return Response.json({ state, result })
}
```

**Estimated Time:** 6-8 hours
**Cost Impact:** Uses same Redis instance

---

## Tier 3 - Nice to Have (10,000+ DAU)

### 1. Database Read Replicas

**Why:** Single database becomes bottleneck at high read volumes. Read replicas distribute read queries across multiple database instances.

**Implementation with Prisma:**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Read replicas (Prisma 5.x+)
  directUrl = env("DATABASE_DIRECT_URL")
}

// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// Primary for writes
export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

// Replica for reads (optional separate client)
export const prismaRead = new PrismaClient({
  datasourceUrl: process.env.DATABASE_READ_REPLICA_URL,
})

// Usage pattern
export async function getUser(id: string) {
  return prismaRead.user.findUnique({ where: { id } }) // Read from replica
}

export async function updateUser(id: string, data: any) {
  return prisma.user.update({ where: { id }, data }) // Write to primary
}
```

**Cloud Provider Setup:**
- **Supabase:** Pro plan includes 1 read replica
- **AWS RDS:** Add read replica in console
- **PlanetScale:** Automatic read scaling

**Estimated Time:** 2-4 hours
**Cost Impact:** +$50-200/month depending on provider

---

### 2. CDN for Static Assets

**Why:** Serving images, JS bundles, and CSS from edge locations reduces latency by 50-80% for global users.

**Implementation with Vercel (Already included):**
Vercel automatically serves static assets from their edge network. No additional configuration needed.

**For Custom CDN (Cloudflare):**

1. **Setup Cloudflare:**
```
# DNS Settings
Type: CNAME
Name: cdn
Target: your-storage-bucket.s3.amazonaws.com
Proxied: Yes (orange cloud)
```

2. **Configure Next.js:**
```javascript
// next.config.js
module.exports = {
  assetPrefix: process.env.NODE_ENV === 'production'
    ? 'https://cdn.yourdomain.com'
    : '',
  images: {
    domains: ['cdn.yourdomain.com', 'your-storage-bucket.s3.amazonaws.com'],
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
}
```

3. **Image Loader:**
```typescript
// src/lib/image-loader.ts
export default function cloudflareLoader({ src, width, quality }) {
  const params = [`width=${width}`, `quality=${quality || 75}`, 'format=auto']
  return `https://cdn.yourdomain.com/cdn-cgi/image/${params.join(',')}/${src}`
}
```

**Estimated Time:** 2-4 hours
**Cost Impact:**
- Cloudflare Free: 0$ (basic CDN)
- Cloudflare Pro: $20/month (image optimization)

---

### 3. Archive Old Analytics Data

**Why:** Analytics tables (UserActivity, PageView, UserSession) grow indefinitely. After 90 days, they should be archived to cold storage to keep the primary database fast.

**Implementation:**

```typescript
// src/lib/jobs/archive-analytics.ts
import { prisma } from '@/lib/prisma'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION })
const ARCHIVE_AFTER_DAYS = 90

export async function archiveOldAnalytics() {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS)

  // 1. Export old data to JSON
  const oldPageViews = await prisma.pageView.findMany({
    where: { timestamp: { lt: cutoffDate } },
  })

  const oldUserActivity = await prisma.userActivity.findMany({
    where: { timestamp: { lt: cutoffDate } },
  })

  // 2. Upload to S3/cold storage
  const archiveDate = cutoffDate.toISOString().split('T')[0]

  await s3.send(new PutObjectCommand({
    Bucket: process.env.ARCHIVE_BUCKET,
    Key: `analytics/pageviews/${archiveDate}.json.gz`,
    Body: gzip(JSON.stringify(oldPageViews)),
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }))

  await s3.send(new PutObjectCommand({
    Bucket: process.env.ARCHIVE_BUCKET,
    Key: `analytics/user-activity/${archiveDate}.json.gz`,
    Body: gzip(JSON.stringify(oldUserActivity)),
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }))

  // 3. Delete archived data from primary database
  await prisma.$transaction([
    prisma.pageView.deleteMany({ where: { timestamp: { lt: cutoffDate } } }),
    prisma.userActivity.deleteMany({ where: { timestamp: { lt: cutoffDate } } }),
  ])

  console.log(`Archived ${oldPageViews.length} page views and ${oldUserActivity.length} activities`)
}
```

**Cron Setup (Vercel):**
```typescript
// src/app/api/cron/archive-analytics/route.ts
import { archiveOldAnalytics } from '@/lib/jobs/archive-analytics'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await archiveOldAnalytics()
  return Response.json({ success: true })
}

// vercel.json
{
  "crons": [{
    "path": "/api/cron/archive-analytics",
    "schedule": "0 3 * * 0" // Every Sunday at 3 AM
  }]
}
```

**Estimated Time:** 4-6 hours
**Cost Impact:** S3 storage ~$0.023/GB/month (very cheap for archives)

---

## Implementation Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 1 | Background Job Queue | High | 6-8h |
| 2 | Query Result Caching | High | 4-6h |
| 3 | Redis Session Store | Medium | 2-3h |
| 4 | TURN Server | Medium | 4-8h |
| 5 | Supabase Realtime Optimization | Medium | 2-4h |
| 6 | Archive Analytics | Low | 4-6h |
| 7 | Database Read Replicas | Low | 2-4h |
| 8 | CDN Setup | Low | 2-4h |

---

## Environment Variables Required

```env
# Tier 2
REDIS_URL=redis://default:password@redis-host:6379
TURN_USERNAME=your-turn-username
TURN_PASSWORD=your-turn-password
TURN_SERVER_URL=turn:turn.yourdomain.com:3478

# Tier 3
DATABASE_READ_REPLICA_URL=postgresql://user:pass@replica-host:5432/db
ARCHIVE_BUCKET=your-analytics-archive-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
CRON_SECRET=your-secure-cron-secret
```

---

## Cost Summary

| Tier | Monthly Cost | DAU Supported |
|------|-------------|---------------|
| Current | ~$50 | 500-1,000 |
| After Tier 1 | ~$100-150 | 2,000-5,000 |
| After Tier 2 | ~$200-400 | 5,000-10,000 |
| After Tier 3 | ~$400-800 | 10,000-20,000 |

---

*Document created: 2025*
*Last updated: Implement Tier 1 first, then proceed with Tier 2 as user base grows.*
