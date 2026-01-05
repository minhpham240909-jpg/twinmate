'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import GlowBorder from '@/components/ui/GlowBorder'
import FastPulse from '@/components/ui/FastPulse'
import FastFadeIn from '@/components/ui/FastFadeIn'
import FastBounce from '@/components/ui/FastBounce'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast.error(t('pleaseEnterEmail'))
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setEmailSent(true)
        toast.success(t('passwordResetEmailSent'))
      } else {
        toast.error(data.error || t('failedToSendResetEmail'))
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      toast.error(t('failedToSendResetEmail'))
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        <FastFadeIn delay={0.1}>
          <GlowBorder color="#34d399" intensity="medium" animated={false}  style={{ borderRadius: 16 }}>
            <div className="max-w-md w-full bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
              <div className="text-center">
                <FastBounce delay={0.1}>
                  <FastPulse>
                    <div className="w-16 h-16 bg-green-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                      </svg>
                    </div>
                  </FastPulse>
                </FastBounce>
                <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
                <p className="text-slate-300 mb-6">
                  If an account with <span className="font-semibold text-white">{email}</span> exists, we've sent a password reset link. Please check your inbox and spam folder.
                </p>
                <FastBounce delay={0.2}>
                  <Link
                    href="/auth"
                    className="block w-full py-3 px-4 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 hover:bg-blue-500/30 hover:scale-105 text-blue-300 font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20"
                  >
                    Back to Sign In
                  </Link>
                </FastBounce>
              </div>
            </div>
          </GlowBorder>
        </FastFadeIn>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <FastFadeIn delay={0.1}>
        <GlowBorder color="#60a5fa" intensity="medium" animated={false}  style={{ borderRadius: 16 }}>
          <div className="max-w-md w-full bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
          <p className="text-slate-300">
            No worries! Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
          </div>

            <FastBounce>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 hover:bg-blue-500/30 hover:scale-105 text-blue-300 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-500/20"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </FastBounce>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth"
              className="text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              ← Back to Sign In
            </Link>
          </div>
          </div>
        </GlowBorder>
      </FastFadeIn>
    </div>
  )
}
