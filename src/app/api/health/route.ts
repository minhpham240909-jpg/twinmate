import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {}

  // Database connectivity check
  const dbStart = Date.now()
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    checks.database = { ok: !error, latencyMs: Date.now() - dbStart }
    if (error) checks.database.error = error.message
  } catch (err) {
    checks.database = { ok: false, latencyMs: Date.now() - dbStart, error: String(err) }
  }

  // Redis connectivity check (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redisStart = Date.now()
    try {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      })
      checks.redis = { ok: res.ok, latencyMs: Date.now() - redisStart }
      if (!res.ok) checks.redis.error = `HTTP ${res.status}`
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
