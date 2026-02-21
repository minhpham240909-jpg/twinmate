import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

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

  const subscription = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Upsert subscription — replace if same user+endpoint already exists
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    )

  if (error) {
    console.error('[push] Failed to save subscription:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  // Enable push in profile
  await supabase
    .from('profiles')
    .update({ push_enabled: true })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
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

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null

  if (endpoint) {
    // Delete specific subscription
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
  } else {
    // Delete all subscriptions for this user
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
  }

  // Check if any subscriptions remain
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) === 0) {
    await supabase
      .from('profiles')
      .update({ push_enabled: false })
      .eq('id', user.id)
  }

  return NextResponse.json({ ok: true })
}
