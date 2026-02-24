import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // "Delete all" mode — wipe leads matching optional filters
  if (body.all === true) {
    // Validate optional filters
    if (body.source && !VALID_SOURCES.includes(body.source)) {
      return NextResponse.json({ error: 'Invalid source filter' }, { status: 400 })
    }
    if (body.label && !VALID_LABELS.includes(body.label)) {
      return NextResponse.json({ error: 'Invalid label filter' }, { status: 400 })
    }

    let query = supabase
      .from('leads')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)

    if (body.source) query = query.eq('source', body.source)
    if (body.label) query = query.eq('intent_label', body.label)

    const { error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ deleted: count })
  }

  // "Delete selected" mode — delete specific IDs
  const { ids } = body
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: 'Provide 1-100 lead IDs' }, { status: 400 })
  }
  if (!ids.every((id: string) => UUID_RE.test(id))) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .in('id', ids)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: count })
}

const VALID_SOURCES = ['slack', 'email']
const VALID_LABELS = ['high', 'medium', 'low']

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const label = searchParams.get('label')
  const search = searchParams.get('search')?.trim().substring(0, 100) || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const hideDismissed = searchParams.get('hide_dismissed') !== 'false'
  const hideLow = searchParams.get('hide_low') !== 'false'
  const limit = 20

  // Validate filter params to prevent injection of unexpected values
  if (source && !VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'Invalid source filter' }, { status: 400 })
  }
  if (label && !VALID_LABELS.includes(label)) {
    return NextResponse.json({ error: 'Invalid label filter' }, { status: 400 })
  }

  const selectCols = 'id, sender_name, source, intent_score, intent_label, confidence, deal_tier, scoring_reasons, response_priority, priority_reason, summary_bullets, suggested_reply, raw_message, feedback, feedback_at, reply_sent, reply_sent_at, dismissed, slack_thread_ts, slack_channel_id, created_at'

  let query = supabase
    .from('leads')
    .select(selectCols, { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (source) {
    query = query.eq('source', source)
  }

  // Label filtering: explicit label takes priority, otherwise hide_low applies
  if (label) {
    query = query.eq('intent_label', label)
  } else if (hideLow) {
    query = query.in('intent_label', ['high', 'medium'])
  }

  // Hide dismissed leads by default
  if (hideDismissed) {
    query = query.eq('dismissed', false)
  }

  if (search) {
    // Escape PostgREST special characters to prevent filter injection
    const safeSearch = search.replace(/[%_\\,().]/g, (c) => `\\${c}`)
    query = query.or(`sender_name.ilike.%${safeSearch}%,raw_message.ilike.%${safeSearch}%`)
  }

  // Run leads query and connection status checks in parallel (no N+1)
  const [leadsResult, slackResult, emailResult] = await Promise.all([
    query,
    supabase
      .from('slack_installations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('email_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  let { data: leads, count, error } = leadsResult

  // Graceful fallback: if query failed (possibly missing 'dismissed' column), retry without it
  if (error && hideDismissed) {
    let retryQuery = supabase
      .from('leads')
      .select('id, sender_name, source, intent_score, intent_label, confidence, deal_tier, scoring_reasons, response_priority, priority_reason, summary_bullets, suggested_reply, raw_message, feedback, feedback_at, reply_sent, reply_sent_at, slack_thread_ts, slack_channel_id, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (source) retryQuery = retryQuery.eq('source', source)
    if (label) {
      retryQuery = retryQuery.eq('intent_label', label)
    } else if (hideLow) {
      retryQuery = retryQuery.in('intent_label', ['high', 'medium'])
    }
    if (search) {
      const safeSearch = search.replace(/[%_\\,().]/g, (c) => `\\${c}`)
      retryQuery = retryQuery.or(`sender_name.ilike.%${safeSearch}%,raw_message.ilike.%${safeSearch}%`)
    }

    const retryResult = await retryQuery
    leads = retryResult.data as typeof leads
    count = retryResult.count
    error = retryResult.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    leads: leads || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
    connections: {
      slack: (slackResult.count ?? 0) > 0,
      email: (emailResult.count ?? 0) > 0,
    },
  })
}
