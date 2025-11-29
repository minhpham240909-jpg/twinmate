'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import GlowBorder from '@/components/ui/GlowBorder'
import FastPulse from '@/components/ui/FastPulse'
import FastFadeIn from '@/components/ui/FastFadeIn'
import FastBounce from '@/components/ui/FastBounce'

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const handleResendEmail = async () => {
    if (!email) return

    setResending(true)
    setResendMessage('')

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResendMessage('Confirmation email sent! Please check your inbox.')
      } else {
        setResendMessage(data.error || 'Failed to resend email. Please try again.')
      }
    } catch (error) {
      setResendMessage('Network error. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <FastFadeIn delay={0.1}>
        <GlowBorder color="#60a5fa" intensity="medium" animated={false}  style={{ borderRadius: 12 }}>
          <div className="w-full max-w-md">
            <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-xl shadow-2xl text-center">
              {/* Email Icon */}
              <FastBounce delay={0.1}>
                <FastPulse>
                  <div className="mx-auto w-16 h-16 bg-blue-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </FastPulse>
              </FastBounce>

          <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>

          <p className="text-slate-300 mb-6">
            We've sent a confirmation email to{' '}
            <span className="font-semibold text-white">{email || 'your email address'}</span>
          </p>

          <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-400/30 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-blue-300 mb-2">Next Steps:</h3>
            <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
              <li>Check your email inbox</li>
              <li>Click the confirmation link in the email</li>
              <li>You'll be automatically logged in to your account</li>
            </ol>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Didn't receive the email? Check your spam folder.
          </p>

          {resendMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm backdrop-blur-sm ${
              resendMessage.includes('sent')
                ? 'bg-green-500/20 border border-green-400/30 text-green-300'
                : 'bg-red-500/20 border border-red-400/30 text-red-300'
            }`}>
              {resendMessage}
            </div>
          )}

              <FastBounce delay={0.2}>
                <button
                  onClick={handleResendEmail}
                  disabled={resending || !email}
                  className="w-full py-2 px-4 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-300 rounded-lg font-semibold hover:bg-blue-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all mb-4 shadow-lg shadow-blue-500/20"
                >
                  {resending ? 'Sending...' : 'Resend Confirmation Email'}
                </button>
              </FastBounce>

              <Link
                href="/auth/signin"
                className="text-sm text-slate-400 hover:text-blue-400 font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </GlowBorder>
      </FastFadeIn>
    </div>
  )
}
