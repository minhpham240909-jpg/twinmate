import SignInForm from '@/components/auth/SignInForm'
import Link from 'next/link'
import { Suspense } from 'react'
import GlowBorder from '@/components/ui/GlowBorder'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-900 relative flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle gradient background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20" />

      {/* Decorative gradient blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />

      <div className="w-full max-w-7xl mx-auto relative z-10">
        <div className="flex gap-8 items-center justify-center lg:justify-between">
          {/* Left side - Branding */}
          <div className="hidden lg:flex flex-1 flex-col justify-center">
            <Link href="/" className="inline-block mb-8">
              <h1 className="text-4xl font-bold text-blue-400 hover:text-blue-300 transition-colors">← Clerva</h1>
            </Link>
            <h2 className="text-4xl font-bold text-white mb-4">
              Welcome back to Clerva
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              Continue your learning journey. Your study partners are waiting!
            </p>
          </div>

          {/* Right side - Form */}
          <div className="w-full lg:w-auto lg:flex-1 flex justify-center">
            <div className="w-full max-w-md">
              <GlowBorder color="#3b82f6" intensity="medium" animated={false} style={{ borderRadius: 12 }}>
                <Suspense fallback={<div className="w-full bg-white/5 backdrop-blur-xl p-8 rounded-xl h-[500px]"></div>}>
                  <SignInForm />
                </Suspense>
              </GlowBorder>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}