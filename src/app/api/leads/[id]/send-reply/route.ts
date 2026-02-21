import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSlackClient, getValidBotToken } from '@/lib/slack/client'
import { canSendReply } from '@/lib/stripe/helpers'
import { sendEmailReply, extractReplySubject } from '@/lib/email/send'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check reply quota — single query to profiles
  const { allowed, reason, usage } = await canSendReply(user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: reason, upgrade_required: true, usage },
      { status: 403 }
    )
  }

  // Parse optional custom reply text from body
  let customReply: string | null = null
  try {
    const body = await request.json()
    if (body.customReply && typeof body.customReply === 'string') {
      const trimmed = body.customReply.trim()
      if (trimmed.length > 0 && trimmed.length <= 5000) {
        customReply = trimmed
      }
    }
  } catch {
    // No body or invalid JSON — that's fine, use stored reply
  }

  const admin = createAdminClient()

  // Atomically claim the lead for reply (prevents double-send race condition)
  // Only updates if reply_sent is still false — returns empty if another request already claimed it
  const { data: claimedLead, error: claimError } = await admin
    .from('leads')
    .update({ reply_sent: true, reply_sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('reply_sent', false)
    .select('id, source, suggested_reply, slack_thread_ts, slack_channel_id, sender_identifier, source_channel, raw_message, reply_sent_at')
    .single()

  if (claimError || !claimedLead) {
    // Either lead not found, already sent, or DB error
    const { data: existing } = await admin
      .from('leads')
      .select('reply_sent')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    if (existing.reply_sent) {
      return NextResponse.json({ error: 'Reply already sent' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to process reply' }, { status: 500 })
  }

  // Use custom reply if provided, otherwise fall back to the AI-generated one
  const replyText = customReply || claimedLead.suggested_reply

  if (!replyText) {
    // Undo the claim since there's nothing to send
    await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
    return NextResponse.json(
      { error: 'No suggested reply available' },
      { status: 400 }
    )
  }

  if (claimedLead.source === 'slack') {
    // --- Slack reply ---
    if (!claimedLead.slack_thread_ts || !claimedLead.slack_channel_id) {
      await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
      return NextResponse.json(
        { error: 'Missing Slack thread information for this lead' },
        { status: 400 }
      )
    }

    // Get bot token — single query to slack_installations with auto-refresh
    const botToken = await getValidBotToken(user.id)
    if (!botToken) {
      await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
      return NextResponse.json(
        { error: 'Slack not connected. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // Post reply to Slack thread
    const slack = createSlackClient(botToken)
    try {
      await slack.chat.postMessage({
        channel: claimedLead.slack_channel_id,
        thread_ts: claimedLead.slack_thread_ts,
        text: replyText,
      })
    } catch (err) {
      // Undo the claim since Slack send failed
      await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
      console.error('Failed to send Slack reply:', err)
      return NextResponse.json(
        { error: 'Failed to send reply to Slack. The bot may not have access to this channel.' },
        { status: 502 }
      )
    }
  } else if (claimedLead.source === 'email') {
    // --- Email reply ---
    if (!claimedLead.sender_identifier) {
      await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
      return NextResponse.json(
        { error: 'Missing sender email address for this lead' },
        { status: 400 }
      )
    }

    // Get user profile for reply_from_name
    const { data: profile } = await admin
      .from('profiles')
      .select('reply_from_name, business_name')
      .eq('id', user.id)
      .single()

    const fromName = profile?.reply_from_name || profile?.business_name || 'Adecis'
    const replySubject = extractReplySubject(claimedLead.raw_message || '')

    // Use the user's real email as reply-to so responses go to their inbox
    const replyToAddress = user.email || claimedLead.source_channel || ''

    if (!replyToAddress) {
      await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
      return NextResponse.json(
        { error: 'Missing sender address configuration' },
        { status: 400 }
      )
    }

    try {
      await sendEmailReply({
        to: claimedLead.sender_identifier,
        fromAddress: replyToAddress,
        fromName,
        subject: replySubject,
        body: replyText,
      })
    } catch (err: unknown) {
      // Undo the claim since email send failed
      await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
      // Extract SendGrid error details
      const sgErr = err as { response?: { body?: { errors?: { message: string }[] } }; message?: string }
      const detail = sgErr?.response?.body?.errors?.[0]?.message || sgErr?.message || 'Unknown error'
      console.error('Failed to send email reply:', detail, err)
      return NextResponse.json(
        { error: `Failed to send email reply: ${detail}` },
        { status: 502 }
      )
    }
  } else {
    await admin.from('leads').update({ reply_sent: false, reply_sent_at: null }).eq('id', id)
    return NextResponse.json(
      { error: 'Unsupported lead source' },
      { status: 400 }
    )
  }

  // Increment reply counter (fire-and-forget is OK — atomic SQL)
  await admin.rpc('increment_replies_sent', { p_user_id: user.id })

  // Log manual reply activity
  void logActivity({
    userId: user.id,
    leadId: id,
    action: 'reply_sent',
    senderName: null,
    source: claimedLead.source as 'slack' | 'email',
    intentLabel: null,
    dealTier: null,
    replyPreview: replyText,
  })

  return NextResponse.json({
    ok: true,
    reply_sent: true,
    reply_sent_at: claimedLead.reply_sent_at,
  })
}
