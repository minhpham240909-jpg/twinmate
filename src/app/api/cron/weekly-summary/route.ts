import { createAdminClient } from '@/lib/supabase/admin'
import { createSlackClient } from '@/lib/slack/client'
import type { KnownBlock } from '@slack/web-api'

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

  // Get all users who have active Slack installations
  // This is who we send summaries to
  const { data: installations } = await supabase
    .from('slack_installations')
    .select('user_id, bot_token, authed_user_id')

  if (!installations || installations.length === 0) {
    return Response.json({ ok: true, summaries: 0 })
  }

  // Date range: last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Get ALL leads from the past 7 days for all users with Slack — one query
  const userIds = installations.map((i) => i.user_id)
  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, user_id, intent_label, reply_sent, source')
    .in('user_id', userIds)
    .gte('created_at', sevenDaysAgo)
    .lte('created_at', now)

  // Build a map of user_id → leads for O(1) grouping
  const leadsByUser = new Map<string, typeof allLeads>()
  if (allLeads) {
    for (const lead of allLeads) {
      const existing = leadsByUser.get(lead.user_id) || []
      existing.push(lead)
      leadsByUser.set(lead.user_id, existing)
    }
  }

  // Build installation lookup
  const installationMap = new Map(
    installations.map((i) => [i.user_id, i])
  )

  let summariesSent = 0

  for (const [userId, installation] of installationMap) {
    const leads = leadsByUser.get(userId)

    // Skip users with zero leads this week — no noise
    if (!leads || leads.length === 0) continue

    const targetUser = installation.authed_user_id
    if (!targetUser) continue

    // Compute stats
    const highCount = leads.filter((l) => l.intent_label === 'high').length
    const mediumCount = leads.filter((l) => l.intent_label === 'medium').length
    const lowCount = leads.filter((l) => l.intent_label === 'low').length
    const repliedCount = leads.filter((l) => l.reply_sent).length
    const unrepliedHigh = leads.filter((l) => l.intent_label === 'high' && !l.reply_sent).length
    const slackCount = leads.filter((l) => l.source === 'slack').length
    const emailCount = leads.filter((l) => l.source === 'email').length

    // Build the summary message
    const totalLeads = leads.length
    const replyRate = totalLeads > 0 ? Math.round((repliedCount / totalLeads) * 100) : 0

    const scoreBreakdown = [
      highCount > 0 ? `${highCount} High` : null,
      mediumCount > 0 ? `${mediumCount} Medium` : null,
      lowCount > 0 ? `${lowCount} Low` : null,
    ]
      .filter(Boolean)
      .join(', ')

    const sourceBreakdown = [
      slackCount > 0 ? `${slackCount} from Slack` : null,
      emailCount > 0 ? `${emailCount} from email` : null,
    ]
      .filter(Boolean)
      .join(', ')

    // Build blocks
    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:bar_chart: *Your weekly lead summary*`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${totalLeads} lead${totalLeads !== 1 ? 's' : ''} this week* — ${scoreBreakdown}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `:incoming_envelope: *Sources*\n${sourceBreakdown || 'None'}`,
          },
          {
            type: 'mrkdwn',
            text: `:speech_balloon: *Replies sent*\n${repliedCount} of ${totalLeads} (${replyRate}%)`,
          },
        ],
      },
    ]

    // Add warning if there are unreplied high-intent leads
    if (unrepliedHigh > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:warning: *${unrepliedHigh} high-intent lead${unrepliedHigh !== 1 ? 's' : ''} still unreplied.* Don't let ${unrepliedHigh === 1 ? 'this one' : 'these'} slip away.`,
        },
      })
    }

    // Add dashboard link
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<${process.env.NEXT_PUBLIC_APP_URL || 'https://clerva.app'}/dashboard|View all leads in Adecis>`,
        },
      ],
    })

    // Fallback text for notifications
    const fallbackText = `Weekly summary: ${totalLeads} leads this week (${scoreBreakdown}). ${repliedCount} replied. ${unrepliedHigh > 0 ? `${unrepliedHigh} high-intent still unreplied.` : ''}`

    try {
      const slack = createSlackClient(installation.bot_token)

      const dm = await slack.conversations.open({ users: targetUser })
      if (!dm.channel?.id) continue

      await slack.chat.postMessage({
        channel: dm.channel.id,
        text: fallbackText,
        blocks,
      })

      summariesSent++
    } catch (err) {
      console.error(`Failed to send weekly summary to user ${userId}:`, err)
    }
  }

  return Response.json({ ok: true, summaries: summariesSent })
}
