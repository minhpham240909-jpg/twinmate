import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_TONES = ['professional', 'casual', 'friendly']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate and sanitize — only allow known string fields with length limits
  const businessName = typeof body.business_name === 'string' ? body.business_name.slice(0, 200) : null
  const niche = typeof body.niche === 'string' ? body.niche.slice(0, 100) : null
  const tone = typeof body.tone === 'string' && VALID_TONES.includes(body.tone) ? body.tone : 'professional'
  const bookingLink = typeof body.booking_link === 'string' ? body.booking_link.slice(0, 500) : null
  const customInstructions = typeof body.custom_instructions === 'string' ? body.custom_instructions.slice(0, 500) : null
  const autoReplyEnabled = typeof body.auto_reply_enabled === 'boolean' ? body.auto_reply_enabled : false
  const replyFromName = typeof body.reply_from_name === 'string' ? body.reply_from_name.slice(0, 100) : null

  const { error } = await supabase
    .from('profiles')
    .update({
      business_name: businessName,
      niche,
      tone,
      booking_link: bookingLink,
      custom_instructions: customInstructions,
      auto_reply_enabled: autoReplyEnabled,
      reply_from_name: replyFromName,
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
