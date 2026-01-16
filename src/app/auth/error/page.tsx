import Link from 'next/link'
import GlowBorder from '@/components/ui/GlowBorder'
import FastPulse from '@/components/ui/FastPulse'
import FastFadeIn from '@/components/ui/FastFadeIn'
import FastBounce from '@/components/ui/FastBounce'

interface PageProps {
  searchParams: Promise<{ message?: string; type?: string }>
}

export default async function AuthErrorPage({ searchParams }: PageProps) {
  const params = await searchParams
  const errorMessage = params.message || 'Something went wrong during authentication. Please try again.'
  const errorType = params.type

  // Check if this is likely an email verification error on a different device
  const isEmailVerificationError = errorMessage.toLowerCase().includes('email') ||
    errorMessage.toLowerCase().includes('token') ||
    errorMessage.toLowerCase().includes('expired') ||
    errorMessage.toLowerCase().includes('invalid') ||
    errorType === 'email_verification'

  // Determine if this might be a cross-device verification attempt
  const mightBeCrossDevice = isEmailVerificationError && (
    errorMessage.toLowerCase().includes('expired') ||
    errorMessage.toLowerCase().includes('already') ||
    errorMessage.toLowerCase().includes('used')
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <FastFadeIn delay={0.1}>
        <GlowBorder color={mightBeCrossDevice ? "#fbbf24" : "#f87171"} intensity="medium" animated={false} style={{ borderRadius: 12 }}>
          <div className="max-w-md w-full bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-xl shadow-2xl text-center">
            <FastBounce delay={0.1}>
              <FastPulse>
                <div className={`w-16 h-16 ${mightBeCrossDevice ? 'bg-amber-500/20' : 'bg-red-500/20'} backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4`}>
                  {mightBeCrossDevice ? (
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
              </FastPulse>
            </FastBounce>

            <h1 className="text-2xl font-bold text-white mb-2">
              {mightBeCrossDevice ? 'Email Already Verified' : 'Authentication Error'}
            </h1>

            <p className="text-slate-300 mb-4">
              {errorMessage}
            </p>

            {/* Show helpful message for cross-device verification */}
            {mightBeCrossDevice && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 text-left">
                <p className="text-amber-200 text-sm">
                  <strong>Tip:</strong> If you confirmed your email on a different device (like your phone),
                  your account is ready! Simply sign in below to continue.
                </p>
              </div>
            )}

            {/* Show helpful message for email verification errors */}
            {isEmailVerificationError && !mightBeCrossDevice && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 text-left">
                <p className="text-blue-200 text-sm">
                  <strong>Tip:</strong> Verification links expire after 24 hours. If yours has expired,
                  try signing in and we&apos;ll send you a new confirmation email.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <FastBounce delay={0.2}>
                <Link
                  href="/auth"
                  className="flex-1 px-6 py-3 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-300 rounded-lg font-semibold hover:bg-blue-500/30 hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
                >
                  {mightBeCrossDevice ? 'Sign In' : 'Try Again'}
                </Link>
              </FastBounce>
              <FastBounce delay={0.3}>
                <Link
                  href="/"
                  className="flex-1 px-6 py-3 bg-slate-700/40 backdrop-blur-sm text-slate-300 border-2 border-slate-600/50 rounded-lg font-semibold hover:bg-slate-700/60 hover:scale-105 transition-all"
                >
                  Go Home
                </Link>
              </FastBounce>
            </div>
          </div>
        </GlowBorder>
      </FastFadeIn>
    </div>
  )
}