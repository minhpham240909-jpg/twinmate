'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

function ConfirmEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendSuccess, setResendSuccess] = useState(false)

  const handleResendEmail = async () => {
    if (!email || resending) return

    setResending(true)
    setResendMessage('')
    setResendSuccess(false)

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResendSuccess(true)
        setResendMessage('Confirmation email sent! Please check your inbox.')
      } else {
        setResendSuccess(false)
        setResendMessage(data.error || 'Failed to resend email. Please try again.')
      }
    } catch {
      setResendSuccess(false)
      setResendMessage('Network error. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="Clerva" width={48} height={48} className="rounded-xl" />
          </div>

          {/* Email Icon with Animation */}
          <div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <svg
              className="w-10 h-10 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Check Your Email
          </h1>

          {/* Description */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            We&apos;ve sent a confirmation link to{' '}
            <span className="font-semibold text-neutral-900 dark:text-white break-all">
              {email || 'your email address'}
            </span>
          </p>

          {/* Important Notice Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Important: Verify to access your account
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  You must click the confirmation link in your email before you can sign in to Clerva.
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 mb-6 text-left">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-3 text-sm">
              What to do next:
            </h3>
            <ol className="space-y-2">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300 flex-shrink-0">
                  1
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Open your email inbox
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300 flex-shrink-0">
                  2
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Look for an email from <strong>Clerva</strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300 flex-shrink-0">
                  3
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Click the <strong>&quot;Confirm Email&quot;</strong> button in the email
                </span>
              </li>
            </ol>
          </div>

          {/* Spam Notice */}
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Can&apos;t find the email? Check your <strong>spam</strong> or <strong>junk</strong> folder.
          </p>

          {/* Resend Message */}
          {resendMessage && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${
              resendSuccess
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                {resendSuccess ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {resendMessage}
              </div>
            </div>
          )}

          {/* Resend Button */}
          <button
            onClick={handleResendEmail}
            disabled={resending || !email}
            className="w-full py-3 px-4 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4"
          >
            {resending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resend Confirmation Email
              </span>
            )}
          </button>

          {/* Back to Sign In */}
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sign In
          </Link>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-6">
          Having trouble? Contact us at{' '}
          <a href="mailto:privacy@clerva.app" className="text-blue-500 hover:underline">
            privacy@clerva.app
          </a>
        </p>
      </div>
    </div>
  )
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-12 h-12 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ConfirmEmailContent />
    </Suspense>
  )
}
