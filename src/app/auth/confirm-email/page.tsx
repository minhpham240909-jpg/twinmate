'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ElectricBorder from '@/components/landing/ElectricBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <FadeIn delay={0.1}>
        <ElectricBorder color="#3b82f6" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
          <div className="w-full max-w-md">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center">
              {/* Email Icon */}
              <Bounce delay={0.1}>
                <Pulse>
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-blue-600"
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
                </Pulse>
              </Bounce>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>

          <p className="text-gray-600 mb-6">
            We've sent a confirmation email to{' '}
            <span className="font-semibold text-gray-900">{email || 'your email address'}</span>
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Check your email inbox</li>
              <li>Click the confirmation link in the email</li>
              <li>You'll be automatically logged in to your account</li>
            </ol>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Didn't receive the email? Check your spam folder.
          </p>

          {resendMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              resendMessage.includes('sent')
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {resendMessage}
            </div>
          )}

              <Bounce delay={0.2}>
                <button
                  onClick={handleResendEmail}
                  disabled={resending || !email}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all mb-4 shadow-lg"
                >
                  {resending ? 'Sending...' : 'Resend Confirmation Email'}
                </button>
              </Bounce>

              <Link
                href="/auth/signin"
                className="text-sm text-gray-600 hover:text-blue-600 font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </ElectricBorder>
      </FadeIn>
    </div>
  )
}
