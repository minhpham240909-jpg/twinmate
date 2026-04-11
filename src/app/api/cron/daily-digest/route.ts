import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmailReply } from '@/lib/email/send'
import { withRetry } from '@/lib/retry'

export const runtime = 'nodejs'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET) {
    console.error('CRON_SECRET is not configured')
    return new Response('Internal server error', { status: 500 })
  }
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()

  // Current hour (UTC) — only send to users whose digest_hour matches
  const currentHour = new Date().getUTCHours()

  // Get all users with digest enabled at this hour
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, email, business_name, digest_hour')
    .eq('digest_enabled', true)
    .eq('digest_hour', currentHour)

  if (usersError || !users || users.length === 0) {
    return Response.json({ ok: true, digests: 0 })
  }

  // Get yesterday's activity for all these users — single query
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const userIds = users.map((u) => u.id)

  const { data: activities } = await supabase
    .from('activity_log')
    .select('user_id, action, sender_name, source, intent_label, deal_tier, reply_preview')
    .in('user_id', userIds)
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })

  if (!activities || activities.length === 0) {
    return Response.json({ ok: true, digests: 0 })
  }

  // Group activities by user
  const activityByUser = new Map<string, typeof activities>()
  for (const a of activities) {
    const existing = activityByUser.get(a.user_id) || []
    existing.push(a)
    activityByUser.set(a.user_id, existing)
  }

  let digestsSent = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.clerva.app'

  for (const user of users) {
    const userActivities = activityByUser.get(user.id)
    if (!userActivities || userActivities.length === 0) continue
    if (!user.email) continue

    // Compute stats
    const leadsReceived = userActivities.filter((a) => a.action === 'lead_received').length
    const leadsSkipped = userActivities.filter((a) => a.action === 'lead_skipped').length
    const autoReplies = userActivities.filter((a) => a.action === 'reply_auto_sent').length
    const manualReplies = userActivities.filter((a) => a.action === 'reply_sent').length
    const totalReplies = autoReplies + manualReplies
    const highLeads = userActivities.filter((a) => a.action === 'lead_received' && a.intent_label === 'high')

    // Build plain text email
    const lines: string[] = []
    lines.push(`Your Clerva Daily Summary`)
    lines.push(`========================`)
    lines.push(``)
    lines.push(`${leadsReceived} lead${leadsReceived !== 1 ? 's' : ''} received | ${totalReplies} repl${totalReplies !== 1 ? 'ies' : 'y'} sent | ${leadsSkipped} skipped`)
    lines.push(``)

    if (highLeads.length > 0) {
      lines.push(`--- HIGH INTENT (needs your review) ---`)
      for (const lead of highLeads) {
        const tier = lead.deal_tier && lead.deal_tier !== 'unknown'
          ? ` | ${lead.deal_tier === 'enterprise' ? '$50k+' : lead.deal_tier === 'mid-high' ? '$10-50k' : lead.deal_tier === 'mid' ? '$2-10k' : '<$2k'}`
          : ''
        lines.push(`  * ${lead.sender_name || 'Unknown'} (${lead.source})${tier}`)
      }
      lines.push(``)
    }

    if (autoReplies > 0) {
      lines.push(`--- AUTO-HANDLED ---`)
      const autoItems = userActivities.filter((a) => a.action === 'reply_auto_sent')
      for (const item of autoItems.slice(0, 10)) {
        const preview = item.reply_preview ? ` — "${item.reply_preview.substring(0, 60)}..."` : ''
        lines.push(`  * ${item.sender_name || 'Unknown'} (${item.source})${preview}`)
      }
      if (autoItems.length > 10) {
        lines.push(`  ... and ${autoItems.length - 10} more`)
      }
      lines.push(``)
    }

    if (leadsSkipped > 0) {
      lines.push(`--- SKIPPED (low intent) ---`)
      const skipped = userActivities.filter((a) => a.action === 'lead_skipped')
      for (const item of skipped.slice(0, 5)) {
        lines.push(`  * ${item.sender_name || 'Unknown'} (${item.source})`)
      }
      if (skipped.length > 5) {
        lines.push(`  ... and ${skipped.length - 5} more`)
      }
      lines.push(``)
    }

    lines.push(`View all leads: ${appUrl}/dashboard`)
    lines.push(``)
    lines.push(`— Clerva`)

    try {
      await withRetry(
        () => sendEmailReply({
          to: user.email,
          fromAddress: 'noreply@clerva.app',
          fromName: 'Clerva',
          subject: `Daily summary — ${leadsReceived} lead${leadsReceived !== 1 ? 's' : ''}, ${totalReplies} repl${totalReplies !== 1 ? 'ies' : 'y'} sent`,
          body: lines.join('\n'),
        }),
        { label: `digest-${user.email}`, maxAttempts: 2 }
      )
      digestsSent++
    } catch (err) {
      // Per-user error isolation — one failed digest never blocks others
      console.error(`Failed to send digest to ${user.email}:`, err)
    }
  }

  return Response.json({ ok: true, digests: digestsSent })
}
