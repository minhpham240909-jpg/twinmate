'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Password strength calculation
interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
  bgColor: string
  feedback: string[]
}

function calculatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  if (!password) {
    return { score: 0, label: '', color: 'text-slate-400', bgColor: 'bg-slate-600', feedback: [] }
  }

  // Length checks
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('At least 8 characters')
  }

  if (password.length >= 12) {
    score += 1
  }

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Mix of uppercase & lowercase')
  }

  if (/\d/.test(password)) {
    score += 0.5
  } else {
    feedback.push('At least one number')
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 0.5
  } else {
    feedback.push('At least one special character')
  }

  // Common patterns to avoid (reduces score)
  const commonPatterns = ['password', '123456', 'qwerty', 'abc123', 'letmein']
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    score = Math.max(0, score - 2)
    feedback.push('Avoid common patterns')
  }

  // Sequential characters (reduces score)
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 0.5)
    feedback.push('Avoid repeated characters')
  }

  // Map score to strength level
  const normalizedScore = Math.min(4, Math.floor(score))
  
  const strengthLevels: Record<number, Omit<PasswordStrength, 'score' | 'feedback'>> = {
    0: { label: 'Very Weak', color: 'text-red-400', bgColor: 'bg-red-500' },
    1: { label: 'Weak', color: 'text-orange-400', bgColor: 'bg-orange-500' },
    2: { label: 'Fair', color: 'text-yellow-400', bgColor: 'bg-yellow-500' },
    3: { label: 'Good', color: 'text-lime-400', bgColor: 'bg-lime-500' },
    4: { label: 'Strong', color: 'text-green-400', bgColor: 'bg-green-500' },
  }

  return {
    score: normalizedScore,
    ...strengthLevels[normalizedScore],
    feedback: feedback.slice(0, 3), // Show max 3 suggestions
  }
}

export default function SignUpForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPasswordStrength, setShowPasswordStrength] = useState(false)

  // Calculate password strength
  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    console.log('[SignUp] Starting signup process...')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      console.log('[SignUp] Creating account for:', formData.email)

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[SignUp] Signup failed:', data.error)
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      console.log('[SignUp] ✅ Account created successfully!')
      console.log('[SignUp] Message:', data.message)

      // Redirect to email confirmation page
      // User needs to verify their email before accessing the app
      router.push(`/auth/confirm-email?email=${encodeURIComponent(formData.email)}`)
    } catch (err) {
      console.error('[SignUp] Network error:', err)
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-xl border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-200 mb-1">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 text-white placeholder-slate-400 transition-all"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 text-white placeholder-slate-400 transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              onFocus={() => setShowPasswordStrength(true)}
              onBlur={() => setShowPasswordStrength(formData.password.length > 0)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 text-white placeholder-slate-400 transition-all"
              placeholder="••••••••"
            />
            
            {/* Password Strength Indicator */}
            {showPasswordStrength && formData.password && (
              <div className="mt-2 space-y-2">
                {/* Strength Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          index < passwordStrength.score
                            ? passwordStrength.bgColor
                            : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${passwordStrength.color}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                
                {/* Feedback */}
                {passwordStrength.feedback.length > 0 && (
                  <ul className="text-xs text-slate-400 space-y-0.5">
                    {passwordStrength.feedback.map((tip, index) => (
                      <li key={index} className="flex items-center gap-1.5">
                        <span className="text-slate-500">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 text-white placeholder-slate-400 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900/80 text-slate-400">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="mt-4 w-full py-3 bg-white/5 border border-white/10 rounded-lg font-semibold text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-purple-400 font-semibold hover:text-purple-300 transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}