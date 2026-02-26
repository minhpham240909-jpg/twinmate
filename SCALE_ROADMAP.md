# Adecis — Scale & Production Readiness Roadmap

> Last updated: 2026-02-23
> Status: App is production-ready for early users (100–200 active users, up to 10k leads).
> This document tracks what needs to be done before scaling to thousands of users and hundreds of thousands of leads.

---

## Table of Contents

1. [What Works Well Today](#1-what-works-well-today)
2. [Critical Issues](#2-critical-issues)
3. [Priority Fix List](#3-priority-fix-list)
4. [Detailed Fix Guides](#4-detailed-fix-guides)
5. [Scale Projections](#5-scale-projections)
6. [Database Improvements](#6-database-improvements)
7. [API Hardening](#7-api-hardening)
8. [Frontend Resilience](#8-frontend-resilience)
9. [Monitoring & Observability](#9-monitoring--observability)
10. [Cost Control](#10-cost-control)

---

## 1. What Works Well Today

These are solid foundations — no changes needed:

| Area | What's Good |
|------|-------------|
| **User isolation** | RLS (Row-Level Security) policies on every table ensure users can never access each other's data |
| **Auth** | Every API route checks `auth.getUser()` before processing — no unprotected endpoints |
| **Input validation** | UUID format checking, enum validation for labels/sources, URL validation for booking links |
| **SQL injection protection** | PostgREST special characters escaped in search queries |
| **Graceful degradation** | Dashboard loads even if `activity_log` table doesn't exist yet — try/catch with fallback |
| **Soft deletes** | Leads use `deleted_at` timestamp instead of hard deletes — restorable for 30 days |
| **Atomic counters** | `increment_leads_used` and `increment_replies_used` use SQL-level atomicity — safe for concurrent calls |
| **Rate limiting** | Upstash Redis-based sliding window rate limits on AI scoring, Slack events, and email ingestion |
| **Security headers** | HSTS, X-Frame-Options, Permissions-Policy configured in middleware |
| **Slack verification** | Timing-safe HMAC signature verification on all Slack webhook events |
| **Connection pooling** | Supabase pgbouncer connection pooler configured |

---

## 2. Critical Issues

### Issue 1: Realtime N+1 Problem

**Where:** `src/app/dashboard/leads-client.tsx` (lines 110–202)

**Problem:** The Supabase realtime subscription fires on every INSERT/UPDATE/DELETE event for the user's leads. Each event triggers a debounced refetch (300ms). If 100 leads arrive in 1 second, the debounce timer resets 100 times but still fires a full page refetch at the end — and this happens for every connected user simultaneously.

**Impact at scale:**
- 100 leads/sec × 1000 connected users = up to 1000 simultaneous refetch queries
- Each refetch runs a paginated query with filters — database connection pool exhausted
- Dashboard becomes unresponsive for all users

**Current code:**
```typescript
const debouncedRefetch = (timerRef: 'insert' | 'delete') => {
  if (timerRef === 'insert') {
    if (insertDebounceTimer) clearTimeout(insertDebounceTimer)
    insertDebounceTimer = setTimeout(() => {
      fetchLeads(pageRef.current, sourceFilterRef.current, ...)
    }, 300)  // 300ms — too aggressive
  }
}
```

---

### Issue 2: Search Won't Scale

**Where:** `src/app/api/leads/route.ts` (lines 124–127)

**Problem:** Text search uses `ILIKE` which performs a full sequential scan on `raw_message` and `sender_name` columns. No full-text search index exists.

**Impact at scale:**
- 10k leads: ~500ms per search (acceptable)
- 100k leads: ~5–10 seconds per search (bad UX)
- 500k leads: ~30+ seconds, likely times out

**Current code:**
```typescript
const safeSearch = search.replace(/[%_\\,().]/g, (c) => `\\${c}`)
query = query.or(`sender_name.ilike.%${safeSearch}%,raw_message.ilike.%${safeSearch}%`)
```

---

### Issue 3: Lead Quota Race Condition

**Where:** `src/app/api/slack/events/route.ts` (lines 132–142) and `src/app/api/email/inbound/route.ts`

**Problem:** The quota check (`canProcessLead`) and the quota increment (`increment_leads_used`) are separate operations. Two simultaneous requests can both pass the check before either increments.

**Example:**
1. Slack message A arrives → `canProcessLead` checks: 24/25 used → allowed
2. Slack message B arrives → `canProcessLead` checks: 24/25 used → allowed (before A incremented)
3. Both insert leads → 26/25 used (exceeds plan limit)

**Current code:**
```typescript
const { allowed, reason } = await canProcessLead(userId)
if (!allowed) return  // Both pass this check
// ... insert lead ...
await supabase.rpc('increment_leads_used', { p_user_id: userId })  // Incremented too late
```

---

### Issue 4: Pagination Gets Slow

**Where:** `src/app/api/leads/route.ts` (lines 99–105)

**Problem:** Uses offset-based pagination (`.range((page-1)*20, page*20-1)`). PostgreSQL must scan and discard all rows before the offset. At high page counts with large tables, this becomes very slow.

**Impact at scale:**
- Page 1 of 500k leads: fast (scan 20 rows)
- Page 100: scan 2000 rows, discard 1980 — still okay
- Page 1000: scan 20,000 rows — noticeable lag
- Page 10,000: scan 200,000 rows — 5–10 second query

**Current code:**
```typescript
const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
// No upper limit on page number
.range((page - 1) * limit, page * limit - 1)
```

---

### Issue 5: No Real Monitoring

**Where:** `src/app/api/health/route.ts`

**Problem:** Health check returns `{status: "ok"}` without verifying database connectivity, Redis availability, or external service health. No error tracking (Sentry), no APM, no metrics.

**Impact:** Problems are invisible until users report them. No way to detect:
- Database connection pool exhaustion
- Redis rate limiter failures
- Anthropic API outages
- SendGrid delivery failures
- Slow query patterns

---

### Issue 6: No Error Boundary

**Where:** `src/app/dashboard/leads-client.tsx` (entire component)

**Problem:** The 1300+ line client component has no React error boundary. If any hook throws (realtime subscription error, malformed API response, etc.), the entire dashboard crashes to a white screen.

---

### Issue 7: No Retry Logic for External Services

**Where:** Multiple API routes

**Problem:** Calls to SendGrid, Slack API, and Anthropic have no retry logic. If any service returns a transient 503/timeout:
- Email replies are lost (marked as sent in DB, but never delivered)
- Slack thread replies fail silently
- AI scoring fails and lead gets no score

**Affected files:**
- `src/app/api/leads/[id]/send-reply/route.ts` — SendGrid / Slack reply
- `src/app/api/slack/events/route.ts` — Anthropic AI scoring
- `src/app/api/email/inbound/route.ts` — Anthropic AI scoring
- `src/app/api/cron/daily-digest/route.ts` — SendGrid digest emails

---

### Issue 8: Activity Log Events Can Be Lost

**Where:** `src/lib/activity.ts`

**Problem:** Activity logging is fire-and-forget with no retry queue. If the database is slow or connection pool is full, activity events are silently dropped.

```typescript
export async function logActivity(params): Promise<void> {
  try {
    await supabase.from('activity_log').insert(...)
  } catch (err) {
    console.error('[activity] Failed to log activity:', err)
    // Lost forever
  }
}
```

---

### Issue 9: Missing Database Indexes for Scale

**Where:** `supabase/migrations/`

**Missing indexes that will cause full table scans at scale:**
- `activity_log(user_id, created_at DESC)` — dashboard and cron digest queries
- `activity_log(lead_id)` — orphan cleanup queries
- `leads(user_id, created_at DESC, id DESC)` — pagination tiebreaker
- Full-text search index on `leads(sender_name, raw_message)`

---

### Issue 10: Cron Jobs Not Fault-Tolerant

**Where:** `src/app/api/cron/daily-digest/route.ts`

**Problem:** The daily digest cron iterates over all users in a single loop. If sending email fails for one user, the entire cron job may halt — remaining users don't get their digest.

---

## 3. Priority Fix List

| Priority | Fix | Why | Effort |
|----------|-----|-----|--------|
| **P0** | Increase realtime debounce to 2–5 sec | Prevents DB connection pool exhaustion under load | 5 min |
| **P0** | Add React error boundary | Single error shouldn't crash the whole dashboard | 30 min |
| **P1** | Fix quota enforcement with SQL transaction | Prevents users exceeding plan limits | 1–2 hours |
| **P1** | Add retry logic for SendGrid/Slack/Anthropic | Transient failures currently lose replies and scores | 2–3 hours |
| **P1** | Add real health checks + monitoring (Sentry) | Can't fix what you can't see | 2–3 hours |
| **P2** | Add Postgres full-text search | ILIKE won't scale past 10k leads | 2–3 hours |
| **P2** | Switch to cursor-based pagination | Offset pagination degrades at high page counts | 2–3 hours |
| **P2** | Add missing database indexes | Prevent full table scans on common queries | 1 hour |
| **P2** | Make cron jobs fault-tolerant | One failed email shouldn't stop all digests | 1 hour |
| **P3** | Queue activity log events | Prevent event loss under high load | 2–3 hours |
| **P3** | Add rate limiting on read endpoints | Prevent API abuse / scraping | 1 hour |
| **P3** | Add request size limits | Prevent memory exhaustion from large payloads | 30 min |
| **P3** | Split leads-client.tsx into sub-components | Improve render performance and maintainability | 3–4 hours |

---

## 4. Detailed Fix Guides

### Fix 1: Increase Realtime Debounce (P0 — 5 min)

**File:** `src/app/dashboard/leads-client.tsx`

Change the debounce timer from 300ms to 2000ms (2 seconds):

```typescript
// BEFORE
insertDebounceTimer = setTimeout(() => {
  fetchLeads(...)
  insertDebounceTimer = null
}, 300)

// AFTER
insertDebounceTimer = setTimeout(() => {
  fetchLeads(...)
  insertDebounceTimer = null
}, 2000)  // 2 seconds — prevents connection pool exhaustion
```

Apply to both `insertDebounceTimer` and `deleteDebounceTimer`.

**Why 2 seconds:** Leads don't need to appear instantly. A 2-second delay is imperceptible to users but reduces refetch rate by 6.7x under burst traffic.

---

### Fix 2: Add React Error Boundary (P0 — 30 min)

**Create:** `src/app/dashboard/error-boundary.tsx`

```tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[dashboard] Unhandled error:', error)
    // TODO: Send to Sentry when monitoring is added
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-16 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            The dashboard encountered an error. Your data is safe.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Wrap in:** `src/app/dashboard/layout.tsx` or around `<LeadsClient>` in `page.tsx`.

---

### Fix 3: Fix Quota Enforcement (P1 — 1–2 hours)

**Option A: SQL Function with SELECT FOR UPDATE**

Create a new migration:

```sql
CREATE OR REPLACE FUNCTION try_use_lead(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Lock the row to prevent concurrent reads
  SELECT leads_used, lead_limit INTO v_used, v_limit
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles SET leads_used = leads_used + 1 WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

**Replace in API routes:**
```typescript
// BEFORE
const { allowed } = await canProcessLead(userId)
if (!allowed) return
// ... insert lead ...
await supabase.rpc('increment_leads_used', { p_user_id: userId })

// AFTER
const { data: allowed } = await supabase.rpc('try_use_lead', { p_user_id: userId })
if (!allowed) return
// ... insert lead ...
// No separate increment needed — already done atomically
```

---

### Fix 4: Add Retry Logic (P1 — 2–3 hours)

**Create:** `src/lib/retry.ts`

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = 'operation' } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err
      const delay = baseDelayMs * Math.pow(2, attempt - 1) // 500, 1000, 2000
      console.warn(`[retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}
```

**Apply to:**
- `sendEmailReply()` in `send-reply/route.ts`
- `scoreLead()` in `slack/events/route.ts` and `email/inbound/route.ts`
- `sgMail.send()` in `cron/daily-digest/route.ts`

```typescript
// BEFORE
await sgMail.send(msg)

// AFTER
await withRetry(() => sgMail.send(msg), { label: 'sendgrid-digest', maxAttempts: 3 })
```

---

### Fix 5: Add Health Checks + Monitoring (P1 — 2–3 hours)

**Update:** `src/app/api/health/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {}

  // Database check
  const dbStart = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').select('id').limit(1)
    checks.database = { ok: !error, latencyMs: Date.now() - dbStart }
    if (error) checks.database.error = error.message
  } catch (err) {
    checks.database = { ok: false, latencyMs: Date.now() - dbStart, error: String(err) }
  }

  // Redis check (if Upstash configured)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redisStart = Date.now()
    try {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      })
      checks.redis = { ok: res.ok, latencyMs: Date.now() - redisStart }
    } catch (err) {
      checks.redis = { ok: false, latencyMs: Date.now() - redisStart, error: String(err) }
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return Response.json(
    { status: allOk ? 'healthy' : 'degraded', checks, time: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  )
}
```

**Add Sentry:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Configure in `sentry.client.config.ts` and `sentry.server.config.ts` to capture unhandled errors automatically.

---

### Fix 6: Add Postgres Full-Text Search (P2 — 2–3 hours)

**Create migration:**

```sql
-- Add tsvector column for full-text search
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE leads SET search_vector =
  to_tsvector('english', coalesce(sender_name, '') || ' ' || coalesce(raw_message, ''));

-- Create GIN index for fast search
CREATE INDEX IF NOT EXISTS idx_leads_search_vector ON leads USING GIN (search_vector);

-- Auto-update on INSERT/UPDATE
CREATE OR REPLACE FUNCTION leads_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.sender_name, '') || ' ' || coalesce(NEW.raw_message, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_search
  BEFORE INSERT OR UPDATE OF sender_name, raw_message ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_search_trigger();
```

**Update API route:**
```typescript
// BEFORE
query = query.or(`sender_name.ilike.%${safeSearch}%,raw_message.ilike.%${safeSearch}%`)

// AFTER
query = query.textSearch('search_vector', search, { type: 'websearch' })
```

**Performance:**
- ILIKE on 500k rows: 10–30 seconds
- Full-text search with GIN index on 500k rows: 5–50ms

---

### Fix 7: Switch to Cursor-Based Pagination (P2 — 2–3 hours)

**Concept:** Instead of `page=5` (skip 80 rows), use `after=<last_lead_id>&after_created=<timestamp>` which can use an index directly.

**API change:**
```typescript
// BEFORE
const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
.range((page - 1) * limit, page * limit - 1)

// AFTER
const cursor = searchParams.get('cursor')  // ID of last lead on previous page
const cursorDate = searchParams.get('cursor_date')  // created_at of last lead

let query = supabase
  .from('leads')
  .select(selectCols, { count: 'exact' })
  .eq('user_id', user.id)
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })  // Tiebreaker
  .limit(limit)

if (cursor && cursorDate) {
  query = query.or(`created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursor})`)
}
```

**Frontend change:** Track `lastLeadId` and `lastCreatedAt` instead of page number.

**Note:** Keep offset pagination as fallback for "jump to page X" if needed. Cursor is for next/previous navigation.

---

### Fix 8: Add Missing Database Indexes (P2 — 1 hour)

**Create migration:**

```sql
-- Activity log queries (dashboard + cron digest)
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON activity_log(user_id, created_at DESC);

-- Activity log lead reference (orphan cleanup)
CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id
  ON activity_log(lead_id) WHERE lead_id IS NOT NULL;

-- Leads pagination tiebreaker (prevents duplicate rows across pages)
CREATE INDEX IF NOT EXISTS idx_leads_user_created_id
  ON leads(user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Push subscriptions lookup (cron push notifications)
CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON push_subscriptions(user_id);
```

---

### Fix 9: Make Cron Jobs Fault-Tolerant (P2 — 1 hour)

**File:** `src/app/api/cron/daily-digest/route.ts`

```typescript
// BEFORE
for (const user of users) {
  // If one fails, loop may break
  const lines: string[] = []
  // ... build email ...
  await sgMail.send(msg)
}

// AFTER
const results = []
for (const user of users) {
  try {
    const lines: string[] = []
    // ... build email ...
    await withRetry(() => sgMail.send(msg), { label: `digest-${user.id}`, maxAttempts: 2 })
    results.push({ userId: user.id, status: 'sent' })
  } catch (err) {
    console.error(`[digest] Failed for user ${user.id}:`, err)
    results.push({ userId: user.id, status: 'failed', error: String(err) })
    // Continue to next user — don't break the loop
  }
}

return NextResponse.json({
  ok: true,
  sent: results.filter(r => r.status === 'sent').length,
  failed: results.filter(r => r.status === 'failed').length,
})
```

---

### Fix 10: Queue Activity Log Events (P3 — 2–3 hours)

**Option A: Upstash Queue (recommended if already using Upstash)**

```typescript
// lib/activity.ts
import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

export async function logActivity(params: ActivityParams): Promise<void> {
  // Queue instead of direct insert — guaranteed delivery
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/log-activity`,
    body: params,
    retries: 3,
  })
}
```

**Option B: Simpler — just add retry in current function**

```typescript
export async function logActivity(params: ActivityParams): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await supabase.from('activity_log').insert({ ... })
      return
    } catch (err) {
      if (attempt === 3) console.error('[activity] Failed after 3 attempts:', err)
      else await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
}
```

---

### Fix 11: Add Rate Limiting on Read Endpoints (P3 — 1 hour)

**File:** `src/app/api/leads/route.ts`

```typescript
import { readRateLimit, safeRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  // ... auth check ...

  // Rate limit reads: 120 requests per minute per user
  const { success } = await safeRateLimit(readRateLimit, user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // ... rest of handler
}
```

**Add to `lib/rate-limit.ts`:**
```typescript
export const readRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(120, '60 s'),
  prefix: 'rl:read',
})
```

---

### Fix 12: Add Request Size Limits (P3 — 30 min)

**File:** `next.config.ts`

```typescript
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
}
```

**Also validate in DELETE endpoint:**
```typescript
// api/leads/route.ts DELETE handler
const { ids } = body
if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
  return NextResponse.json({ error: 'Provide 1-100 lead IDs' }, { status: 400 })
}
// Already exists — good. Just make sure all endpoints have similar checks.
```

---

## 5. Scale Projections

| Metric | Now (works) | After P0–P1 fixes | After all fixes |
|--------|-------------|--------------------|--------------------|
| **Active users** | 100–200 | 500–1,000 | 5,000–10,000 |
| **Total leads in DB** | Up to 10k | Up to 50k | 500k+ |
| **Leads ingested/min** | 30 | 30 (with fewer DB hits) | 100+ |
| **Search latency** | <1s (10k rows) | <1s (10k rows) | <50ms (500k rows with FTS) |
| **Dashboard load time** | <1s | <1s | <1s (cursor pagination) |
| **Concurrent dashboard users** | 50–100 | 200–500 | 1,000+ |
| **Error visibility** | None (console.error only) | Sentry alerts + health checks | Full APM dashboard |
| **Downtime detection** | Users report it | Automated health check alerts | <1 min detection |

---

## 6. Database Improvements

### Current Indexes (already exist)
```
idx_leads_user_created        ON leads(user_id, created_at DESC)
idx_leads_user_intent         ON leads(user_id, intent_label)
idx_leads_user_source         ON leads(user_id, source)
idx_leads_user_dismissed      ON leads(user_id, dismissed, created_at DESC)
idx_leads_user_deleted_at     ON leads(user_id, deleted_at)
idx_profiles_subscription     ON profiles(subscription_status)
```

### Indexes to Add
```
idx_activity_log_user_created ON activity_log(user_id, created_at DESC)
idx_activity_log_lead_id      ON activity_log(lead_id) WHERE lead_id IS NOT NULL
idx_leads_user_created_id     ON leads(user_id, created_at DESC, id DESC) WHERE deleted_at IS NULL
idx_push_subs_user            ON push_subscriptions(user_id)
idx_leads_search_vector       ON leads USING GIN (search_vector)  -- full-text search
```

### Schema Changes Needed
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector tsvector;
-- Plus trigger to auto-populate (see Fix 6 above)
```

---

## 7. API Hardening

### Endpoints and their current protection status

| Endpoint | Auth | Rate Limit | Input Validation | Retry Logic |
|----------|------|-----------|------------------|-------------|
| `GET /api/leads` | Yes | **No** | Yes | N/A |
| `DELETE /api/leads` | Yes | **No** | Yes (1–100 IDs) | N/A |
| `POST /api/leads/:id/send-reply` | Yes | Yes (reply quota) | Yes | **No** |
| `POST /api/leads/:id/feedback` | Yes | **No** | Yes | N/A |
| `PATCH /api/leads/:id/dismiss` | Yes | **No** | Yes | N/A |
| `POST /api/settings` | Yes | **No** | Yes | N/A |
| `POST /api/slack/events` | Yes (signature) | Yes | Yes | **No** |
| `POST /api/email/inbound` | Yes (auth header) | Yes | Yes | **No** |
| `GET /api/cron/daily-digest` | Yes (bearer) | N/A | N/A | **No** |
| `GET /api/health` | No (public) | **No** | N/A | N/A |

**Cells marked "No" need fixing** — see Priority Fix List above.

---

## 8. Frontend Resilience

### Current State
- **leads-client.tsx:** 1300+ lines, single monolithic component
- **No error boundary:** One error crashes entire dashboard
- **No loading skeletons:** User can't tell "loading" from "empty"
- **No optimistic updates:** Must wait for API response before UI updates
- **No memoization:** Every state change re-renders entire component tree

### Recommended Splits (P3 — do when refactoring)
```
leads-client.tsx (1300 lines) →
  ├── components/leads-list.tsx        (lead cards + pagination)
  ├── components/leads-filters.tsx     (source, label, search filters)
  ├── components/lead-detail-modal.tsx (full lead view + reply)
  ├── components/activity-feed.tsx     (activity tab)
  ├── components/trash-view.tsx        (trash tab)
  ├── components/stats-bar.tsx         (today's stats)
  └── hooks/use-leads-realtime.ts      (realtime subscription)
```

---

## 9. Monitoring & Observability

### What to Monitor

| Metric | Alert Threshold | Tool |
|--------|-----------------|------|
| API error rate (5xx) | > 1% over 5 min | Sentry |
| API latency p95 | > 2 seconds | Vercel Analytics / DataDog |
| Database connection pool usage | > 80% | Supabase Dashboard |
| Realtime connections | > 500 concurrent | Supabase Dashboard |
| AI scoring latency | > 10 seconds | Custom logging |
| SendGrid delivery rate | < 95% | SendGrid Dashboard |
| Lead ingestion rate | Sudden drop to 0 | Custom health check |
| Cron job success rate | Any failure | Vercel Cron logs |
| Redis availability | Any timeout | Upstash Dashboard |

### Recommended Stack
1. **Sentry** — Error tracking (free tier: 5k events/month)
2. **Vercel Analytics** — Web vitals + API latency (included with Vercel)
3. **Upstash Dashboard** — Redis monitoring (included)
4. **Supabase Dashboard** — DB metrics, realtime connections, RLS audit (included)
5. **Better Uptime or Checkly** — External health check pinging `/api/health` every 1 min

---

## 10. Cost Control

### Current Costs Per User (estimated)

| Service | Cost per 1k leads | Notes |
|---------|-------------------|-------|
| Anthropic (Claude) | ~$0.50–$1.50 | ~500 tokens input + 300 output per lead |
| SendGrid | ~$0.00 | Free tier: 100 emails/day |
| Supabase | ~$0.00 | Free tier: 500MB, 50k rows, 500 realtime connections |
| Vercel | ~$0.00 | Free tier: 100GB bandwidth |
| Upstash Redis | ~$0.00 | Free tier: 10k commands/day |

### Cost Breakpoints (when free tiers run out)

| Users | Total Leads/mo | Anthropic | Supabase | Vercel | Total |
|-------|---------------|-----------|----------|--------|-------|
| 100 | 5k | ~$5 | Free | Free | ~$5/mo |
| 500 | 25k | ~$25 | $25/mo (Pro) | Free | ~$50/mo |
| 1,000 | 50k | ~$50 | $25/mo | $20/mo (Pro) | ~$95/mo |
| 5,000 | 250k | ~$250 | $25/mo | $20/mo | ~$295/mo |
| 10,000 | 500k | ~$500 | $75/mo (scale) | $20/mo | ~$595/mo |

### Cost Optimization Ideas (implement at scale)
- Cache AI scores for duplicate messages (same sender + similar content)
- Use Claude Haiku for low-value scoring, Claude Sonnet only for high-intent rescoring
- Batch digest emails instead of individual sends
- Implement read replicas for dashboard queries at 10k+ users

---

## Implementation Order

When you're ready to scale, implement fixes in this order:

### Phase 1: Quick Wins (1 day)
- [ ] Increase realtime debounce to 2 seconds
- [ ] Add React error boundary
- [ ] Add missing database indexes
- [ ] Add request size limits

### Phase 2: Reliability (2–3 days)
- [ ] Fix quota enforcement with SQL transaction
- [ ] Add retry logic (SendGrid, Slack, Anthropic)
- [ ] Make cron jobs fault-tolerant
- [ ] Add real health check endpoint

### Phase 3: Performance (3–5 days)
- [ ] Add Postgres full-text search
- [ ] Switch to cursor-based pagination
- [ ] Add rate limiting on read endpoints
- [ ] Queue activity log events

### Phase 4: Monitoring (1–2 days)
- [ ] Set up Sentry error tracking
- [ ] Configure Vercel Analytics
- [ ] Set up external health check monitoring
- [ ] Add custom AI scoring latency logging

### Phase 5: Refactoring (3–5 days)
- [ ] Split leads-client.tsx into sub-components
- [ ] Add loading skeletons
- [ ] Add optimistic updates for dismiss/delete
- [ ] Add memoization for expensive renders

---

> **Remember:** The app works great today for early users. Don't prematurely optimize — implement these fixes as you grow and actually need them. The checklist above is your guide for when to act.
