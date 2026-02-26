import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { PLANS } from '@/lib/stripe/plans'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 20

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Create or reuse Stripe customer (atomic: use DB constraint to prevent duplicates)
  let customerId = profile.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email || user.email,
      metadata: { user_id: user.id },
    })
    customerId = customer.id

    // stripe_customer_id has a UNIQUE constraint — if another request already set it,
    // this update matches 0 rows (safe). Re-read to use whichever was set first.
    const { data: updated } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .single()

    if (!updated) {
      // Another request already set a customer ID — use that one instead
      const { data: refetched } = await admin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()
      customerId = refetched?.stripe_customer_id || customerId
    }
  }

  // Validate price ID is set
  if (!PLANS.PRO.priceId) {
    console.error('[Stripe Checkout] STRIPE_PRO_PRICE_ID is not set')
    return NextResponse.json({ error: 'Payment configuration error' }, { status: 500 })
  }

  // Create checkout session
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PLANS.PRO.priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
      metadata: { user_id: user.id },
    })

    console.log(`[Stripe Checkout] Session created for user ${user.id}: ${session.id}`)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[Stripe Checkout] Failed to create session:', errMsg, err)
    return NextResponse.json({ error: `Failed to start checkout: ${errMsg}` }, { status: 500 })
  }
}
