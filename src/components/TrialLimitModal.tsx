'use client'

/**
 * Trial Limit Modal
 *
 * Shows when guest user has exhausted their 3 free trials.
 * Prompts them to sign up to continue.
 */

import { useRouter } from 'next/navigation'
import { X, Sparkles, Zap, Shield, TrendingUp } from 'lucide-react'

interface TrialLimitModalProps {
  isOpen: boolean
  onClose: () => void
  trialsUsed?: number
}

export default function TrialLimitModal({
  isOpen,
  onClose,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header gradient */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            You've used your {trialsUsed} free tries!
          </h2>

          {/* Subtitle */}
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
            Sign up for free to unlock unlimited help and track your progress.
          </p>

          {/* Benefits */}
          <div className="space-y-3 mb-6 text-left">
            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Unlimited AI explanations & flashcards
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Track XP, streaks & milestones
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <Shield className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                AI remembers your learning style
              </span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSignUp}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/25"
            >
              Sign up free
            </button>
            <button
              onClick={handleSignIn}
              className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium transition-colors"
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
