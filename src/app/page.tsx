import { redirect } from 'next/navigation'

export default async function HomePage() {
  // CLERVA 2.0: Direct to dashboard for all users
  // Guests can use the app with 3 free trials, no signup needed
  // Auth page is still accessible via /auth for users who want to sign up
  redirect('/dashboard')
}
