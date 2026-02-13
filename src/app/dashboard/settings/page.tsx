import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Run all 3 queries in parallel — no N+1, no sequential waits
  const [profileResult, emailResult, slackResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('business_name, niche, tone, booking_link, custom_instructions, auto_reply_enabled, reply_from_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('email_addresses')
      .select('inbound_address')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('slack_installations')
      .select('team_name')
      .eq('user_id', user.id)
      .limit(1)
      .single(),
  ])

  const profile = profileResult.data
  const initialProfile = {
    businessName: profile?.business_name || '',
    niche: profile?.niche || '',
    tone: profile?.tone || 'professional',
    bookingLink: profile?.booking_link || '',
    customInstructions: profile?.custom_instructions || '',
    autoReplyEnabled: profile?.auto_reply_enabled || false,
    replyFromName: profile?.reply_from_name || '',
  }

  const initialEmailAddress = emailResult.data?.inbound_address || ''
  const initialSlackTeam = slackResult.data?.team_name || ''

  return (
    <SettingsClient
      initialProfile={initialProfile}
      initialEmailAddress={initialEmailAddress}
      initialSlackTeam={initialSlackTeam}
    />
  )
}
