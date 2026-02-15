import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Check if address already exists
  const { data: existing } = await admin
    .from('email_addresses')
    .select('inbound_address')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ address: existing.inbound_address })
  }

  // Generate a new address
  const hash = user.id.replace(/-/g, '').substring(0, 10)
  const address = `leads-${hash}@inbound.clerva.app`

  const { error } = await admin.from('email_addresses').insert({
    user_id: user.id,
    inbound_address: address,
  })

  if (error && error.code === '23505') {
    // Unique constraint — re-fetch
    const { data: refetched } = await admin
      .from('email_addresses')
      .select('inbound_address')
      .eq('user_id', user.id)
      .maybeSingle()
    return NextResponse.json({ address: refetched?.inbound_address || null })
  }

  if (error) {
    console.error('Failed to create email address:', error)
    return NextResponse.json({ error: 'Failed to create email address' }, { status: 500 })
  }

  return NextResponse.json({ address })
}
