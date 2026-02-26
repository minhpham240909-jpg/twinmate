import { waitUntil } from '@vercel/functions'
import { verifySlackSignature } from '@/lib/slack/verify'
import { createSlackClient } from '@/lib/slack/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreLeadSmart, type SmartScoreResult } from '@/lib/ai/score-lead'
import { formatLeadResponse } from '@/lib/slack/format'
import { canProcessLead, canSendReply } from '@/lib/stripe/helpers'
import { isDuplicate, slackEventRateLimit, safeRateLimit } from '@/lib/rate-limit'
import { logActivity } from '@/lib/activity'
import { sendPushToUser } from '@/lib/push'
import { withRetry } from '@/lib/retry'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  const rawBody = await request.text()

  // Verify Slack signature
  if (!verifySlackSignature(request.headers, rawBody)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  // Handle URL verification challenge
  if (payload.type === 'url_verification') {
    return Response.json({ challenge: payload.challenge })
  }

  // Handle event callbacks
  if (payload.type === 'event_callback' && payload.event?.type === 'message') {
    const event = payload.event
    const teamId = payload.team_id
    const eventId = payload.event_id

    // Ignore bot messages, message edits/deletes, and empty messages
    if (event.bot_id || event.subtype || !event.text?.trim()) {
      return new Response('OK', { status: 200 })
    }

    // Deduplication (Slack retries on slow responses)
    if (await isDuplicate(eventId)) {
      return new Response('OK', { status: 200 })
    }

    // Acknowledge immediately — process in background
    // waitUntil keeps the serverless function alive until the promise resolves
    waitUntil(
      processSlackLead(event, teamId).catch((err) => {
        console.error('Failed to process Slack lead:', err)
      })
    )

    return new Response('OK', { status: 200 })
  }

  return new Response('OK', { status: 200 })
}

