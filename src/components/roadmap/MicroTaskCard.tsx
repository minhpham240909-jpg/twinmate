'use client'

/**
 * MICROTASK CARD COMPONENT
 *
 * Displays an individual micro-task within a roadmap step.
 * Task-based progression replaces the old "Days 1-5" format.
 *
 * Features:
 * - Task type indicators (ACTION, LEARN, PRACTICE, TEST, REFLECT)
 * - Progress tracking with visual feedback
 * - Optional proof submission for verification
 * - Estimated duration display
 */

import { memo, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Play,
  BookOpen,
  Dumbbell,
  ClipboardCheck,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  Upload,
  Loader2,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export type MicroTaskType = 'ACTION' | 'LEARN' | 'PRACTICE' | 'TEST' | 'REFLECT'
export type MicroTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'

export interface MicroTask {
  id: string
  order: number
  title: string
  description: string
  taskType: MicroTaskType
  duration: number // minutes
  verificationMethod?: string
  proofRequired: boolean
  status: MicroTaskStatus
  completedAt?: string
  attempts: number
}

interface MicroTaskCardProps {
  task: MicroTask
  stepId: string
  isCurrentTask: boolean
  onStart: (taskId: string) => void
  onComplete: (taskId: string, proof?: string) => void
  onSkip: (taskId: string) => void
  isLoading?: boolean
}

// ============================================
// HELPERS
// ============================================

const getTaskTypeConfig = (type: MicroTaskType) => {
  const configs: Record<MicroTaskType, { icon: typeof Play; label: string; color: string; bgColor: string }> = {
    ACTION: {
      icon: Play,
      label: 'Action',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    LEARN: {
      icon: BookOpen,
      label: 'Learn',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
    PRACTICE: {
      icon: Dumbbell,
      label: 'Practice',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    },
    TEST: {
      icon: ClipboardCheck,
      label: 'Test',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    REFLECT: {
      icon: MessageSquare,
      label: 'Reflect',
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    },
  }
  return configs[type]
}

const getStatusStyles = (status: MicroTaskStatus, isCurrentTask: boolean) => {
  if (status === 'COMPLETED') {
    return {
      border: 'border-green-200 dark:border-green-800',
      bg: 'bg-green-50/50 dark:bg-green-950/20',
      opacity: 'opacity-80',
    }
  }
  if (status === 'SKIPPED') {
    return {
      border: 'border-neutral-200 dark:border-neutral-800',
      bg: 'bg-neutral-50/50 dark:bg-neutral-950/20',
      opacity: 'opacity-60',
    }
  }
  if (status === 'IN_PROGRESS') {
    return {
      border: 'border-blue-400 dark:border-blue-600',
      bg: 'bg-white dark:bg-neutral-900',
      opacity: '',
    }
  }
  // PENDING
  return {
    border: isCurrentTask
      ? 'border-blue-200 dark:border-blue-800'
      : 'border-neutral-200 dark:border-neutral-800',
    bg: 'bg-white dark:bg-neutral-900',
    opacity: isCurrentTask ? '' : 'opacity-70',
  }
}

// ============================================
// COMPONENT
// ============================================

export const MicroTaskCard = memo(function MicroTaskCard({
  task,
  stepId: _stepId,
  isCurrentTask,
  onStart,
  onComplete,
  onSkip,
  isLoading = false,
}: MicroTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [proofText, setProofText] = useState('')
  const [showProofInput, setShowProofInput] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)

  const typeConfig = getTaskTypeConfig(task.taskType)
  const statusStyles = getStatusStyles(task.status, isCurrentTask)
  const TypeIcon = typeConfig.icon

  const handleComplete = () => {
    if (task.proofRequired && !proofText.trim()) {
      setShowProofInput(true)
      return
    }
    onComplete(task.id, proofText || undefined)
    setShowProofInput(false)
    setProofText('')
  }

  const canInteract = isCurrentTask && task.status !== 'COMPLETED' && task.status !== 'SKIPPED'

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        ${statusStyles.border} ${statusStyles.bg} ${statusStyles.opacity}
        ${canInteract ? 'hover:shadow-sm' : ''}
      `}
    >
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status Indicator */}
          <div className="flex-shrink-0 mt-0.5">
            {task.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : task.status === 'IN_PROGRESS' ? (
              <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              </div>
            ) : (
              <Circle className={`w-5 h-5 ${isCurrentTask ? 'text-blue-400' : 'text-neutral-300 dark:text-neutral-600'}`} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Task Type Badge */}
              <span className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                ${typeConfig.bgColor} ${typeConfig.color}
              `}>
                <TypeIcon className="w-3 h-3" />
                {typeConfig.label}
              </span>

              {/* Duration */}
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                <Clock className="w-3 h-3" />
                {task.duration}m
              </span>

              {/* Proof Required Badge */}
              {task.proofRequired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  <Upload className="w-3 h-3" />
                  Proof
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className={`
              font-medium text-neutral-900 dark:text-white
              ${task.status === 'COMPLETED' ? 'line-through text-neutral-500 dark:text-neutral-400' : ''}
            `}>
              {task.title}
            </h4>

            {/* Description (expandable) */}
            {task.description && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 mt-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show details
                  </>
                )}
              </button>
            )}
          </div>

          {/* Action Buttons */}
          {canInteract && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {task.status === 'PENDING' && (
                <button
                  onClick={() => onStart(task.id)}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Start'
                  )}
                </button>
              )}

              {task.status === 'IN_PROGRESS' && (
                <>
                  <button
                    onClick={handleComplete}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Done'
                    )}
                  </button>
                  {!showSkipConfirm ? (
                    <button
                      onClick={() => setShowSkipConfirm(true)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Skip
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onSkip(task.id)
                          setShowSkipConfirm(false)
                        }}
                        disabled={isLoading}
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowSkipConfirm(false)}
                        disabled={isLoading}
                        className="px-2 py-1 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Expanded Description */}
        {isExpanded && task.description && (
          <div className="mt-3 pl-8">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {task.description}
            </p>
            {task.verificationMethod && (
              <div className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                  How to verify
                </p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {task.verificationMethod}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Proof Input */}
        {showProofInput && task.status === 'IN_PROGRESS' && (
          <div className="mt-3 pl-8">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
                Provide proof of completion
              </p>
              <textarea
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="Describe what you did or paste a link..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleComplete}
                  disabled={!proofText.trim() || isLoading}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Submit
                </button>
                <button
                  onClick={() => setShowProofInput(false)}
                  className="px-3 py-1.5 text-neutral-500 hover:text-neutral-700 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Completion Info */}
      {task.status === 'COMPLETED' && task.completedAt && (
        <div className="px-4 py-2 border-t border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
          <p className="text-xs text-green-600 dark:text-green-400">
            Completed {new Date(task.completedAt).toLocaleDateString()}
            {task.attempts > 1 && ` (${task.attempts} attempts)`}
          </p>
        </div>
      )}
    </div>
  )
})

export default MicroTaskCard
