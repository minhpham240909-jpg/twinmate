import { createAdminClient } from '@/lib/supabase/admin'
import { createSlackClient } from '@/lib/slack/client'

export const runtime = 'nodejs'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET) {
    console.error('CRON_SECRET is not configured')
    return new Response('Internal server error', { status: 500 })
  }
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()

  // Find all HIGH leads older than 24h that haven't been replied to
  // Single query — no N+1
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: unrepliedLeads, error } = await supabase
    .from('leads')
    .select('id, user_id, sender_name, source, created_at, reminder_sent')
    .eq('intent_label', 'high')
    .eq('reply_sent', false)
    .eq('reminder_sent', false)
    .lt('created_at', twentyFourHoursAgo)
    .order('user_id')

  if (error) {
    console.error('Cron lead-reminders DB error:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  if (!unrepliedLeads || unrepliedLeads.length === 0) {
    return Response.json({ ok: true, reminders: 0 })
  }

  // Group leads by user_id to send one message per user (not per lead)
  const leadsByUser = new Map<string, typeof unrepliedLeads>()
  for (const lead of unrepliedLeads) {
    const existing = leadsByUser.get(lead.user_id) || []
    existing.push(lead)
    leadsByUser.set(lead.user_id, existing)
  }

  // Get all Slack installations for these users in one query — no N+1
  const userIds = Array.from(leadsByUser.keys())
  const { data: installations } = await supabase
    .from('slack_installations')
    .select('user_id, bot_token, bot_user_id, authed_user_id')
    .in('user_id', userIds)

  if (!installations || installations.length === 0) {
    return Response.json({ ok: true, reminders: 0 })
  }

  // Build a map of user_id → installation for O(1) lookup
  const installationMap = new Map(
    installations.map((i) => [i.user_id, i])
  )

  let remindersSent = 0
  const leadIdsToMark: string[] = []

  for (const [userId, leads] of leadsByUser) {
    const installation = installationMap.get(userId)
    if (!installation) continue

    const slack = createSlackClient(installation.bot_token)

    // Build the reminder message
    const leadLines = leads
      .map((l) => {
        const age = Math.round((Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60))
        return `• *${l.sender_name || 'Unknown'}* (${l.source}) — ${age}h ago`
      })
      .join('\n')

    const message =
      leads.length === 1
        ? `You have a high-intent lead from *${leads[0].sender_name || 'someone'}* that hasn't been replied to yet (${Math.round((Date.now() - new Date(leads[0].created_at).getTime()) / (1000 * 60 * 60))}h ago). Don't let this one slip away.`
        : `You have *${leads.length} high-intent leads* that haven't been replied to yet:\n\n${leadLines}\n\nDon't let these slip away.`

    try {
      // Send DM to the authed user (already fetched in the batch query above)
      const targetUser = installation.authed_user_id
      if (!targetUser) continue

      const dm = await slack.conversations.open({ users: targetUser })
      if (!dm.channel?.id) continue

      await slack.chat.postMessage({
        channel: dm.channel.id,
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:fire: *Unreplied high-intent lead${leads.length > 1 ? 's' : ''}*`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `<${process.env.NEXT_PUBLIC_APP_URL || 'https://clerva.app'}/dashboard|View in Clerva>`,
              },
            ],
          },
        ],
      })

      // Track which leads got reminders
      for (const lead of leads) {
        leadIdsToMark.push(lead.id)
      }
      remindersSent++
    } catch (err) {
      console.error(`Failed to send reminder to user ${userId}:`, err)
    }
  }

  // Mark all reminded leads in one query — no N+1
  if (leadIdsToMark.length > 0) {
    await supabase
      .from('leads')
      .update({ reminder_sent: true })
      .in('id', leadIdsToMark)
  }

  return Response.json({ ok: true, reminders: remindersSent })
}
