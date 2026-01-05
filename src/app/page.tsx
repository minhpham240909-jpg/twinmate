import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  // Server-side auth check - instant redirect, no page flash
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  // Redirect to auth page for non-authenticated users
  redirect('/auth')
}
