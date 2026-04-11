import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseInboundEmail, type ParsedEmail } from '@/lib/email/parse'
import { scoreLeadSmart, type SmartScoreResult } from '@/lib/ai/score-lead'
import { canProcessLead, canSendReply } from '@/lib/stripe/helpers'
import { emailRateLimit, safeRateLimit, isDuplicateEmail } from '@/lib/rate-limit'
import { createSlackClient } from '@/lib/slack/client'
import { formatLeadResponse } from '@/lib/slack/format'
import { sendEmailReply, extractReplySubject } from '@/lib/email/send'
import { logActivity } from '@/lib/activity'
import { sendPushToUser } from '@/lib/push'
import { withRetry } from '@/lib/retry'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  // SendGrid sends multipart form data
  const formData = await request.formData()
  const parsed = parseInboundEmail(formData)

  console.log('[inbound] Received email:', {
    from: parsed.from,
    to: parsed.to,
    subject: parsed.subject,
    spamScore: parsed.spamScore,
    bodyLength: parsed.textBody?.length || 0,
  })

  // Discard spam
  if (parsed.spamScore > 5.0) {
    console.log('[inbound] Discarded: spam score', parsed.spamScore)
    return new Response('OK', { status: 200 })
  }

  // Discard empty sender (malformed emails)
  if (!parsed.from || !parsed.from.includes('@')) {
    console.log('[inbound] Discarded: empty/invalid sender', parsed.from)
    return new Response('OK', { status: 200 })
  }

  // Prevent email loops — ignore emails from any Clerva inbound address
  if (parsed.from.includes('@inbound.clerva.app')) {
    console.log('[inbound] Discarded: loop prevention', parsed.from)
    return new Response('OK', { status: 200 })
  }

  // Email deduplication — prevent duplicate leads on SendGrid retries
  if (await isDuplicateEmail(parsed.from, parsed.subject || '', parsed.textBody || '')) {
    console.log('[inbound] Discarded: duplicate email', parsed.from, parsed.subject)
    return new Response('OK', { status: 200 })
  }

  const supabase = createAdminClient()

  // Look up user by inbound email address
  const { data: emailRecord, error: lookupError } = await supabase
    .from('email_addresses')
    .select('user_id, is_active')
    .eq('inbound_address', parsed.to)
    .single()

  console.log('[inbound] User lookup for', parsed.to, ':', emailRecord ? `found user ${emailRecord.user_id}` : 'NOT FOUND', lookupError?.message || '')

  if (!emailRecord || !emailRecord.is_active) {
    return new Response('OK', { status: 200 })
  }

  const userId = emailRecord.user_id

  // Rate limit (safe — allows through if Redis is down)
  const { success: rateLimitOk } = await safeRateLimit(emailRateLimit, userId)
  if (!rateLimitOk) {
    return new Response('OK', { status: 200 })
  }

  // Subscription check
  const { allowed, reason } = await canProcessLead(userId)
  if (!allowed) {
    console.log('[inbound] Blocked by canProcessLead:', reason, '| user:', userId)
    return new Response('OK', { status: 200 })
  }

  // Acknowledge immediately — process in background so SendGrid doesn't retry
  waitUntil(
    processEmailLead(parsed, userId).catch((err) => {
      console.error('Failed to process email lead:', err)
    })
  )

  return new Response('OK', { status: 200 })
}

