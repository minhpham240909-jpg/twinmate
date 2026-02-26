import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadsClient from './leads-client'
import type { ActivityLog } from '@/types/lead'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const limit = 20
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Fetch user's show_low / show_dismissed preferences
  const profileResult = await supabase
    .from('profiles')
    .select('show_low, show_dismissed')
    .eq('id', user.id)
    .single()

  const showLow = profileResult.data?.show_low ?? false
  const showDismissed = profileResult.data?.show_dismissed ?? false

  // Run core queries in parallel — leads, slack, email (these must succeed)
  // Filter based on user's saved preferences
  let leadsQuery = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, limit - 1)

  if (!showDismissed) {
    leadsQuery = leadsQuery.eq('dismissed', false)
  }
  if (!showLow) {
    leadsQuery = leadsQuery.in('intent_label', ['high', 'medium'])
  }

  const [leadsResult, slackResult, emailResult] = await Promise.all([
    leadsQuery,
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

  // Graceful fallback if dismissed column doesn't exist yet
  let finalLeadsResult = leadsResult
  if (leadsResult.error) {
    // Retry without dismissed filter (but still exclude soft-deleted)
    finalLeadsResult = await supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('intent_label', ['high', 'medium'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, limit - 1)

    // If still failing, fall back to minimal filters
    if (finalLeadsResult.error) {
      finalLeadsResult = await supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(0, limit - 1)
    }
  }

  // Activity queries are optional — if table doesn't exist yet, gracefully degrade
  let activityResult: { data: ActivityLog[] | null } = { data: [] }
  let todayStatsResult: { data: { action: string; intent_label: string | null }[] | null } = { data: [] }
  try {
    const [actRes, todayRes] = await Promise.all([
      supabase
        .from('activity_log')
        .select('id, action, sender_name, source, intent_label, deal_tier, reply_preview, lead_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('activity_log')
        .select('action, intent_label')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString()),
    ])
    if (!actRes.error) activityResult = actRes as unknown as { data: ActivityLog[] | null }
    if (!todayRes.error) todayStatsResult = todayRes
  } catch {
    // activity_log table may not exist yet — dashboard still works without it
  }

  const leads = finalLeadsResult.data || []
  const total = finalLeadsResult.count || 0
  const totalPages = Math.ceil(total / limit)
  const connections = {
    slack: (slackResult.count ?? 0) > 0,
    email: (emailResult.count ?? 0) > 0,
  }

  // Compute today's stats
  const todayActivities = todayStatsResult.data || []
  const stats = { leadsToday: 0, repliesSent: 0, autoHandled: 0, needsReview: 0 }
  for (const a of todayActivities) {
    if (a.action === 'lead_received') {
      stats.leadsToday++
      if (a.intent_label === 'high') stats.needsReview++
    }
    if (a.action === 'reply_sent') stats.repliesSent++
    if (a.action === 'reply_auto_sent') {
      stats.repliesSent++
      stats.autoHandled++
    }
  }

  return (
    <LeadsClient
      userId={user.id}
      initialLeads={leads}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialConnections={connections}
      initialActivities={(activityResult.data || []) as ActivityLog[]}
      initialStats={stats}
      initialShowLow={showLow}
      initialShowDismissed={showDismissed}
    />
  )
}