async function processSlackLead(
  event: {
    channel: string
    user: string
    text: string
    ts: string
    thread_ts?: string
  },
  teamId: string
) {
  const supabase = createAdminClient()

  // Look up the installation for this team — try with auto-reply columns first
  interface SlackProfile {
    id: string
    niche: string
    tone: string
    booking_link: string | null
    business_name: string | null
    custom_instructions: string | null
    auto_reply_enabled: boolean
    reply_from_name: string | null
  }
  interface InstallData {
    user_id: string
    bot_token: string
    monitored_channels: string[] | null
  }

  let install: InstallData | null = null
  let profile: SlackProfile | null = null

  const { data: fullInstall } = await supabase
    .from('slack_installations')
    .select('*, profiles!inner(id, niche, tone, booking_link, business_name, custom_instructions, auto_reply_enabled, reply_from_name)')
    .eq('team_id', teamId)
    .single()

  if (fullInstall) {
    install = fullInstall as unknown as InstallData
    profile = (fullInstall as Record<string, unknown>).profiles as SlackProfile
  } else {
    // Fallback if migration 004 hasn't been run (missing auto-reply columns)
    const { data: basicInstall } = await supabase
      .from('slack_installations')
      .select('*, profiles!inner(id, niche, tone, booking_link, business_name, custom_instructions)')
      .eq('team_id', teamId)
      .single()
    if (basicInstall) {
      install = basicInstall as unknown as InstallData
      const bp = (basicInstall as Record<string, unknown>).profiles as Omit<SlackProfile, 'auto_reply_enabled' | 'reply_from_name'>
      profile = { ...bp, auto_reply_enabled: false, reply_from_name: null }
    }
  }

  if (!install || !profile) return

  const userId = install.user_id

  // Single Slack client — reused for all API calls
  const slack = createSlackClient(install.bot_token)

  // Check if channel is monitored (empty array = monitor all)
  const monitoredChannels = install.monitored_channels || []
  if (monitoredChannels.length > 0 && !monitoredChannels.includes(event.channel)) {
    return
  }

  // Rate limit check (safe — allows through if Redis is down)
  const { success: rateLimitOk } = await safeRateLimit(slackEventRateLimit, teamId)
  if (!rateLimitOk) return

  // Subscription/usage check
  const { allowed, reason, warning } = await canProcessLead(userId)
  if (!allowed) {
    console.log('[slack] Blocked by canProcessLead:', reason, '| user:', userId)
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: reason || 'Unable to process this lead right now.',
    })
    return
  }

  // Get sender name from Slack
  let senderName = 'Someone'
  try {
    const userInfo = await slack.users.info({ user: event.user })
    senderName = userInfo.user?.real_name || userInfo.user?.name || 'Someone'
  } catch {
    // Use default
  }

  // Fetch thread context if this is a reply
  let threadContext: string | undefined
  if (event.thread_ts) {
    try {
      const replies = await slack.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 5,
      })
      if (replies.messages && replies.messages.length > 1) {
        threadContext = replies.messages
          .slice(0, -1)
          .map((m) => m.text || '')
          .join('\n---\n')
      }
    } catch {
      // No thread context
    }
  }

  // Smart scoring: pre-filter spam → check cache → call Claude API
  let smartResult: SmartScoreResult | null = null
  try {
    smartResult = await withRetry(
      () => scoreLeadSmart({
        message: event.text,
        threadContext,
        source: 'slack',
        senderName,
        profile: {
          niche: profile.niche || 'other',
          tone: profile.tone || 'professional',
          bookingLink: profile.booking_link || undefined,
          businessName: profile.business_name || undefined,
          customInstructions: profile.custom_instructions || undefined,
          replyFromName: profile.reply_from_name || undefined,
        },
      }),
      { label: 'ai-score-slack', maxAttempts: 2 }
    )
  } catch (err) {
    console.error('AI scoring failed for Slack lead — inserting without score:', err)
  }

  // Pre-filtered messages (spam/junk) — skip entirely, no quota used, no lead inserted
  if (smartResult?.filtered) {
    console.log('[slack] Pre-filtered, skipping:', smartResult.reason)
    return
  }

  // Extract the score result (null if AI failed entirely)
  const result = smartResult && !smartResult.filtered ? smartResult.result : null

  // Atomic quota reservation — check AND increment in one locked transaction
  // This prevents the race condition where two concurrent leads both pass the quota check
  const { data: quotaOk } = await supabase.rpc('try_use_lead', { p_user_id: userId })
  if (quotaOk === false) {
    console.log('[slack] Quota exceeded for user:', userId)
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: 'Lead limit reached for this month. Upgrade your plan for more leads.',
    })
    return
  }

  // Insert lead — fully scored if AI succeeded, raw message only if it failed
  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert({
      user_id: userId,
      source: 'slack',
      source_id: event.ts,
      source_channel: event.channel,
      sender_name: senderName,
      sender_identifier: event.user,
      raw_message: event.text,
      thread_context: threadContext || null,
      slack_thread_ts: event.ts,
      slack_channel_id: event.channel,
      ...(result && {
        intent_score: result.score.intent_score,
        intent_label: result.score.intent_label,
        summary_bullets: result.score.summary_bullets,
        suggested_reply: result.score.suggested_reply,
        confidence: result.score.confidence,
        deal_tier: result.score.deal_tier,
        scoring_reasons: result.score.scoring_reasons,
        response_priority: result.score.response_priority,
        priority_reason: result.score.priority_reason,
        model_used: result.model,
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        ai_latency_ms: result.latencyMs,
      }),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Failed to insert lead:', insertError)
    return
  }

  const intentLabel = result?.score.intent_label || null
  const dealTier = result?.score.deal_tier || null

  // Log activity — "lead_skipped" for low intent, "lead_received" otherwise
  if (result && intentLabel === 'low') {
    void logActivity({
      userId, leadId: lead.id, action: 'lead_skipped',
      senderName, source: 'slack',
      intentLabel, dealTier, replyPreview: null,
    })
  } else {
    void logActivity({
      userId, leadId: lead.id, action: 'lead_received',
      senderName, source: 'slack',
      intentLabel, dealTier, replyPreview: null,
    })
  }

  // Slack reply, auto-reply only if AI scoring succeeded
  if (result) {
    // Post AI result as threaded reply in Slack
    try {
      const blocks = formatLeadResponse(result.score, senderName, lead.id)

      await slack.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: `Lead from ${senderName} — ${result.score.intent_label.toUpperCase()} intent`,
        blocks: warning
          ? [...blocks, { type: 'context', elements: [{ type: 'mrkdwn', text: `_${warning}_` }] }]
          : blocks,
      })
    } catch (err) {
      console.error('Failed to post lead result to Slack:', err)
    }

    // Auto-reply in Slack thread if enabled (only for HIGH and MEDIUM intent)
    if (
      profile.auto_reply_enabled &&
      result.score.suggested_reply &&
      result.score.intent_label !== 'low'
    ) {
      const { allowed: replyAllowed } = await canSendReply(userId)
      if (replyAllowed) {
        try {
          await withRetry(
            () => slack.chat.postMessage({
              channel: event.channel,
              thread_ts: event.ts,
              text: result.score.suggested_reply,
            }),
            { label: 'slack-auto-reply', maxAttempts: 2 }
          )

          await supabase
            .from('leads')
            .update({ reply_sent: true, reply_sent_at: new Date().toISOString() })
            .eq('id', lead.id)
          await supabase.rpc('increment_replies_sent', { p_user_id: userId })

          // Log auto-reply activity
          void logActivity({
            userId, leadId: lead.id, action: 'reply_auto_sent',
            senderName, source: 'slack',
            intentLabel, dealTier,
            replyPreview: result.score.suggested_reply,
          })
        } catch (err) {
          console.error('Slack auto-reply failed:', err)
        }
      }
    }

    // Push notification for HIGH intent leads
    if (intentLabel === 'high') {
      const summaryLine = result.score.summary_bullets?.slice(0, 2).join(' | ') || ''
      const tierLabel = dealTier && dealTier !== 'unknown'
        ? ` | ${dealTier === 'enterprise' ? '$50k+' : dealTier === 'mid-high' ? '$10-50k' : dealTier === 'mid' ? '$2-10k' : '<$2k'}`
        : ''
      void sendPushToUser(userId, {
        title: `HIGH intent — ${senderName}`,
        body: `${summaryLine}${tierLabel}${profile.auto_reply_enabled ? ' | Reply auto-sent' : ''}`,
        tag: `lead-${lead.id}`,
        url: `/dashboard?lead=${lead.id}`,
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'Review Lead' },
        ],
        data: { leadId: lead.id },
      })
    }
  } else {
    // AI failed — notify in Slack that scoring didn't work
    try {
      await slack.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: 'New lead received but scoring is temporarily unavailable. Check your dashboard.',
      })
    } catch { /* best effort */ }
  }
}