async function processEmailLead(parsed: ParsedEmail, userId: string) {
  const supabase = createAdminClient()

  // Get user profile (single query — includes email for reply-to)
  interface ProfileData {
    email: string | null
    niche: string | null
    tone: string | null
    booking_link: string | null
    business_name: string | null
    custom_instructions: string | null
    auto_reply_enabled: boolean
    reply_from_name: string | null
  }
  let profile: ProfileData | null = null

  const { data: fullProfile, error: profileError } = await supabase
    .from('profiles')
    .select('email, niche, tone, booking_link, business_name, custom_instructions, auto_reply_enabled, reply_from_name')
    .eq('id', userId)
    .single()

  if (fullProfile) {
    profile = fullProfile as unknown as ProfileData
  } else if (profileError) {
    const { data: basicProfile } = await supabase
      .from('profiles')
      .select('email, niche, tone, booking_link, business_name, custom_instructions')
      .eq('id', userId)
      .single()
    if (basicProfile) {
      const bp = basicProfile as unknown as Omit<ProfileData, 'auto_reply_enabled' | 'reply_from_name'>
      profile = { ...bp, auto_reply_enabled: false, reply_from_name: null }
    }
  }

  if (!profile) {
    console.error('[inbound] No profile found for user:', userId)
    return
  }

  // Combine subject + body for scoring
  const fullMessage = parsed.subject
    ? `Subject: ${parsed.subject}\n\n${parsed.textBody}`
    : parsed.textBody

  // Smart scoring: pre-filter spam → check cache → call Claude API
  let smartResult: SmartScoreResult | null = null
  try {
    smartResult = await withRetry(
      () => scoreLeadSmart({
        message: fullMessage,
        source: 'email',
        senderName: parsed.senderName,
        profile: {
          niche: profile.niche || 'other',
          tone: profile.tone || 'professional',
          bookingLink: profile.booking_link || undefined,
          businessName: profile.business_name || undefined,
          customInstructions: profile.custom_instructions || undefined,
          replyFromName: profile.reply_from_name || undefined,
        },
      }),
      { label: 'ai-score-email', maxAttempts: 2 }
    )
  } catch (err) {
    console.error('AI scoring failed for email lead — inserting without score:', err)
  }

  // Pre-filtered messages (spam/junk) — skip entirely, no quota used, no lead inserted
  if (smartResult?.filtered) {
    console.log('[inbound] Pre-filtered, skipping:', smartResult.reason)
    return
  }

  // Extract the score result (null if AI failed entirely)
  const result = smartResult && !smartResult.filtered ? smartResult.result : null

  // Atomic quota reservation — check AND increment in one locked transaction
  // This prevents the race condition where two concurrent leads both pass the quota check
  const { data: quotaOk } = await supabase.rpc('try_use_lead', { p_user_id: userId })
  if (quotaOk === false) {
    console.log('[inbound] Quota exceeded for user:', userId)
    return
  }

  // Insert lead — fully scored if AI succeeded, raw message only if it failed
  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert({
      user_id: userId,
      source: 'email',
      source_id: parsed.from,
      source_channel: parsed.to,
      sender_name: parsed.senderName,
      sender_identifier: parsed.from,
      raw_message: fullMessage,
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
    console.error('Failed to insert email lead:', insertError)
    return
  }

  const intentLabel = result?.score.intent_label || null
  const dealTier = result?.score.deal_tier || null

  // Log "lead_received" activity (or "lead_skipped" for low intent with no reply)
  if (result && intentLabel === 'low') {
    void logActivity({
      userId, leadId: lead.id, action: 'lead_skipped',
      senderName: parsed.senderName, source: 'email',
      intentLabel, dealTier, replyPreview: null,
    })
  } else {
    void logActivity({
      userId, leadId: lead.id, action: 'lead_received',
      senderName: parsed.senderName, source: 'email',
      intentLabel, dealTier, replyPreview: null,
    })
  }

  // Auto-reply and Slack notification only if AI scoring succeeded
  if (result) {
    // Auto-reply via email if enabled (only for HIGH and MEDIUM intent)
    if (
      profile.auto_reply_enabled &&
      result.score.suggested_reply &&
      result.score.intent_label !== 'low'
    ) {
      const { allowed: replyAllowed } = await canSendReply(userId)
      if (replyAllowed) {
        try {
          const replySubject = extractReplySubject(fullMessage)
          const fromName = profile.reply_from_name || profile.business_name || 'Clerva'
          const replyToAddress = profile.email || parsed.to

          await withRetry(
            () => sendEmailReply({
              to: parsed.from,
              fromAddress: replyToAddress,
              fromName,
              subject: replySubject,
              body: result.score.suggested_reply,
            }),
            { label: 'sendgrid-auto-reply', maxAttempts: 2 }
          )

          await supabase
            .from('leads')
            .update({ reply_sent: true, reply_sent_at: new Date().toISOString() })
            .eq('id', lead.id)
          await supabase.rpc('increment_replies_sent', { p_user_id: userId })

          // Log auto-reply activity
          void logActivity({
            userId, leadId: lead.id, action: 'reply_auto_sent',
            senderName: parsed.senderName, source: 'email',
            intentLabel, dealTier,
            replyPreview: result.score.suggested_reply,
          })
        } catch (err) {
          console.error('Auto-reply email failed:', err)
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
        title: `HIGH intent — ${parsed.senderName}`,
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

    // Deliver to Slack if connected
    const { data: installation } = await supabase
      .from('slack_installations')
      .select('bot_token, monitored_channels')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (installation) {
      try {
        const slack = createSlackClient(installation.bot_token)
        const channel = installation.monitored_channels?.[0]

        if (channel) {
          const blocks = formatLeadResponse(
            result.score,
            parsed.senderName,
            lead.id,
            'email'
          )
          await slack.chat.postMessage({
            channel,
            text: `New email lead from ${parsed.senderName} — ${result.score.intent_label.toUpperCase()} intent`,
            blocks,
          })
        }
      } catch (err) {
        console.error('Failed to notify Slack for email lead:', err)
      }
    }
  }
}
