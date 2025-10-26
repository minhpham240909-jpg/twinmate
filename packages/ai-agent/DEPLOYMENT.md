# Production Deployment Guide

Complete guide for deploying the Clerva AI Agent to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Supabase Setup](#supabase-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Environment Variables](#environment-variables)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Observability](#monitoring--observability)
7. [Scaling Considerations](#scaling-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Supabase production project created
- [ ] OpenAI API key with billing enabled
- [ ] All environment variables documented
- [ ] Database migrations tested locally
- [ ] All tools tested with sample data
- [ ] Error monitoring set up (Sentry, etc.)
- [ ] Cost tracking dashboard ready
- [ ] Rate limiting configured
- [ ] CORS policies defined
- [ ] Backup strategy in place

---

## Supabase Setup

### 1. Create Production Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create new project (select region closest to users)
3. Choose a strong database password
4. Wait for project to provision (~2 minutes)

### 2. Enable pgvector Extension

In Supabase SQL Editor:

```sql
create extension if not exists vector;
```

### 3. Run Database Migrations

**Option A: Using Supabase CLI (Recommended)**

```bash
cd clerva-app/supabase
npx supabase link --project-ref your-project-ref
npx supabase db push
```

**Option B: Manual SQL Execution**

1. Copy contents of `supabase/migrations/20250126000001_ai_agent_schema.sql`
2. Paste into Supabase SQL Editor
3. Execute

### 4. Create Vector Search Function

```sql
create or replace function search_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  doc_id uuid,
  ord int,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.doc_id,
    dc.ord,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from doc_chunk dc
  inner join doc_source ds on dc.doc_id = ds.id
  where ds.user_id = p_user_id
    and ds.status = 'ready'
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### 5. Configure Row-Level Security (RLS)

RLS policies are automatically created by the migration, but verify:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verify all tables have rowsecurity = true
```

### 6. Set Up Realtime (for Presence)

In Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for `presence` table
3. Optionally enable for `agent_memory` (for notifications)

### 7. Configure Storage (for Document Uploads)

1. Go to Storage → Create Bucket
2. Bucket name: `documents`
3. Set privacy: Private
4. Add RLS policies:

```sql
-- Allow users to upload their own documents
create policy "Users can upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read their own documents
create policy "Users can read own documents"
  on storage.objects for select
  using (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com)
2. Import Git Repository
3. Select `clerva-app` directory as root

### 2. Configure Build Settings

- **Framework Preset:** Next.js
- **Root Directory:** `./` (or `clerva-app` if monorepo)
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### 3. Add Environment Variables

In Vercel → Settings → Environment Variables, add:

```bash
# Supabase (Production)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Optional
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://clerva.com
```

**Important:** Use **Production** environment for sensitive keys.

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (~3-5 minutes)
3. Verify deployment at your Vercel URL

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | - |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |
| `SENTRY_DSN` | Sentry error tracking | - |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics | - |

### Security Best Practices

- **Never commit `.env.local`** to git
- **Use different keys** for dev/staging/prod
- **Rotate service role key** every 90 days
- **Monitor API key usage** in OpenAI dashboard
- **Set spending limits** on OpenAI account

---

## Post-Deployment Verification

### 1. Health Checks

Test the AI agent API:

```bash
# Check agent status
curl https://your-app.vercel.app/api/ai-agent/chat

# Expected response:
# {"status":"ok","version":"1.0.0","toolsAvailable":11}
```

### 2. Test All Tools

Create a test script (`test-tools.ts`):

```typescript
const tools = [
  { name: 'searchNotes', input: { query: 'test', limit: 5 } },
  { name: 'generateQuiz', input: { topic: 'Math', difficulty: 'easy', n: 5 } },
  { name: 'getOnlineUsers', input: { limit: 10 } },
  // ... test all 11 tools
]

for (const tool of tools) {
  try {
    const res = await fetch('/api/ai-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Use ${tool.name} with ${JSON.stringify(tool.input)}` }),
    })
    console.log(`✅ ${tool.name} works`)
  } catch (err) {
    console.error(`❌ ${tool.name} failed:`, err)
  }
}
```

### 3. Verify Database Connections

Check Supabase logs for connection errors:
1. Go to Supabase Dashboard → Logs
2. Filter by "Error"
3. Ensure no connection pool exhaustion

### 4. Test RAG Pipeline

1. Upload a test document
2. Wait for chunking + embedding (check `doc_source.status = 'ready'`)
3. Search: "Tell me about [document topic]"
4. Verify results are relevant

---

## Monitoring & Observability

### 1. Set Up Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

In `sentry.server.config.js`:

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization
    }
    return event
  },
})
```

### 2. Cost Tracking Dashboard

Create a Supabase view:

```sql
create view ai_cost_summary as
select
  date_trunc('day', created_at) as day,
  sum(token_count) as total_tokens,
  sum(cost_usd) as total_cost_usd,
  count(*) as total_calls
from agent_telemetry
group by day
order by day desc;
```

Query daily:

```sql
select * from ai_cost_summary where day >= current_date - interval '7 days';
```

### 3. Set Up Alerts

**OpenAI Spending Alert:**
1. Go to OpenAI Dashboard → Usage
2. Set monthly budget limit
3. Enable email alerts at 80% and 100%

**Supabase Alerts:**
1. Database size > 80%
2. Connection pool > 80%
3. API requests > quota

**Vercel Alerts:**
1. Function timeout rate > 5%
2. Build failures

### 4. Log Aggregation

Use Vercel's built-in logging or integrate with:
- **Datadog** - Full observability
- **LogRocket** - Session replay
- **Better Stack** - Log management

---

## Scaling Considerations

### Database Optimization

**pgvector Index Tuning:**

```sql
-- Increase lists for larger datasets (>100k chunks)
create index idx_doc_chunk_embedding on doc_chunk
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 1000); -- Increase from 100 for >100k rows
```

**Connection Pooling:**

Use Supabase Pooler (Transaction mode):

```bash
SUPABASE_POOLER_URL=postgresql://postgres.xxx:6543/postgres
```

**Read Replicas:**

For heavy read workloads, use Supabase read replicas (Pro plan).

### API Rate Limiting

Implement per-user rate limiting:

```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  keyGenerator: (req) => req.user.id,
})

export default limiter
```

### Caching Strategy

**Redis for embeddings:**

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

async function getCachedEmbedding(text: string) {
  const cached = await redis.get(`emb:${hash(text)}`)
  if (cached) return JSON.parse(cached)

  const embedding = await generateEmbedding(text)
  await redis.set(`emb:${hash(text)}`, JSON.stringify(embedding), 'EX', 86400) // 24h TTL
  return embedding
}
```

### Background Jobs

Use Inngest or BullMQ for:
- Document processing (chunk + embed)
- Match score pre-computation
- Learning profile updates
- Telemetry aggregation

```typescript
// inngest/functions.ts
export const processDocument = inngest.createFunction(
  { id: 'process-document' },
  { event: 'document.uploaded' },
  async ({ event, step }) => {
    const { docId, userId } = event.data

    // Chunk
    const chunks = await step.run('chunk-document', () => chunkDocument(docId))

    // Embed
    const embeddings = await step.run('embed-chunks', () => embedChunks(chunks))

    // Store
    await step.run('store-chunks', () => storeChunks(docId, embeddings))
  }
)
```

---

## Troubleshooting

### Common Issues

**1. "Function search_chunks does not exist"**

**Fix:** Create the vector search function (see Supabase Setup step 4)

**2. "Too many connections" (Supabase)**

**Fix:** Use Supabase Pooler connection string

**3. "OpenAI rate limit exceeded"**

**Fix:** Implement request queuing + retry with exponential backoff

**4. "Embeddings are slow"**

**Fix:**
- Batch embed in background
- Use embedding cache (Redis)
- Switch to text-embedding-3-small (cheaper, faster)

**5. "Memory leak in orchestrator"**

**Fix:** Ensure LLM responses are not accumulating in memory. Clear conversation history after N turns.

**6. "CORS errors in production"**

**Fix:** Add domains to Supabase → Settings → API → CORS

---

## Performance Benchmarks

Expected performance for 1,000 concurrent users:

| Metric | Target | Actual |
|--------|--------|--------|
| **API Response Time** | <2s (p95) | - |
| **RAG Retrieval** | <500ms | - |
| **Quiz Generation** | <3s | - |
| **Match Scoring** | <1.5s | - |
| **Database Queries** | <100ms (p95) | - |
| **Embedding Cache Hit Rate** | >95% | - |

Monitor with Vercel Analytics + Supabase Dashboard.

---

## Rollback Plan

If deployment fails:

1. **Revert Vercel deployment** to previous version
2. **Check database migrations** - do NOT rollback if already applied
3. **Verify environment variables** are correct
4. **Check Supabase status** at status.supabase.com
5. **Review error logs** in Sentry/Vercel
6. **Test in staging** environment first

---

## Next Steps After Deployment

1. **Monitor costs** for first week (expect ~$50-100)
2. **Set up backup jobs** (Supabase automatic backups are enabled on Pro plan)
3. **Run load tests** with tools like k6 or Artillery
4. **Optimize slow queries** using Supabase Dashboard → Database → Query Performance
5. **Document incidents** in runbook
6. **Train support team** on common issues

---

## Production Checklist

Before going live with users:

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Vector search function created
- [ ] RLS policies verified
- [ ] Storage buckets configured
- [ ] Error monitoring active
- [ ] Cost alerts configured
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] Backup strategy in place
- [ ] All 11 tools tested
- [ ] RAG pipeline tested with real data
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Legal review (privacy policy, ToS)

---

**Ready to deploy?** Follow the steps above and monitor closely for the first 48 hours.

**Questions?** Check the main README or open an issue.
