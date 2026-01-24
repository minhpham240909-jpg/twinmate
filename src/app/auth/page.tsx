'use client'

import { useState, useMemo, Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Hook to fetch pre-auth CSRF token
function usePreAuthCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch('/api/csrf/pre-auth', {
          credentials: 'include', // Ensure cookies are sent and received
        })
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type')
        if (response.ok && contentType?.includes('application/json')) {
          const data = await response.json()
          setCsrfToken(data.csrfToken)
        }
      } catch {
        // Silently handle - likely a redirect or auth issue
      }
    }
    fetchToken()
  }, [])

  return csrfToken
}

// Password strength calculation
interface PasswordStrength {
  score: number
  label: string
  color: string
  bgColor: string
  feedback: string[]
}

function calculatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  if (!password) {
    return { score: 0, label: '', color: 'text-slate-400', bgColor: 'bg-slate-200', feedback: [] }
  }

  if (password.length >= 8) score += 1
  else feedback.push('At least 8 characters')

  if (password.length >= 12) score += 1

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  else feedback.push('Mix of uppercase & lowercase')

  if (/\d/.test(password)) score += 0.5
  else feedback.push('At least one number')

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 0.5
  else feedback.push('At least one special character')

  const commonPatterns = ['password', '123456', 'qwerty', 'abc123', 'letmein']
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    score = Math.max(0, score - 2)
    feedback.push('Avoid common patterns')
  }

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 0.5)
    feedback.push('Avoid repeated characters')
  }

  const normalizedScore = Math.min(4, Math.floor(score))

  const strengthLevels: Record<number, Omit<PasswordStrength, 'score' | 'feedback'>> = {
    0: { label: 'Very Weak', color: 'text-red-600', bgColor: 'bg-red-500' },
    1: { label: 'Weak', color: 'text-orange-600', bgColor: 'bg-orange-500' },
    2: { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-500' },
    3: { label: 'Good', color: 'text-lime-600', bgColor: 'bg-lime-500' },
    4: { label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500' },
  }

  return {
    score: normalizedScore,
    ...strengthLevels[normalizedScore],
    feedback: feedback.slice(0, 3),
  }
}

function AuthPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const csrfToken = usePreAuthCsrfToken()

  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin'
  const registered = searchParams.get('registered')

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab)

  // Sign In state
  const [signInData, setSignInData] = useState({ email: '', password: '' })
  const [signInError, setSignInError] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')

  // Sign Up state
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [signUpError, setSignUpError] = useState('')
  const [signUpLoading, setSignUpLoading] = useState(false)
  const [showPasswordStrength, setShowPasswordStrength] = useState(false)

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(signUpData.password),
    [signUpData.password]
  )

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignInError('')
    setSignInLoading(true)

    try {
      // Step 1: Call API for rate limiting, lockout check, and 2FA verification
      const apiResponse = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent (needed for CSRF)
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
        body: JSON.stringify({
          email: signInData.email,
          password: signInData.password,
          twoFactorCode: requires2FA ? twoFactorCode : undefined,
        }),
      })

      const apiData = await apiResponse.json()

      if (apiData.requires2FA) {
        setRequires2FA(true)
        setSignInLoading(false)
        return
      }

      if (!apiResponse.ok) {
        setSignInError(apiData.error || 'Sign in failed')
        setSignInLoading(false)
        return
      }

      // Step 2: Sign in with Supabase client to set browser cookies
      // This is the CRITICAL step that establishes the session for middleware
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: signInData.email,
        password: signInData.password,
      })

      if (signInError) {
        if (signInError.message?.includes('Invalid login credentials')) {
          setSignInError('Invalid email or password')
        } else if (signInError.message?.includes('Email not confirmed')) {
          setSignInError('Please verify your email before signing in')
        } else {
          setSignInError(signInError.message || 'Invalid credentials')
        }
        setSignInLoading(false)
        return
      }

      if (!data.user || !data.session) {
        setSignInError('Sign in failed. Please try again.')
        setSignInLoading(false)
        return
      }

      // Step 3: Wait for session to be fully established
      // Poll until getSession returns the session (cookies are set)
      let sessionVerified = false
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200))
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          sessionVerified = true
          break
        }
      }

      if (!sessionVerified) {
        console.warn('[Auth] Session verification timeout, proceeding anyway')
      }

      // Step 4: Check if user is admin
      const userCheckResponse = await fetch('/api/admin/check')
      const userCheckData = await userCheckResponse.json()
      const redirectUrl = userCheckData.isAdmin ? '/admin' : '/dashboard'

      // Step 5: Navigate using full page reload to ensure cookies are sent
      // This is more reliable than router.push() for auth state changes
      window.location.href = redirectUrl
    } catch (err) {
      console.error('[Auth] Sign in error:', err)
      setSignInError('Network error. Please try again.')
      setSignInLoading(false)
    }
  }

  const handleBackFrom2FA = () => {
    setRequires2FA(false)
    setTwoFactorCode('')
    setSignInError('')
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignUpError('')

    if (signUpData.password !== signUpData.confirmPassword) {
      setSignUpError('Passwords do not match')
      return
    }

    if (signUpData.password.length < 8) {
      setSignUpError('Password must be at least 8 characters')
      return
    }

    setSignUpLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent (needed for CSRF)
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
        body: JSON.stringify({
          name: signUpData.name,
          email: signUpData.email,
          password: signUpData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSignUpError(data.error || 'Something went wrong')
        setSignUpLoading(false)
        return
      }

      router.push(`/auth/confirm-email?email=${encodeURIComponent(signUpData.email)}`)
    } catch (err) {
      setSignUpError('Network error. Please try again.')
      setSignUpLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding & 3 AI Tools Showcase */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        </div>

        {/* Subtle dot pattern overlay */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-xl blur-lg" />
              <Image
                src="/logo.png"
                alt="Clerva"
                width={48}
                height={48}
                className="relative rounded-xl"
              />
            </div>
            <span className="text-2xl font-bold text-white">Clerva</span>
          </div>

          {/* Main content - 3 AI Tools Cards */}
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            {/* Tagline */}
            <div className="text-center mb-10">
              <h1 className="text-3xl xl:text-4xl font-bold text-white mb-3">
                Your AI Study Partner
              </h1>
              <p className="text-slate-400 text-lg max-w-md">
                3 powerful tools to help you learn faster and remember longer
              </p>
            </div>

            {/* 3 Tool Cards */}
            <div className="w-full max-w-sm space-y-4">
              {/* Tool 1: Explain Pack - Lightbulb icon */}
              <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
                    {/* Lightbulb - represents understanding/clarity */}
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Explain Pack</h3>
                    <p className="text-sm text-slate-400">Get clear explanations in 5 minutes</p>
                  </div>
                </div>
              </div>

              {/* Tool 2: Test Prep Sprint - Brain icon */}
              <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-110 transition-transform">
                    {/* Brain - represents memory/learning */}
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
                      <path d="M12 18v4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Test Prep Sprint</h3>
                    <p className="text-sm text-slate-400">Smart flashcards for quick review</p>
                  </div>
                </div>
              </div>

              {/* Tool 3: Guide Me - Compass/Map icon */}
              <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-green-500/50 hover:bg-white/10 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25 group-hover:scale-110 transition-transform">
                    {/* Compass - represents guidance/direction */}
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Guide Me</h3>
                    <p className="text-sm text-slate-400">Step-by-step help without answers</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Try Free Badge */}
            <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/10 rounded-full">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm font-medium text-white">Try 3 times free, no signup needed</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-slate-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Clerva. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col bg-white">
        {/* Mobile header with logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 py-6 border-b border-slate-100">
          <Image
            src="/logo.png"
            alt="Clerva"
            width={40}
            height={40}
            className="rounded-xl"
          />
          <span className="text-xl font-bold text-slate-900">Clerva</span>
        </div>

        {/* Auth Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-8">
              <button
                onClick={() => {
                  setActiveTab('signin')
                  setSignInError('')
                  setSignUpError('')
                }}
                className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setActiveTab('signup')
                  setSignInError('')
                  setSignUpError('')
                }}
                className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Sign In Form */}
            {activeTab === 'signin' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                  <p className="text-slate-500 mt-1">Sign in to access your AI study tools</p>
                </div>

                {registered && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Account created successfully! Please sign in.</span>
                  </div>
                )}

                {signInError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span>{signInError}</span>
                  </div>
                )}

                {/* Google Sign In - First */}
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-400">or</span>
                  </div>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  {!requires2FA ? (
                    <>
                      <div>
                        <label htmlFor="signin-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                          Email
                        </label>
                        <input
                          id="signin-email"
                          type="email"
                          required
                          value={signInData.email}
                          onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none"
                          placeholder="you@example.com"
                        />
                      </div>

                      <div>
                        <label htmlFor="signin-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                          Password
                        </label>
                        <input
                          id="signin-password"
                          type="password"
                          required
                          value={signInData.password}
                          onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none"
                          placeholder="Enter your password"
                        />
                      </div>

                      <div className="flex items-center justify-end">
                        <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                          Forgot password?
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <span>Two-factor authentication is enabled. Enter your 6-digit code.</span>
                      </div>
                      <label htmlFor="twoFactorCode" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Authentication Code
                      </label>
                      <input
                        id="twoFactorCode"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        autoFocus
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none text-center text-2xl tracking-[0.5em] font-mono"
                        placeholder="000000"
                      />
                      <button
                        type="button"
                        onClick={handleBackFrom2FA}
                        className="mt-4 text-sm text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to sign in
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={signInLoading || (requires2FA && twoFactorCode.length !== 6)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/25"
                  >
                    {signInLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </span>
                    ) : requires2FA ? 'Verify' : 'Sign In'}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Protected by our{' '}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                    Privacy Policy
                  </Link>
                </p>
              </div>
            )}

            {/* Sign Up Form */}
            {activeTab === 'signup' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
                  <p className="text-slate-500 mt-1">Get unlimited access to all AI study tools</p>
                </div>

                {signUpError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span>{signUpError}</span>
                  </div>
                )}

                {/* Google Sign Up - First */}
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-400">or</span>
                  </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={signUpData.name}
                      onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      required
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Password
                    </label>
                    <input
                      id="signup-password"
                      type="password"
                      required
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      onFocus={() => setShowPasswordStrength(true)}
                      onBlur={() => setShowPasswordStrength(signUpData.password.length > 0)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none"
                      placeholder="Create a strong password"
                    />

                    {showPasswordStrength && signUpData.password && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 flex gap-1">
                            {[0, 1, 2, 3].map((index) => (
                              <div
                                key={index}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                  index < passwordStrength.score
                                    ? passwordStrength.bgColor
                                    : 'bg-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className={`text-xs font-medium ${passwordStrength.color}`}>
                            {passwordStrength.label}
                          </span>
                        </div>

                        {passwordStrength.feedback.length > 0 && (
                          <ul className="text-xs text-slate-500 space-y-1">
                            {passwordStrength.feedback.map((tip, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="signup-confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      id="signup-confirmPassword"
                      type="password"
                      required
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 transition-all outline-none"
                      placeholder="Confirm your password"
                    />
                    {signUpData.confirmPassword && signUpData.password !== signUpData.confirmPassword && (
                      <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Passwords do not match
                      </p>
                    )}
                    {signUpData.confirmPassword && signUpData.password === signUpData.confirmPassword && (
                      <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Passwords match
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={signUpLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/25"
                  >
                    {signUpLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating account...
                      </span>
                    ) : 'Create Account'}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  By creating an account, you agree to our{' '}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                    Privacy Policy
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden py-4 text-center border-t border-slate-100">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Clerva. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
