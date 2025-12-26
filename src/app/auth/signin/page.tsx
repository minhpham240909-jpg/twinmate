import SignInForm from '@/components/auth/SignInForm'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-white relative flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30" />

      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-100/30 to-cyan-100/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-6xl mx-auto relative z-10">
        <div className="flex gap-12 items-center justify-center lg:justify-between">
          {/* Left side - Branding */}
          <div className="hidden lg:flex flex-1 flex-col justify-center max-w-md">
            <Link href="/" className="inline-flex items-center gap-2 mb-10 group">
              <Image src="/logo.png" alt="Clerva" width={40} height={40} className="h-10 w-auto" />
              <span className="text-slate-900 text-xl font-bold tracking-tight">
                Clerva
              </span>
            </Link>

            <h1 className="text-4xl font-bold text-slate-900 mb-4 leading-tight">
              Welcome back to your study community
            </h1>
            <p className="text-lg text-slate-600 mb-10">
              Continue your learning journey. Your study partners are waiting for you!
            </p>

            {/* Features */}
            <div className="space-y-4">
              <div>
                <p className="text-slate-900 font-medium">Your partners are waiting</p>
                <p className="text-sm text-slate-500">Jump back into study sessions</p>
              </div>

              <div>
                <p className="text-slate-900 font-medium">Pick up where you left off</p>
                <p className="text-sm text-slate-500">Your progress is saved</p>
              </div>

              <div>
                <p className="text-slate-900 font-medium">Temporary AI Partner ready to help</p>
                <p className="text-sm text-slate-500">24/7 study assistance while you wait</p>
              </div>
            </div>

            {/* Back to landing page */}
            <Link href="/" className="inline-flex items-center gap-2 mt-8 text-slate-600 hover:text-slate-900 transition-colors group">
              <svg className="w-5 h-5 rotate-180 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-sm font-medium">Back to home</span>
            </Link>
          </div>

          {/* Right side - Form */}
          <div className="w-full lg:w-auto lg:flex-1 flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <Suspense fallback={
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8 h-[500px] animate-pulse">
                  <div className="h-8 bg-slate-100 rounded w-1/2 mb-6"></div>
                  <div className="space-y-4">
                    <div className="h-12 bg-slate-100 rounded"></div>
                    <div className="h-12 bg-slate-100 rounded"></div>
                    <div className="h-12 bg-slate-100 rounded"></div>
                  </div>
                </div>
              }>
                <SignInForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile logo - only visible on mobile */}
      <Link href="/" className="lg:hidden fixed top-6 left-6 z-20 inline-flex items-center gap-2">
        <Image src="/logo.png" alt="Clerva" width={32} height={32} className="h-8 w-auto" />
        <span className="text-slate-900 text-lg font-bold tracking-tight">Clerva</span>
      </Link>
    </div>
  )
}
