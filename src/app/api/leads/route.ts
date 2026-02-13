import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = 20

  // Validate filter params to prevent injection of unexpected values
  if (source && !VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'Invalid source filter' }, { status: 400 })
  }
  if (label && !VALID_LABELS.includes(label)) {
    return NextResponse.json({ error: 'Invalid label filter' }, { status: 400 })
  }

  let query = supabase
    .from('leads')
    .select('id, sender_name, source, intent_score, intent_label, confidence, deal_tier, scoring_reasons, response_priority, priority_reason, summary_bullets, suggested_reply, raw_message, feedback, reply_sent, reply_sent_at, slack_thread_ts, slack_channel_id, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (source) {
    query = query.eq('source', source)
  }
  if (label) {
    query = query.eq('intent_label', label)
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

  const { data: leads, count, error } = leadsResult

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
