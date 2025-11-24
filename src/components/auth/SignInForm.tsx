'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignInForm() {
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')
  const supabase = createClient()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true, // Default to true (better UX - most users want to stay logged in)
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    console.log('[SignIn] Starting signin process...')
    console.log('[SignIn] Email:', formData.email)

    try {
      // First check via API if account exists (provides better error messages)
      console.log('[SignIn] Checking account existence via API...')
      const apiResponse = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const apiData = await apiResponse.json()

      if (!apiResponse.ok) {
        console.error('[SignIn] API error:', apiData.error)
        setError(apiData.error || 'Invalid credentials')
        setLoading(false)
        return
      }

      // If API check passed, proceed with client-side Supabase signin
      console.log('[SignIn] Calling Supabase signInWithPassword...')
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      console.log('[SignIn] Supabase response:', {
        hasUser: !!data.user,
        hasSession: !!data.session,
        error: signInError
      })

      if (signInError) {
        console.error('[SignIn] Authentication error:', signInError)
        setError(signInError.message || 'Invalid credentials')
        setLoading(false)
        return
      }

      if (!data.user) {
        console.error('[SignIn] No user returned from Supabase')
        setError('Sign in failed. Please try again.')
        setLoading(false)
        return
      }

      console.log('[SignIn] ✅ Sign in successful! User:', data.user.email)

      // Handle "Remember Me" functionality
      if (data.session && !formData.rememberMe) {
        console.log('[SignIn] Remember me is OFF - moving session to sessionStorage')
        // User doesn't want to be remembered - use sessionStorage instead of localStorage
        // This means the session will be cleared when the browser closes

        try {
          // Get the session data
          const sessionData = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
            user: data.session.user,
          }

          // Store in sessionStorage (will be cleared when browser closes)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('sb-session', JSON.stringify(sessionData))

            // Clear from localStorage to ensure session doesn't persist
            const localStorageKeys = Object.keys(localStorage)
            localStorageKeys.forEach(key => {
              if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token')) {
                localStorage.removeItem(key)
              }
            })
          }
        } catch (storageError) {
          console.error('[SignIn] Error managing session storage:', storageError)
          // Continue anyway - worst case they stay logged in (not critical)
        }
      } else {
        console.log('[SignIn] Remember me is ON - session will persist in localStorage')
        // rememberMe is true (default) - Supabase already stores in localStorage by default
        // No action needed - the session will persist across browser restarts
      }

      console.log('[SignIn] Waiting for session to stabilize...')
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log('[SignIn] ✅ Redirecting to dashboard...')

      // Force a full page navigation to ensure everything reloads
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('[SignIn] Unexpected error:', err)
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="w-full">
      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-xl border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-6">Welcome Back</h2>

        {registered && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 text-sm backdrop-blur-sm">
            Account created successfully! Please sign in.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 text-white placeholder-slate-400 transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 text-white placeholder-slate-400 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
              />
              <span className="ml-2 text-sm text-slate-300">Remember me</span>
            </label>
            <Link href="/auth/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900/80 text-slate-400">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="mt-4 w-full py-3 bg-white/5 border border-white/10 rounded-lg font-semibold text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-300">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}