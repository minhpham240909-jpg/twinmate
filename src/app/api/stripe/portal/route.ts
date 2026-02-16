import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[Stripe Portal] Failed to create session:', err)
    return NextResponse.json({ error: 'Failed to open billing portal. Please try again.' }, { status: 500 })
  }
}
