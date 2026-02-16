import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BillingClient from './billing-client'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, leads_used_this_month, plan_lead_limit, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<div className="text-sm text-gray-400">Loading billing...</div>}>
      <BillingClient profile={profile} />
    </Suspense>
  )
}
