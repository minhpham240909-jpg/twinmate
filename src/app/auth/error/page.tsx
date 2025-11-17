import Link from 'next/link'
import ElectricBorder from '@/components/landing/ElectricBorder'
import FastPulse from '@/components/ui/FastPulse'
import FastFadeIn from '@/components/ui/FastFadeIn'
import FastBounce from '@/components/ui/FastBounce'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <FastFadeIn delay={0.1}>
        <ElectricBorder color="#ef4444" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
          <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
            <FastBounce delay={0.1}>
              <FastPulse>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </FastPulse>
            </FastBounce>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
            <p className="text-gray-600 mb-6">
              Something went wrong during authentication. Please try again.
            </p>
            <div className="flex gap-4">
              <FastBounce delay={0.2}>
                <Link
                  href="/auth/signin"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 hover:scale-105 transition-all shadow-lg"
                >
                  Try Again
                </Link>
              </FastBounce>
              <FastBounce delay={0.3}>
                <Link
                  href="/"
                  className="flex-1 px-6 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold hover:bg-blue-50 hover:scale-105 transition-all"
                >
                  Go Home
                </Link>
              </FastBounce>
            </div>
          </div>
        </ElectricBorder>
      </FastFadeIn>
    </div>
  )
}