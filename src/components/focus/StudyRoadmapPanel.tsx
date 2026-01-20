'use client'

/**
 * StudyRoadmapPanel - Displays study roadmap with progress tracking
 *
 * Features:
 * - Professional, organized layout
 * - Checkable step items
 * - Progress indicator (e.g., "2/5 completed")
 * - Completion celebration with encouragement messages
 * - Session-only state (no database persistence)
 */

import { useState, useEffect, useCallback, memo } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trophy,
  Lightbulb,
  X,
} from 'lucide-react'

// Types
interface StudyPlanStep {
  id: string
  order: number
  duration: number
  title: string
  description: string
  tips?: string[]
}

interface StudyPlan {
  id: string
  subject: string
  totalMinutes: number
  encouragement: string
  steps: StudyPlanStep[]
}

interface StudyRoadmapPanelProps {
  plan: StudyPlan
  onClose?: () => void
  className?: string
}

// Encouragement messages for completion
const COMPLETION_MESSAGES = [
  "Amazing work! You conquered what seemed impossible!",
  "You did it! From stuck to success - that's growth!",
  "Look at you go! Every step forward counts!",
  "Brilliant! You turned confusion into clarity!",
  "You showed up and pushed through. That's what winners do!",
  "Outstanding! You tackled this like a champion!",
  "Incredible progress! You should be proud!",
]

// Progress encouragements (shown during progress)
const PROGRESS_MESSAGES = [
  "You're making great progress!",
  "Keep going - you've got momentum!",
  "One step at a time - you're doing great!",
  "Stay focused - you're almost there!",
]

// Step item component - memoized for performance
const StepItem = memo(function StepItem({
  step,
  isCompleted,
  isActive,
  onToggle,
}: {
  step: StudyPlanStep
  isCompleted: boolean
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`p-4 rounded-xl transition-all ${
        isCompleted
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30'
          : isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30'
          : 'bg-neutral-50 dark:bg-neutral-800/50 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            isCompleted
              ? 'text-green-600 dark:text-green-400'
              : 'text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Circle className="w-6 h-6" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-semibold ${
                isCompleted
                  ? 'text-green-700 dark:text-green-300 line-through'
                  : 'text-neutral-900 dark:text-white'
              }`}
            >
              {step.title}
            </span>
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {step.duration} min
            </span>
          </div>
          <p
            className={`text-sm ${
              isCompleted
                ? 'text-green-600/70 dark:text-green-400/70'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {step.description}
          </p>
          {step.tips && step.tips.length > 0 && !isCompleted && (
            <div className="mt-2 space-y-1">
              {step.tips.map((tip, index) => (
                <p
                  key={index}
                  className="text-xs text-neutral-500 flex items-start gap-1"
                >
                  <span className="text-amber-500">•</span>
                  {tip}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default function StudyRoadmapPanel({
  plan,
  onClose,
  className = '',
}: StudyRoadmapPanelProps) {
  // State
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const [completionMessage, setCompletionMessage] = useState('')

  // Calculate progress
  const completedCount = completedSteps.size
  const totalCount = plan.steps.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)
  const allComplete = completedCount === totalCount

  // Find the current active step (first incomplete)
  const activeStepId = plan.steps.find((s) => !completedSteps.has(s.id))?.id

  // Toggle step completion
  const toggleStep = useCallback((stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  // Handle completion celebration
  useEffect(() => {
    if (allComplete && completedCount > 0) {
      // Pick a random completion message
      const message =
        COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]
      setCompletionMessage(message)
      setShowCelebration(true)
    } else {
      setShowCelebration(false)
    }
  }, [allComplete, completedCount])

  // Load state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`roadmap_progress_${plan.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setCompletedSteps(new Set(parsed))
        }
      }
    } catch {
      // Ignore errors
    }
  }, [plan.id])

  // Save state to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `roadmap_progress_${plan.id}`,
        JSON.stringify([...completedSteps])
      )
    } catch {
      // Ignore errors
    }
  }, [completedSteps, plan.id])

  // Get progress message
  const getProgressMessage = () => {
    if (completedCount === 0) return null
    if (allComplete) return null
    return PROGRESS_MESSAGES[Math.floor(Math.random() * PROGRESS_MESSAGES.length)]
  }

  return (
    <div
      className={`bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div
        className="p-4 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                Your Study Plan
              </h3>
              <p className="text-xs text-neutral-500">
                {completedCount}/{totalCount} completed • {progressPercent}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            )}
            <button className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${
              allComplete
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Celebration */}
          {showCelebration && (
            <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/30 rounded-xl animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-green-700 dark:text-green-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    All steps complete!
                  </h4>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {completionMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress encouragement */}
          {!allComplete && completedCount > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                {getProgressMessage()}
              </p>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            {plan.steps.map((step) => (
              <StepItem
                key={step.id}
                step={step}
                isCompleted={completedSteps.has(step.id)}
                isActive={step.id === activeStepId}
                onToggle={() => toggleStep(step.id)}
              />
            ))}
          </div>

          {/* Subject & time info */}
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>{plan.subject}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {plan.totalMinutes} min total
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
