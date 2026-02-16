import { createClient } from '@/lib/supabase/server'
import { scoreLead } from '@/lib/ai/score-lead'
import { NextResponse } from 'next/server'
import { aiRateLimit, safeRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

// Internal-only AI scoring endpoint for testing
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await safeRateLimit(aiRateLimit, user.id)
  if (!success) {
    return NextResponse.json({ error: 'Rate limited. Try again shortly.' }, { status: 429 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { message, source = 'slack', senderName } = body

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('niche, tone, booking_link, business_name, custom_instructions')
    .eq('id', user.id)
    .single()

  try {
    const result = await scoreLead({
      message,
      source,
      senderName,
      profile: {
        niche: profile?.niche || 'other',
        tone: profile?.tone || 'professional',
        bookingLink: profile?.booking_link || undefined,
        businessName: profile?.business_name || undefined,
        customInstructions: profile?.custom_instructions || undefined,
      },
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI scoring failed:', err)
    return NextResponse.json({ error: 'AI scoring failed. Please try again.' }, { status: 500 })
  }
}
