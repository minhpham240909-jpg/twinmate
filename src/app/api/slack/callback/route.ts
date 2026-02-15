import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=slack_denied`
    )
  }

  // Exchange code for token
  const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`,
    }),
  })

  const data = await tokenResponse.json()

  if (!data.ok) {
    console.error('Slack OAuth error:', data.error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=slack_failed`
    )
  }

  const supabase = createAdminClient()

  // Upsert slack installation (includes refresh_token for token rotation)
  const tokenExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  const { error: dbError } = await supabase
    .from('slack_installations')
    .upsert(
      {
        user_id: state,
        team_id: data.team.id,
        team_name: data.team.name,
        bot_token: data.access_token,
        refresh_token: data.refresh_token || null,
        token_expires_at: tokenExpiresAt,
        bot_user_id: data.bot_user_id,
        authed_user_id: data.authed_user?.id,
        scope: data.scope,
      },
      { onConflict: 'user_id,team_id' }
    )

  if (dbError) {
    console.error('Failed to save Slack installation:', dbError)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=slack_save_failed`
    )
  }

  // Update onboarding step (non-blocking — Slack install already saved above)
  await supabase
    .from('profiles')
    .update({ onboarding_step: 2 })
    .eq('id', state)
    .then(({ error: stepError }) => {
      if (stepError) console.error('Failed to update onboarding step:', stepError)
    })

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/profile`
  )
}
