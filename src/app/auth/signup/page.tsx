import SignUpForm from '@/components/auth/SignUpForm'
import Link from 'next/link'
import GlowBorder from '@/components/ui/GlowBorder'
import FastPulse from '@/components/ui/FastPulse'
import FastFadeIn from '@/components/ui/FastFadeIn'
import FastBounce from '@/components/ui/FastBounce'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-900 relative flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle gradient background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20" />

      {/* Decorative gradient blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />

      <div className="w-full max-w-6xl flex gap-8 items-center relative z-10">
        {/* Left side - Branding */}
        <div className="hidden lg:block flex-1">
          <Link href="/" className="inline-block mb-8">
            <h1 className="text-4xl font-bold text-blue-400 hover:text-blue-300 transition-colors">← Clerva</h1>
          </Link>
          <h2 className="text-4xl font-bold text-white mb-4">
            Start your learning journey today
          </h2>
          <p className="text-lg text-slate-300 mb-8">
            Join thousands of students finding study partners, collaborating in real-time, and achieving their goals together.
          </p>
          <FastFadeIn delay={0.2}>
            <div className="space-y-4">
              <FastBounce delay={0.1}>
                <div className="flex items-start gap-3">
                  <FastPulse>
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-blue-500/30">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </FastPulse>
                  <div>
                    <h3 className="font-semibold text-white">Smart Partner Matching</h3>
                    <p className="text-slate-300">Find compatible study partners based on your interests and goals</p>
                  </div>
                </div>
              </FastBounce>
              <FastBounce delay={0.2}>
                <div className="flex items-start gap-3">
                  <FastPulse>
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-blue-500/30">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </FastPulse>
                  <div>
                    <h3 className="font-semibold text-white">Real-time Collaboration</h3>
                    <p className="text-slate-300">Chat, video calls, and shared whiteboards for effective studying</p>
                  </div>
                </div>
              </FastBounce>
              <FastBounce delay={0.3}>
                <div className="flex items-start gap-3">
                  <FastPulse>
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-blue-500/30">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </FastPulse>
                  <div>
                    <h3 className="font-semibold text-white">Study Tools</h3>
                    <p className="text-slate-300">Get personalized insights, quizzes, and study recommendations</p>
                  </div>
                </div>
              </FastBounce>
            </div>
          </FastFadeIn>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex justify-center">
          <FastFadeIn delay={0.2}>
            <GlowBorder color="#8b5cf6" intensity="medium" animated={false} style={{ borderRadius: 12 }}>
              <SignUpForm />
            </GlowBorder>
          </FastFadeIn>
        </div>
      </div>
    </div>
  )
}