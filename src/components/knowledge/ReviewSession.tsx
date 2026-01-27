'use client'

/**
 * REVIEW SESSION
 *
 * Spaced repetition review interface.
 * Features:
 * - Card flip animation
 * - 4 response buttons (Again/Hard/Good/Easy)
 * - Progress indicator
 * - Session complete celebration
 */

import { useState, useCallback, memo, useEffect } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Brain,
  CheckCircle2,
  Loader2,
  Clock,
  Zap,
  AlertCircle,
} from 'lucide-react'
import type { Capture, ReviewResponse } from '@/hooks/useCaptures'

interface ReviewSessionProps {
  captures: Capture[]
  onReview: (captureId: string, response: ReviewResponse) => Promise<Capture | null>
  onClose: () => void
  onComplete?: (stats: ReviewStats) => void
}

interface ReviewStats {
  total: number
  again: number
  hard: number
  good: number
  easy: number
  durationSeconds: number
}

const RESPONSE_LABELS: Record<ReviewResponse, { label: string; color: string; description: string }> = {
  AGAIN: {
    label: 'Again',
    color: 'red',
    description: 'Complete blank',
  },
  HARD: {
    label: 'Hard',
    color: 'amber',
    description: 'Struggled to recall',
  },
  GOOD: {
    label: 'Good',
    color: 'blue',
    description: 'Recalled with effort',
  },
  EASY: {
    label: 'Easy',
    color: 'green',
    description: 'Perfect recall',
  },
}

export const ReviewSession = memo(function ReviewSession({
  captures,
  onReview,
  onClose,
  onComplete,
}: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState<ReviewStats>({
    total: captures.length,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    durationSeconds: 0,
  })
  const [startTime] = useState(Date.now())
  const [isComplete, setIsComplete] = useState(false)

  const currentCapture = captures[currentIndex]
  const progress = ((currentIndex) / captures.length) * 100

  // Update duration
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        durationSeconds: Math.floor((Date.now() - startTime) / 1000),
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const handleResponse = useCallback(async (response: ReviewResponse) => {
    if (isSubmitting || !currentCapture) return

    setIsSubmitting(true)
    const result = await onReview(currentCapture.id, response)
    setIsSubmitting(false)

    if (result) {
      // Update stats
      setStats(prev => ({
        ...prev,
        [response.toLowerCase()]: prev[response.toLowerCase() as keyof ReviewStats] + 1,
      }))

      // Move to next card or complete
      if (currentIndex < captures.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setIsFlipped(false)
      } else {
        const finalStats = {
          ...stats,
          [response.toLowerCase()]: stats[response.toLowerCase() as keyof ReviewStats] + 1,
          durationSeconds: Math.floor((Date.now() - startTime) / 1000),
        }
        setIsComplete(true)
        onComplete?.(finalStats)
      }
    }
  }, [currentCapture, currentIndex, captures.length, isSubmitting, onReview, onComplete, stats, startTime])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  if (captures.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 mx-4">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              All caught up!
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              No captures due for review right now.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isComplete) {
    const successRate = ((stats.good + stats.easy) / stats.total * 100).toFixed(0)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 mx-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Brain className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Session Complete!
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              You reviewed {stats.total} capture{stats.total > 1 ? 's' : ''} in {formatDuration(stats.durationSeconds)}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {(['again', 'hard', 'good', 'easy'] as const).map((key) => {
                const count = stats[key]
                const { label, color } = RESPONSE_LABELS[key.toUpperCase() as ReviewResponse]
                return (
                  <div key={key} className="text-center">
                    <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>
                      {count}
                    </div>
                    <div className="text-xs text-neutral-500">{label}</div>
                  </div>
                )
              })}
            </div>

            {/* Success rate */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Success rate
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-white">
                  {successRate}%
                </span>
              </div>
              <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${successRate}%` }}
                />
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onClose}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-neutral-500" />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">
            {currentIndex + 1} / {captures.length}
          </span>
          <div className="flex items-center gap-1 text-neutral-400">
            <Clock className="w-4 h-4" />
            <span className="text-xs">{formatDuration(stats.durationSeconds)}</span>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className={`w-full max-w-lg aspect-[4/3] perspective-1000 cursor-pointer ${
            isSubmitting ? 'pointer-events-none' : ''
          }`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div
            className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
            }}
          >
            {/* Front of card */}
            <div
              className="absolute inset-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col items-center justify-center backface-hidden"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-4">
                Tap to reveal
              </div>
              <div className="flex-1 flex items-center justify-center">
                {currentCapture.title ? (
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-white text-center">
                    {currentCapture.title}
                  </h3>
                ) : (
                  <p className="text-lg text-neutral-700 dark:text-neutral-300 text-center line-clamp-4">
                    {currentCapture.content.slice(0, 100)}...
                  </p>
                )}
              </div>
              {currentCapture.subject && (
                <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm rounded-full">
                  {currentCapture.subject}
                </span>
              )}
            </div>

            {/* Back of card */}
            <div
              className="absolute inset-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6 backface-hidden rotate-y-180 overflow-auto"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-4">
                Answer
              </div>
              <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {currentCapture.content}
              </p>
              {currentCapture.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  {currentCapture.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Response buttons */}
      <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
        {!isFlipped ? (
          <button
            onClick={() => setIsFlipped(true)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Show Answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {(['AGAIN', 'HARD', 'GOOD', 'EASY'] as ReviewResponse[]).map((response) => {
              const { label, color, description } = RESPONSE_LABELS[response]
              return (
                <button
                  key={response}
                  onClick={() => handleResponse(response)}
                  disabled={isSubmitting}
                  className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all disabled:opacity-50 ${
                    color === 'red'
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : color === 'amber'
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                      : color === 'blue'
                      ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                  ) : (
                    <>
                      <span className={`font-semibold text-${color}-700 dark:text-${color}-400`}>
                        {label}
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">
                        {description}
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})
