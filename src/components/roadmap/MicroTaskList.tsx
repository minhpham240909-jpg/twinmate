'use client'

/**
 * MICROTASK LIST COMPONENT
 *
 * Displays all micro-tasks for a roadmap step with progress tracking.
 * Replaces the old "Days 1-5" format with task-based progression.
 *
 * Features:
 * - Progress bar showing completion status
 * - Automatic current task detection
 * - Collapsed view for completed tasks
 * - Step completion celebration
 */

import { memo, useMemo, useState } from 'react'
import { MicroTaskCard, type MicroTask, type MicroTaskStatus } from './MicroTaskCard'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Trophy,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface MicroTaskListProps {
  tasks: MicroTask[]
  stepId: string
  stepTitle: string
  onStartTask: (taskId: string) => Promise<void>
  onCompleteTask: (taskId: string, proof?: string) => Promise<void>
  onSkipTask: (taskId: string) => Promise<void>
  isLoading?: boolean
  loadingTaskId?: string | null
}

// ============================================
// COMPONENT
// ============================================

export const MicroTaskList = memo(function MicroTaskList({
  tasks,
  stepId,
  stepTitle,
  onStartTask,
  onCompleteTask,
  onSkipTask,
  isLoading = false,
  loadingTaskId = null,
}: MicroTaskListProps) {
  const [showCompleted, setShowCompleted] = useState(false)

  // Calculate progress
  const { completed, inProgress, pending, total, percentage } = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'SKIPPED')
    const inProgressTask = tasks.find(t => t.status === 'IN_PROGRESS')
    const pendingTasks = tasks.filter(t => t.status === 'PENDING')

    return {
      completed: completedTasks.length,
      inProgress: inProgressTask ? 1 : 0,
      pending: pendingTasks.length,
      total: tasks.length,
      percentage: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
    }
  }, [tasks])

  // Find current task (first non-completed task)
  const currentTaskIndex = useMemo(() => {
    return tasks.findIndex(t => t.status !== 'COMPLETED' && t.status !== 'SKIPPED')
  }, [tasks])

  // Split tasks into completed and active
  const { completedTasks, activeTasks } = useMemo(() => {
    const completed: MicroTask[] = []
    const active: MicroTask[] = []

    tasks.forEach(task => {
      if (task.status === 'COMPLETED' || task.status === 'SKIPPED') {
        completed.push(task)
      } else {
        active.push(task)
      }
    })

    return { completedTasks: completed, activeTasks: active }
  }, [tasks])

  const isStepComplete = completed === total && total > 0

  // Handlers with proper async handling
  const handleStart = async (taskId: string) => {
    await onStartTask(taskId)
  }

  const handleComplete = async (taskId: string, proof?: string) => {
    await onCompleteTask(taskId, proof)
  }

  const handleSkip = async (taskId: string) => {
    await onSkipTask(taskId)
  }

  if (tasks.length === 0) {
    return (
      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-center">
        <ListChecks className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No micro-tasks defined for this step
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Tasks
            </h3>
          </div>
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {completed}/{total} complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Status Summary */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          {inProgress > 0 && (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              1 in progress
            </span>
          )}
          {pending > 0 && (
            <span className="text-neutral-500 dark:text-neutral-400">
              {pending} remaining
            </span>
          )}
          {isStepComplete && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
              <Trophy className="w-3 h-3" />
              Step complete!
            </span>
          )}
        </div>
      </div>

      {/* Step Complete Celebration */}
      {isStepComplete && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">
                All tasks completed!
              </h4>
              <p className="text-sm text-green-600 dark:text-green-400">
                You've finished "{stepTitle}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Tasks (Collapsible) */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 w-full p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {completedTasks.length} completed task{completedTasks.length > 1 ? 's' : ''}
            </span>
            {showCompleted ? (
              <ChevronUp className="w-4 h-4 text-neutral-400 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400 ml-auto" />
            )}
          </button>

          {showCompleted && (
            <div className="mt-2 space-y-2">
              {completedTasks.map(task => (
                <MicroTaskCard
                  key={task.id}
                  task={task}
                  stepId={stepId}
                  isCurrentTask={false}
                  onStart={handleStart}
                  onComplete={handleComplete}
                  onSkip={handleSkip}
                  isLoading={isLoading && loadingTaskId === task.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Tasks */}
      <div className="space-y-3">
        {activeTasks.map((task, index) => {
          const taskIndex = tasks.findIndex(t => t.id === task.id)
          const isCurrentTask = taskIndex === currentTaskIndex

          return (
            <MicroTaskCard
              key={task.id}
              task={task}
              stepId={stepId}
              isCurrentTask={isCurrentTask}
              onStart={handleStart}
              onComplete={handleComplete}
              onSkip={handleSkip}
              isLoading={isLoading && loadingTaskId === task.id}
            />
          )
        })}
      </div>

      {/* Estimated Time Remaining */}
      {!isStepComplete && activeTasks.length > 0 && (
        <div className="text-center py-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            ~{activeTasks.reduce((sum, t) => sum + t.duration, 0)} minutes remaining
          </p>
        </div>
      )}
    </div>
  )
})

export default MicroTaskList
