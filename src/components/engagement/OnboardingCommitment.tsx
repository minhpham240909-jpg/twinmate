'use client'

/**
 * ONBOARDING COMMITMENT FLOW
 *
 * Full-screen onboarding for new users to set their daily commitment.
 * Shows after goal input during first-time user flow.
 * Features:
 * - Visual commitment options (5/15/30/45/60 min)
 * - Estimated completion time
 * - Benefits of each level
 * - Skip option (defaults to 15 min)
 */

import { memo, useState, useCallback } from 'react'
import {
  Clock,
  Zap,
  Target,
  TrendingUp,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

interface CommitmentOption {
  minutes: number
  label: string
  description: string
  pace: string
  icon: typeof Clock
  recommended?: boolean
}

const COMMITMENT_OPTIONS: CommitmentOption[] = [
  {
    minutes: 5,
    label: 'Light',
    description: 'Quick daily check-in',
    pace: '~4 weeks for typical roadmap',
    icon: Zap,
  },
  {
    minutes: 15,
    label: 'Regular',
    description: 'Consistent progress',
    pace: '~2 weeks for typical roadmap',
    icon: Target,
    recommended: true,
  },
  {
    minutes: 30,
    label: 'Focused',
    description: 'Dedicated learning time',
    pace: '~1 week for typical roadmap',
    icon: TrendingUp,
  },
  {
    minutes: 45,
    label: 'Deep',
    description: 'Intensive learning sessions',
    pace: '~5 days for typical roadmap',
    icon: Sparkles,
  },
  {
    minutes: 60,
    label: 'Intense',
    description: 'Maximum daily commitment',
    pace: '~3-4 days for typical roadmap',
    icon: Clock,
  },
]

interface OnboardingCommitmentProps {
  onComplete: (minutes: number) => Promise<void>
  onSkip?: () => void
  goalTitle?: string
  isLoading?: boolean
}

export const OnboardingCommitment = memo(function OnboardingCommitment({
  onComplete,
  onSkip,
  goalTitle,
  isLoading = false,
}: OnboardingCommitmentProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(15) // Default to Regular
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleContinue = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await onComplete(selectedMinutes)
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedMinutes, onComplete])

  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip()
    } else {
      // Default to 15 minutes if skipping
      onComplete(15)
    }
  }, [onSkip, onComplete])

  const selectedOption = COMMITMENT_OPTIONS.find(o => o.minutes === selectedMinutes)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-neutral-900 dark:to-neutral-950 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-12 pb-6 text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Set Your Daily Commitment
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          How much time can you dedicate to learning each day?
        </p>
        {goalTitle && (
          <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
            Goal: {goalTitle}
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex-1 px-6 py-4 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-3">
          {COMMITMENT_OPTIONS.map((option) => {
            const Icon = option.icon
            const isSelected = selectedMinutes === option.minutes

            return (
              <button
                key={option.minutes}
                onClick={() => setSelectedMinutes(option.minutes)}
                disabled={isLoading || isSubmitting}
                className={`
                  relative w-full p-4 rounded-2xl border-2 transition-all text-left
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }
                  ${(isLoading || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {/* Recommended badge */}
                {option.recommended && (
                  <div className="absolute -top-2 right-4 px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Recommended
                  </div>
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                    ${isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-neutral-100 dark:bg-neutral-800'
                    }
                  `}>
                    <Icon className={`w-6 h-6 ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${
                          isSelected
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-neutral-900 dark:text-white'
                        }`}>
                          {option.minutes}
                        </span>
                        <span className="text-sm text-neutral-500">min/day</span>
                      </div>
                      <span className={`text-sm font-medium ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                      {option.description}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {option.pace}
                    </p>
                  </div>

                  {/* Check indicator */}
                  {isSelected && (
                    <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary and Actions */}
      <div className="flex-shrink-0 px-6 py-6 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-md mx-auto">
          {/* Weekly summary */}
          {selectedOption && (
            <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {selectedMinutes * 7} minutes
                </span>
                {' '}per week ({Math.round(selectedMinutes * 7 / 60 * 10) / 10} hours)
              </p>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={isLoading || isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Skip option */}
          {onSkip && (
            <button
              onClick={handleSkip}
              disabled={isLoading || isSubmitting}
              className="w-full mt-3 py-3 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium transition-colors"
            >
              Skip for now (default: 15 min)
            </button>
          )}

          {/* Reassurance text */}
          <p className="mt-4 text-xs text-center text-neutral-500">
            You can always adjust this later in Settings
          </p>
        </div>
      </div>
    </div>
  )
})

export default OnboardingCommitment
