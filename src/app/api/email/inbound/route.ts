import { createAdminClient } from '@/lib/supabase/admin'
import { parseInboundEmail } from '@/lib/email/parse'
import { scoreLead } from '@/lib/ai/score-lead'
import { canProcessLead, canSendReply } from '@/lib/stripe/helpers'
import { emailRateLimit, safeRateLimit } from '@/lib/rate-limit'
import { createSlackClient } from '@/lib/slack/client'
import { formatLeadResponse } from '@/lib/slack/format'
import { sendEmailReply, extractReplySubject } from '@/lib/email/send'

export async function POST(request: Request) {
  // SendGrid sends multipart form data
  const formData = await request.formData()
  const parsed = parseInboundEmail(formData)

  // Discard spam
  if (parsed.spamScore > 5.0) {
    return new Response('OK', { status: 200 })
  }

  // Discard empty sender (malformed emails)
  if (!parsed.from || !parsed.from.includes('@')) {
    return new Response('OK', { status: 200 })
  }

  // Prevent email loops — ignore emails from any Adecis inbound address
  if (parsed.from.includes('@inbound.clerva.app')) {
    return new Response('OK', { status: 200 })
  }

  const supabase = createAdminClient()

  // Look up user by inbound email address
  const { data: emailRecord } = await supabase
    .from('email_addresses')
    .select('user_id, is_active')
    .eq('inbound_address', parsed.to)
    .single()

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
  const { allowed } = await canProcessLead(userId)
  if (!allowed) {
    return new Response('OK', { status: 200 })
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('niche, tone, booking_link, business_name, custom_instructions, auto_reply_enabled, reply_from_name')
    .eq('id', userId)
    .single()

  if (!profile) {
    return new Response('OK', { status: 200 })
  }

  // Combine subject + body for scoring
  const fullMessage = parsed.subject
    ? `Subject: ${parsed.subject}\n\n${parsed.textBody}`
    : parsed.textBody

  // Score the lead — wrapped so AI failures don't crash the handler
  let result
  try {
    result = await scoreLead({
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
    })
  } catch (err) {
    console.error('AI scoring failed for email lead:', err)
    return new Response('OK', { status: 200 })
  }

  // Store lead
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
      intent_score: result.score.intent_score,
      intent_label: result.score.intent_label,
      summary_bullets: result.score.summary_bullets,
      suggested_reply: result.score.suggested_reply,
      model_used: result.model,
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      ai_latency_ms: result.latencyMs,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Failed to insert email lead:', insertError)
    return new Response('OK', { status: 200 })
  }

  // Increment usage counter
  await supabase.rpc('increment_leads_used', { p_user_id: userId })

  // Auto-reply via email if enabled (only for HIGH and MEDIUM intent)
  if (
    lead &&
    profile.auto_reply_enabled &&
    result.score.suggested_reply &&
    result.score.intent_label !== 'low'
  ) {
    const { allowed: replyAllowed } = await canSendReply(userId)
    if (replyAllowed) {
      try {
        const replySubject = extractReplySubject(fullMessage)
        const fromName = profile.reply_from_name || profile.business_name || 'Adecis'

        await sendEmailReply({
          to: parsed.from,
          fromAddress: parsed.to,
          fromName,
          subject: replySubject,
          body: result.score.suggested_reply,
        })

        // Mark reply as sent and increment counter
        await supabase
          .from('leads')
          .update({ reply_sent: true, reply_sent_at: new Date().toISOString() })
          .eq('id', lead.id)
        await supabase.rpc('increment_replies_sent', { p_user_id: userId })
      } catch (err) {
        console.error('Auto-reply email failed:', err)
      }
    }
  }

  // Deliver to Slack if connected
  if (lead) {
    const { data: installation } = await supabase
      .from('slack_installations')
      .select('bot_token, monitored_channels')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (installation) {
      try {
        const slack = createSlackClient(installation.bot_token)
        const channel =
          installation.monitored_channels?.[0]

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

  return new Response('OK', { status: 200 })
}
