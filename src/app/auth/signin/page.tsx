import SignInForm from '@/components/auth/SignInForm'
import Link from 'next/link'
import { Suspense } from 'react'
import ElectricBorder from '@/components/landing/ElectricBorder'
import Pulse from '@/components/ui/Pulse'
import FadeIn from '@/components/ui/FadeIn'
import Bounce from '@/components/ui/Bounce'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex gap-8 items-center">
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
          <FadeIn delay={0.2}>
            <ElectricBorder color="#3b82f6" speed={1} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
              <Suspense fallback={<div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg animate-pulse h-96"></div>}>
                <SignInForm />
              </Suspense>
            </ElectricBorder>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}