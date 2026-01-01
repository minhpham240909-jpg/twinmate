import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPageClient from '@/components/landing/LandingPageClient'

export default async function HomePage() {
  // Server-side auth check - instant redirect, no page flash
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  // Only render landing page if user is NOT authenticated
  return <LandingPageClient />
}
