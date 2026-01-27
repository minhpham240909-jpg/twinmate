'use client'

/**
 * Dashboard Celebration Modal Component
 * Shows when mission is completed with XP earned animation
 */

import { memo, useEffect } from 'react'
import { CheckCircle2, Zap, TrendingUp } from 'lucide-react'

interface DashboardCelebrationModalProps {
  isOpen: boolean
  onClose: () => void
  xpEarned: number
  stepCompleted: string
  isRoadmapComplete: boolean
}

export const DashboardCelebrationModal = memo(function DashboardCelebrationModal({
  isOpen,
  onClose,
  xpEarned,
  stepCompleted,
  isRoadmapComplete,
}: DashboardCelebrationModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Auto-close after 4 seconds
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Status icon */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-7 h-7 text-white" />
        </div>

        <div className="text-center pt-8">
          {/* Title */}
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            {isRoadmapComplete ? 'Roadmap Complete!' : 'Step Complete!'}
          </h2>

          {/* Step name */}
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {stepCompleted}
          </p>

          {/* XP Earned */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 rounded-full mb-6">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              +{xpEarned} XP
            </span>
          </div>

          {/* Status message */}
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {isRoadmapComplete
              ? 'All roadmap steps completed. Select a new goal to continue.'
              : 'Progress saved. Next step unlocked.'}
          </p>

          {/* Progress indicator */}
          {!isRoadmapComplete && (
            <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Progress saved</span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
})
