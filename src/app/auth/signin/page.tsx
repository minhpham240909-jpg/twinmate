import SignInForm from '@/components/auth/SignInForm'
import Link from 'next/link'
import { Suspense } from 'react'
import GlowBorder from '@/components/ui/GlowBorder'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex gap-8 items-center">
        {/* Left side - Branding */}
        <div className="hidden lg:block flex-1">
          <Link href="/" className="inline-block mb-8">
            <h1 className="text-4xl font-bold text-blue-600">← Clerva</h1>
          </Link>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome back to Clerva
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Continue your learning journey. Your study partners are waiting!
          </p>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-xl">
            <GlowBorder color="#3b82f6" intensity="medium" animated={false} style={{ borderRadius: 12 }}>
              <Suspense fallback={<div className="w-full bg-white p-10 rounded-xl shadow-lg h-[500px]"></div>}>
                <SignInForm />
              </Suspense>
            </GlowBorder>
          </div>
        </div>
      </div>
    </div>
  )
}