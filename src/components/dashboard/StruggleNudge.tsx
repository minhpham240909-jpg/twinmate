'use client'

/**
 * STRUGGLE NUDGE COMPONENT
 *
 * Displays contextual nudges when the struggle detector identifies
 * that a user is having difficulty with a learning step.
 *
 * Features:
 * - Smooth slide-in animation
 * - Contextual icons and colors based on nudge type
 * - Action buttons that connect to handlers
 * - Auto-dismiss after timeout (optional)
 * - Dismissible by user
 */

import { memo, useEffect, useState } from 'react'
import {
  X,
  Lightbulb,
  Coffee,
  ListTodo,
  BookOpen,
  Heart,
  MessageCircle,
  ChevronRight,
} from 'lucide-react'
import type { Nudge, NudgeType } from '@/lib/progress-feedback/struggle-detector'

// ============================================
// TYPES
// ============================================

interface StruggleNudgeProps {
  nudge: Nudge
  isVisible: boolean
  onDismiss: () => void
  onAction?: (actionHandler: string) => void
  autoDismissMs?: number // Auto-dismiss after this many ms (0 = no auto-dismiss)
}

// ============================================
// NUDGE STYLING
// ============================================

const nudgeStyles: Record<NudgeType, {
  icon: typeof Lightbulb
  bgColor: string
  borderColor: string
  iconColor: string
  textColor: string
  buttonBg: string
  buttonText: string
}> = {
  hint: {
    icon: Lightbulb,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    iconColor: 'text-amber-500 dark:text-amber-400',
    textColor: 'text-amber-800 dark:text-amber-200',
    buttonBg: 'bg-amber-500 hover:bg-amber-600',
    buttonText: 'text-white',
  },
  break_suggestion: {
    icon: Coffee,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    iconColor: 'text-blue-500 dark:text-blue-400',
    textColor: 'text-blue-800 dark:text-blue-200',
    buttonBg: 'bg-blue-500 hover:bg-blue-600',
    buttonText: 'text-white',
  },
  simplify: {
    icon: ListTodo,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800/50',
    iconColor: 'text-purple-500 dark:text-purple-400',
    textColor: 'text-purple-800 dark:text-purple-200',
    buttonBg: 'bg-purple-500 hover:bg-purple-600',
    buttonText: 'text-white',
  },
  resource: {
    icon: BookOpen,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800/50',
    iconColor: 'text-green-500 dark:text-green-400',
    textColor: 'text-green-800 dark:text-green-200',
    buttonBg: 'bg-green-500 hover:bg-green-600',
    buttonText: 'text-white',
  },
  encouragement: {
    icon: Heart,
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    borderColor: 'border-pink-200 dark:border-pink-800/50',
    iconColor: 'text-pink-500 dark:text-pink-400',
    textColor: 'text-pink-800 dark:text-pink-200',
    buttonBg: 'bg-pink-500 hover:bg-pink-600',
    buttonText: 'text-white',
  },
  ask_help: {
    icon: MessageCircle,
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800/50',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    textColor: 'text-indigo-800 dark:text-indigo-200',
    buttonBg: 'bg-indigo-500 hover:bg-indigo-600',
    buttonText: 'text-white',
  },
}

// ============================================
// COMPONENT
// ============================================

export const StruggleNudge = memo(function StruggleNudge({
  nudge,
  isVisible,
  onDismiss,
  onAction,
  autoDismissMs = 0,
}: StruggleNudgeProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const style = nudgeStyles[nudge.type]
  const Icon = style.icon

  // Handle auto-dismiss
  useEffect(() => {
    if (isVisible && autoDismissMs > 0) {
      const timer = setTimeout(onDismiss, autoDismissMs)
      return () => clearTimeout(timer)
    }
  }, [isVisible, autoDismissMs, onDismiss])

  // Animation state
  useEffect(() => {
    if (isVisible) {
      // Small delay for animation
      requestAnimationFrame(() => setIsAnimating(true))
    } else {
      setIsAnimating(false)
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div
      className={`
        fixed bottom-24 left-4 right-4 max-w-md mx-auto z-40
        transition-all duration-300 ease-out
        ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      <div
        className={`
          rounded-xl border shadow-lg p-4
          ${style.bgColor} ${style.borderColor}
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`p-2 rounded-lg bg-white/50 dark:bg-black/20`}>
            <Icon className={`w-5 h-5 ${style.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-sm ${style.textColor}`}>
              {nudge.title}
            </h4>
            <p className={`text-sm mt-0.5 opacity-80 ${style.textColor}`}>
              {nudge.message}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className={`
              p-1 rounded-md transition-colors
              hover:bg-black/5 dark:hover:bg-white/10
              ${style.textColor} opacity-60 hover:opacity-100
            `}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action button */}
        {nudge.action && onAction && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onAction(nudge.action!.handler)}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-lg
                font-medium text-sm transition-colors
                ${style.buttonBg} ${style.buttonText}
              `}
            >
              <span>{nudge.action.label}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

// ============================================
// NUDGE SCENARIOS (for reference)
// ============================================

/**
 * Nudge scenarios based on struggle detection:
 *
 * 1. TIME EXCEEDED (moderate - 2x estimated)
 *    - Type: hint
 *    - Message: "This step is taking longer than expected. Need a hint?"
 *    - Action: Show Hint
 *
 * 2. MULTIPLE VIEWS (mild - 3+ views)
 *    - Type: simplify
 *    - Message: "Revisiting this step? Let me break it down further."
 *    - Action: Show Breakdown
 *
 * 3. NO PROGRESS (moderate - 5+ min)
 *    - Type: resource
 *    - Message: "Here's a video that might help with this concept."
 *    - Action: View Resources
 *
 * 4. QUICK ABANDON (severe)
 *    - Type: ask_help
 *    - Message: "Something blocking you? Let's talk through it."
 *    - Action: Open Chat
 *
 * 5. REPEATED ATTEMPTS (moderate - 2+ failed)
 *    - Type: encouragement
 *    - Message: "This is challenging - that's normal. Try this approach..."
 *    - No action button (just encouragement)
 *
 * 6. SEVERE TIME (3x+ estimated)
 *    - Type: break_suggestion
 *    - Message: "Extended focus periods benefit from periodic breaks."
 *    - No action button (just suggestion)
 */

export default StruggleNudge
