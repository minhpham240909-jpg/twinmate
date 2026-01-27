'use client'

/**
 * COMMITMENT SETUP
 *
 * First-time setup and editing of daily commitment.
 * Follows "Guidance first" principle:
 * - Pre-selected recommended option (15 min)
 * - Clear options, no confusion
 * - One tap to confirm
 */

import { useState, memo } from 'react'
import {
  Clock,
  Check,
  Loader2,
  Coffee,
  Zap,
  Target,
  Trophy,
  Sparkles,
} from 'lucide-react'

interface CommitmentOption {
  minutes: number
  label: string
  description: string
  icon: typeof Clock
  recommended?: boolean
}

const COMMITMENT_OPTIONS: CommitmentOption[] = [
  {
    minutes: 5,
    label: '5 min',
    description: 'Quick daily check-in',
    icon: Coffee,
  },
  {
    minutes: 15,
    label: '15 min',
    description: 'Steady progress',
    icon: Zap,
    recommended: true,
  },
  {
    minutes: 30,
    label: '30 min',
    description: 'Focused learning',
    icon: Target,
  },
  {
    minutes: 45,
    label: '45 min',
    description: 'Deep work session',
    icon: Trophy,
  },
  {
    minutes: 60,
    label: '1 hour',
    description: 'Intensive study',
    icon: Sparkles,
  },
]

interface CommitmentSetupProps {
  currentMinutes?: number
  onConfirm: (minutes: number) => Promise<boolean>
  isModal?: boolean
  onClose?: () => void
}

export const CommitmentSetup = memo(function CommitmentSetup({
  currentMinutes,
  onConfirm,
  isModal = false,
  onClose,
}: CommitmentSetupProps) {
  // Default to recommended (15 min) or current selection
  const [selectedMinutes, setSelectedMinutes] = useState(
    currentMinutes || COMMITMENT_OPTIONS.find(o => o.recommended)?.minutes || 15
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleConfirm = async () => {
    setIsSaving(true)
    const success = await onConfirm(selectedMinutes)
    setIsSaving(false)

    if (success && onClose) {
      onClose()
    }
  }

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Clock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          {currentMinutes ? 'Update Your Commitment' : 'Set Your Daily Goal'}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          How much time can you commit each day? Start small — you can always increase later.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {COMMITMENT_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = selectedMinutes === option.minutes

          return (
            <button
              key={option.minutes}
              type="button"
              onClick={() => setSelectedMinutes(option.minutes)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              <div className={`p-2.5 rounded-xl ${
                isSelected
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
              }`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${
                    isSelected
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-neutral-900 dark:text-white'
                  }`}>
                    {option.label}
                  </span>
                  {option.recommended && (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {option.description}
                </span>
              </div>

              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-neutral-300 dark:border-neutral-600'
              }`}>
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Weekly breakdown */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
        <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
          Your weekly commitment
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-neutral-900 dark:text-white">
            {selectedMinutes * 7}
          </span>
          <span className="text-neutral-500 dark:text-neutral-400">
            minutes / week
          </span>
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          ≈ {Math.round((selectedMinutes * 7) / 60 * 10) / 10} hours of learning each week
        </div>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>{currentMinutes ? 'Update Commitment' : 'Start Learning'}</span>
          </>
        )}
      </button>

      {isModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-xl">
          {content}
        </div>
      </div>
    )
  }

  return content
})
