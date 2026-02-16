import { WebClient } from '@slack/web-api'
import { createAdminClient } from '@/lib/supabase/admin'

// Create a Slack WebClient for a specific bot token
export function createSlackClient(botToken: string): WebClient {
  return new WebClient(botToken)
}

// Get a valid bot token for a user, refreshing if expired (token rotation)
export async function getValidBotToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: installation } = await supabase
    .from('slack_installations')
    .select('id, bot_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (!installation) return null

  // If no token rotation (no refresh_token), return as-is
  if (!installation.refresh_token) {
    return installation.bot_token
  }

  // Check if token is expired (refresh 5 minutes before expiry)
  const expiresAt = installation.token_expires_at
    ? new Date(installation.token_expires_at).getTime()
    : 0
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // 5 minutes

  if (expiresAt > now + bufferMs) {
    // Token still valid
    return installation.bot_token
  }

  // Token expired or about to expire — refresh it (10s timeout)
  let data: { ok: boolean; error?: string; access_token: string; refresh_token: string; expires_in?: number }
  try {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: installation.refresh_token,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    data = await response.json()
  } catch (err) {
    console.error('Slack token refresh request failed:', err)
    return installation.bot_token // fallback to existing token
  }

  if (!data.ok) {
    console.error('Failed to refresh Slack token:', data.error)
    return installation.bot_token // try with old token as fallback
  }

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  // Save new tokens
  await supabase
    .from('slack_installations')
    .update({
      bot_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', installation.id)

  return data.access_token
}
