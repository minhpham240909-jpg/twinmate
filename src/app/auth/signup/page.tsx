import SignUpForm from '@/components/auth/SignUpForm'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex gap-8 items-center">
        {/* Left side - Branding */}
        <div className="hidden lg:block flex-1">
          <Link href="/" className="inline-block mb-8">
            <h1 className="text-4xl font-bold text-blue-600">← Clerva</h1>
          </Link>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Start your learning journey today
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of students finding study partners, collaborating in real-time, and achieving their goals with AI-powered insights.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Smart Partner Matching</h3>
                <p className="text-gray-600">Find compatible study partners based on your interests and goals</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Real-time Collaboration</h3>
                <p className="text-gray-600">Chat, video calls, and shared whiteboards for effective studying</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">AI Study Assistant</h3>
                <p className="text-gray-600">Get personalized insights, quizzes, and study recommendations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex justify-center">
          <SignUpForm />
        </div>
      </div>
    </div>
  )
}