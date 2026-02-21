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

  // Run all 5 queries in parallel — no N+1, no sequential waits
  const [leadsResult, slackResult, emailResult, activityResult, todayStatsResult] = await Promise.all([
    supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, limit - 1),
    supabase
      .from('slack_installations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('email_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true),
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

  const leads = leadsResult.data || []
  const total = leadsResult.count || 0
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
    />
  )
}
