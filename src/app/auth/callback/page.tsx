'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient()

        // Get the code from URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (!code) {
          setError('No authentication code found')
          router.push('/auth/error')
          return
        }

        // Exchange code for session on the client side
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError || !data.session) {
          console.error('Error exchanging code:', exchangeError)
          setError(exchangeError?.message || 'Failed to establish session')
          router.push('/auth/error')
          return
        }

        // Session is now established, redirect to dashboard immediately
        router.push('/dashboard')

        // Sync user to database in the background (non-blocking)
        // Dashboard will work even if this fails
        fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).then(response => {
          if (response.ok) {
            console.log('User synced to database successfully')
          } else {
            console.warn('Failed to sync user, will retry on next page load')
          }
        }).catch(err => {
          console.error('Sync user error:', err)
        })
      } catch (err) {
        console.error('Callback error:', err)
        setError('An unexpected error occurred')
        router.push('/auth/error')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        {error ? (
          <div className="text-red-600">
            <p className="text-lg font-semibold">Authentication Error</p>
            <p className="mt-2 text-sm">{error}</p>
            <p className="mt-4 text-sm text-gray-600">Redirecting...</p>
          </div>
        ) : (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  )
}
