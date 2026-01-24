'use client'

/**
 * Trial Limit Modal
 *
 * Shows when guest user has exhausted their 3 free trials.
 * Prompts them to sign up to continue.
 *
 * Professional UX: Cannot be dismissed - user must take action
 */

import { useRouter } from 'next/navigation'
import { Sparkles, Zap, Shield, TrendingUp, CheckCircle2, ArrowRight } from 'lucide-react'

interface TrialLimitModalProps {
  isOpen: boolean
  onClose?: () => void // Optional - modal cannot be dismissed, but kept for API compatibility
  trialsUsed?: number
}

export default function TrialLimitModal({
  isOpen,
  trialsUsed = 3,
}: TrialLimitModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleSignUp = () => {
    router.push('/auth?tab=signup')
  }

  const handleSignIn = () => {
    router.push('/auth?tab=signin')
  }

  // Modal cannot be dismissed by clicking outside - user must take action
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - no onClick to dismiss */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header gradient */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Success checkmarks */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            ))}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Great job exploring Clerva!
          </h2>

          {/* Subtitle */}
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
            You've completed {trialsUsed} free sessions. Create a free account to continue learning.
          </p>

          {/* What you get */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
              Free account includes
            </p>
            <div className="space-y-2.5 text-left">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Unlimited AI study help
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Track XP, streaks & achievements
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Save flashcards & study history
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-pink-500 flex-shrink-0" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  Personalized learning experience
                </span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSignUp}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              Continue with free account
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleSignIn}
              className="w-full py-3 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-neutral-500 mt-4">
            No credit card required. Free forever.
          </p>
        </div>
      </div>
    </div>
  )
}
