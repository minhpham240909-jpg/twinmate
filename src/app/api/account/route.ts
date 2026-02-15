import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Delete the auth user — cascades to profiles → leads, slack_installations,
  // email_addresses, feedback_log (all have ON DELETE CASCADE)
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('Failed to delete account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    )
  }

  // Sign out the current session
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
