import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadsClient from './leads-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const limit = 20

  // Run all 3 queries in parallel — no N+1, no sequential waits
  const [leadsResult, slackResult, emailResult] = await Promise.all([
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
  ])

  const leads = leadsResult.data || []
  const total = leadsResult.count || 0
  const totalPages = Math.ceil(total / limit)
  const connections = {
    slack: (slackResult.count ?? 0) > 0,
    email: (emailResult.count ?? 0) > 0,
  }

  return (
    <LeadsClient
      userId={user.id}
      initialLeads={leads}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialConnections={connections}
    />
  )
}
