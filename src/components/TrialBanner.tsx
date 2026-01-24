'use client'

/**
 * Trial Banner
 *
 * Shows remaining trial count for guest users.
 * Compact banner that appears at top of dashboard.
 */

import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

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

  // Show different message based on trials remaining
  const getMessage = () => {
    if (trialsRemaining === 0) {
      return "You've used all free tries"
    }
    if (trialsRemaining === 1) {
      return '1 free try left'
    }
    return `${trialsRemaining} free tries left`
  }

  const isUrgent = trialsRemaining <= 1

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        isUrgent
          ? 'bg-gradient-to-r from-orange-500 to-pink-500'
          : 'bg-gradient-to-r from-blue-500 to-purple-500'
      }`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-white" />
        <span className="text-sm font-medium text-white">
          {getMessage()}
        </span>
      </div>
      <button
        onClick={() => router.push('/auth?tab=signup')}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full transition-colors"
      >
        Sign up free
      </button>
    </div>
  )
}
