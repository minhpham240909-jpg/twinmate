'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Initializing...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('Reading authentication code...')
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (!code) {
          setError('No authentication code found')
          setTimeout(() => router.push('/auth/signin'), 2000)
          return
        }

        setStatus('Establishing session...')
        const supabase = createClient()

        // Exchange code for session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          console.error('Exchange error:', exchangeError)
          setError(exchangeError.message)
          setTimeout(() => router.push('/auth/signin'), 2000)
          return
        }

        setStatus('Session established! Redirecting...')

        // Wait a moment for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Use window.location.href for a full page redirect
        // This ensures all cookies and session data are properly loaded
        window.location.href = '/dashboard'

      } catch (err) {
        console.error('Callback error:', err)
        setError('An unexpected error occurred')
        setTimeout(() => router.push('/auth/signin'), 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center max-w-md mx-auto p-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="text-red-600">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-semibold mb-2">Authentication Error</p>
              <p className="text-sm">{error}</p>
              <p className="mt-4 text-xs text-gray-600">Redirecting to sign in...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg font-medium text-gray-900">{status}</p>
            <p className="mt-2 text-sm text-gray-500">Please wait...</p>
          </div>
        )}
      </div>
    </div>
  )
}
