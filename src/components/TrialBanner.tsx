'use client'

/**
 * Trial Banner
 *
 * Shows remaining trial count for guest users.
 * Compact banner that appears at top of dashboard.
 */

import { useRouter } from 'next/navigation'
import { Sparkles, AlertCircle, Lock } from 'lucide-react'

interface TrialBannerProps {
  trialsRemaining: number
  totalTrials: number
}

export default function TrialBanner({
  trialsRemaining,
  totalTrials,
}: TrialBannerProps) {
  const router = useRouter()

  // Don't show if all trials remaining (first visit)
  if (trialsRemaining === totalTrials) return null

  // Exhausted state - more prominent
  if (trialsRemaining === 0) {
    return (
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">
              Free trial ended
            </span>
          </div>
          <button
            onClick={() => router.push('/auth?tab=signup')}
            className="px-4 py-1.5 bg-white dark:bg-neutral-900 text-orange-600 dark:text-orange-400 text-sm font-semibold rounded-full hover:bg-orange-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Sign up to continue
          </button>
        </div>
      </div>
    )
  }

  // Last trial warning
  if (trialsRemaining === 1) {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">
              Last free try remaining
            </span>
          </div>
          <button
            onClick={() => router.push('/auth?tab=signup')}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full transition-colors"
          >
            Sign up free
          </button>
        </div>
      </div>
    )
  }

  // Normal state (2 trials left)
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-white">
            {trialsRemaining} free tries left
          </span>
        </div>
        <button
          onClick={() => router.push('/auth?tab=signup')}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full transition-colors"
        >
          Sign up free
        </button>
      </div>
    </div>
  )
}
