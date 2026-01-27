'use client'

/**
 * PROGRESS TOAST COMPONENT
 *
 * Displays micro-celebrations and struggle nudges as non-intrusive toasts.
 *
 * DESIGN PRINCIPLES:
 * - Non-blocking: Appears at bottom, doesn't cover content
 * - Brief: Auto-dismisses after a few seconds
 * - Actionable: Nudges can have action buttons
 * - Delightful: Celebrations have subtle animations
 */

import { useEffect, useState, useCallback, memo } from 'react'
import { X, ArrowRight, Sparkles } from 'lucide-react'
import type { FeedbackItem } from '@/hooks/useProgressFeedback'

interface ProgressToastProps {
  feedback: FeedbackItem | null
  onDismiss: () => void
  onAction?: (handler: string) => void
}

// Color mapping for celebrations
const CELEBRATION_COLORS = {
  blue: 'from-blue-500 to-cyan-500 border-blue-400',
  green: 'from-green-500 to-emerald-500 border-green-400',
  purple: 'from-purple-500 to-pink-500 border-purple-400',
  orange: 'from-orange-500 to-amber-500 border-orange-400',
  yellow: 'from-yellow-400 to-orange-400 border-yellow-400',
  red: 'from-red-500 to-rose-500 border-red-400',
}

const NUDGE_ICONS: Record<string, string> = {
  hint: '💡',
  break_suggestion: '☕',
  simplify: '🧩',
  resource: '📚',
  encouragement: '💪',
  ask_help: '💬',
}

function ProgressToast({ feedback, onDismiss, onAction }: ProgressToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  // Handle entrance animation
  useEffect(() => {
    if (feedback) {
      // Small delay for entrance animation
      const showTimer = setTimeout(() => setIsVisible(true), 50)
      
      // Auto dismiss celebrations (not nudges - they need action)
      if (feedback.type === 'celebration') {
        const duration = feedback.celebration?.duration || 4000
        const dismissTimer = setTimeout(() => handleDismiss(), duration)
        return () => {
          clearTimeout(showTimer)
          clearTimeout(dismissTimer)
        }
      }
      
      return () => clearTimeout(showTimer)
    } else {
      setIsVisible(false)
    }
  }, [feedback])

  const handleDismiss = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => {
      setIsLeaving(false)
      setIsVisible(false)
      onDismiss()
    }, 300)
  }, [onDismiss])

  const handleAction = useCallback((handler: string) => {
    onAction?.(handler)
  }, [onAction])

  if (!feedback) return null

  const isCelebration = feedback.type === 'celebration'
  const celebration = feedback.celebration
  const nudge = feedback.nudge

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-50 transition-all duration-300 ease-out sm:left-auto sm:right-4 sm:max-w-sm ${
        isVisible && !isLeaving
          ? 'translate-y-0 opacity-100'
          : 'translate-y-8 opacity-0'
      }`}
    >
      {isCelebration && celebration ? (
        // Celebration Toast
        <div
          className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r ${
            CELEBRATION_COLORS[celebration.color]
          } p-4 shadow-lg`}
        >
          {/* Sparkle decoration */}
          <div className="absolute -right-4 -top-4 opacity-20">
            <Sparkles className="h-24 w-24 text-white" />
          </div>

          <div className="relative flex items-start gap-3">
            {/* Icon */}
            <span className="text-3xl">{celebration.icon}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-lg leading-tight">
                {celebration.title}
              </h3>
              <p className="text-white/90 text-sm mt-0.5">
                {celebration.message}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>
        </div>
      ) : nudge ? (
        // Nudge Toast
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-xl">{nudge.icon || NUDGE_ICONS[nudge.type] || '💭'}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {nudge.title}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">
                {nudge.message}
              </p>

              {/* Action button */}
              {nudge.action && (
                <button
                  onClick={() => handleAction(nudge.action!.handler)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {nudge.action.label}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5 text-neutral-400" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default memo(ProgressToast)
