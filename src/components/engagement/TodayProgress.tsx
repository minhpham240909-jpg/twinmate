'use client'

/**
 * TODAY'S PROGRESS
 *
 * Shows daily commitment progress with visual feedback.
 * Features:
 * - Circular progress indicator
 * - Minutes learned vs goal
 * - Streak status
 * - At-risk warning
 */

import { memo } from 'react'
import {
  Flame,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import type { TodayProgress as TodayProgressType, StreakData, StreakStats } from '@/hooks/useEngagement'

interface TodayProgressProps {
  progress: TodayProgressType | null
  streak: StreakData | null
  streakStats: StreakStats | null
  isLoading: boolean
}

export const TodayProgress = memo(function TodayProgress({
  progress,
  streak,
  streakStats,
  isLoading,
}: TodayProgressProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
          </div>
        </div>
      </div>
    )
  }

  if (!progress) {
    return null
  }

  const { minutesLearned, goalMinutes, percentComplete, goalMet } = progress
  const progressPercent = Math.min(percentComplete, 100)
  const circumference = 2 * Math.PI * 36 // radius = 36
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  // Determine color based on progress
  const getProgressColor = () => {
    if (goalMet) return 'text-green-500'
    if (percentComplete >= 75) return 'text-blue-500'
    if (percentComplete >= 50) return 'text-amber-500'
    return 'text-neutral-400'
  }

  const getBgGradient = () => {
    if (goalMet) return 'from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20'
    if (streakStats?.atRisk) return 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20'
    return 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20'
  }

  return (
    <div className={`bg-gradient-to-br ${getBgGradient()} rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5`}>
      {/* At-risk warning */}
      {streakStats?.atRisk && !goalMet && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {streakStats.hoursRemaining > 0
              ? `${streakStats.hoursRemaining}h left to keep your streak!`
              : 'Complete your goal today to keep your streak!'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-5">
        {/* Circular Progress */}
        <div className="relative flex-shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-neutral-200 dark:text-neutral-700"
            />
            {/* Progress circle */}
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${getProgressColor()} transition-all duration-500 ease-out`}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {goalMet ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : (
              <>
                <span className="text-xl font-bold text-neutral-900 dark:text-white">
                  {minutesLearned}
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  / {goalMinutes} min
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {goalMet ? 'Goal Complete!' : "Today's Progress"}
            </h3>
            {goalMet && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                +{progress.xpEarned} XP
              </span>
            )}
          </div>

          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {goalMet
              ? 'Great work! Come back tomorrow to continue.'
              : `${goalMinutes - minutesLearned} minutes to reach your daily goal`}
          </p>

          {/* Streak and stats row */}
          <div className="flex items-center gap-4">
            {streak && streak.current > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {streak.current} day streak
                </span>
              </div>
            )}

            {progress.stepsCompleted > 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {progress.stepsCompleted} step{progress.stepsCompleted > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {progress.capturesCreated > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {progress.capturesCreated} capture{progress.capturesCreated > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly progress mini */}
      {streak && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              This week
            </span>
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {streakStats?.thisWeek.daysCompleted || 0} / 7 days
            </span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              // Simple logic: show completed for days up to current streak
              const isCompleted = i < (streakStats?.thisWeek.daysCompleted || 0)
              const isToday = new Date().getDay() === (i + 1) % 7

              return (
                <div
                  key={day}
                  className={`flex-1 h-2 rounded-full ${
                    isCompleted
                      ? 'bg-green-500'
                      : isToday
                      ? 'bg-blue-300 dark:bg-blue-700'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                  }`}
                  title={day}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
