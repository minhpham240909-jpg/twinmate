import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Run both queries in parallel — no sequential waits
  const [feedResult, todayResult] = await Promise.all([
    supabase
      .from('activity_log')
      .select('id, action, sender_name, source, intent_label, deal_tier, reply_preview, lead_id, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1),
    supabase
      .from('activity_log')
      .select('action, intent_label')
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString()),
  ])

  if (feedResult.error) {
    return NextResponse.json({ error: feedResult.error.message }, { status: 500 })
  }

  const activities = feedResult.data
  const count = feedResult.count
  const todayActivities = todayResult.data

  const stats = {
    leadsToday: 0,
    repliesSent: 0,
    autoHandled: 0,
    needsReview: 0,
  }

  if (todayActivities) {
    for (const a of todayActivities) {
      if (a.action === 'lead_received') {
        stats.leadsToday++
        if (a.intent_label === 'high') stats.needsReview++
      }
      if (a.action === 'reply_sent') stats.repliesSent++
      if (a.action === 'reply_auto_sent') {
        stats.repliesSent++
        stats.autoHandled++
        // If this was a HIGH auto-reply, it still needs review
      }
    }
  }

  return NextResponse.json({
    activities: activities || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
    stats,
  })
}
