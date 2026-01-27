'use client'

/**
 * STREAK DISPLAY
 *
 * Shows streak statistics and milestones.
 * Features:
 * - Current streak with fire animation
 * - Longest streak comparison
 * - Weekly/monthly stats
 * - Freeze availability
 */

import { memo } from 'react'
import {
  Flame,
  Trophy,
  Calendar,
  Clock,
  Zap,
  Shield,
  TrendingUp,
} from 'lucide-react'
import type { StreakData, StreakStats } from '@/hooks/useEngagement'

interface StreakDisplayProps {
  streak: StreakData | null
  stats: StreakStats | null
  isLoading: boolean
  compact?: boolean
}

export const StreakDisplay = memo(function StreakDisplay({
  streak,
  stats,
  isLoading,
  compact = false,
}: StreakDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
          <div className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>
    )
  }

  if (!streak || !stats) {
    return null
  }

  const { current, longest } = streak
  const isNewRecord = current > 0 && current === longest

  if (compact) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl border border-orange-200 dark:border-orange-800/50">
        <div className="flex items-center gap-2">
          <Flame className={`w-5 h-5 ${current > 0 ? 'text-orange-500 animate-pulse' : 'text-neutral-400'}`} />
          <span className="text-lg font-bold text-neutral-900 dark:text-white">
            {current}
          </span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            day streak
          </span>
        </div>

        {stats.freezes.available > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {stats.freezes.available} freeze{stats.freezes.available > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header with streak */}
      <div className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              Current Streak
            </h3>
            <div className="flex items-baseline gap-2">
              <Flame className={`w-8 h-8 ${current > 0 ? 'text-orange-500' : 'text-neutral-300 dark:text-neutral-600'}`} />
              <span className="text-4xl font-bold text-neutral-900 dark:text-white">
                {current}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                day{current !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {isNewRecord && current > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Trophy className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                New Record!
              </span>
            </div>
          )}
        </div>

        {/* Longest streak comparison */}
        {!isNewRecord && longest > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600 dark:text-neutral-400">
              Longest: <span className="font-semibold text-neutral-900 dark:text-white">{longest} days</span>
            </span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="p-5 grid grid-cols-3 gap-4">
        {/* This Week */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 dark:text-neutral-400 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs">This Week</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-white">
            {stats.thisWeek.daysCompleted}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            days
          </div>
        </div>

        {/* This Month */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 dark:text-neutral-400 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">This Month</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-white">
            {stats.thisMonth.daysCompleted}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            days
          </div>
        </div>

        {/* Total XP */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 dark:text-neutral-400 mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs">Total</span>
          </div>
          <div className="text-lg font-bold text-neutral-900 dark:text-white">
            {stats.allTime.xpEarned.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            XP
          </div>
        </div>
      </div>

      {/* Streak freeze info */}
      {stats.freezes.available > 0 && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <Shield className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {stats.freezes.available} Streak Freeze{stats.freezes.available > 1 ? 's' : ''} Available
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                Protects your streak if you miss a day
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning time summary */}
      <div className="px-5 pb-5 pt-0">
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Total learning time
            </span>
            <span className="font-semibold text-neutral-900 dark:text-white">
              {Math.round(stats.allTime.minutesLearned / 60 * 10) / 10} hours
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-neutral-600 dark:text-neutral-400">
              Days completed
            </span>
            <span className="font-semibold text-neutral-900 dark:text-white">
              {stats.allTime.daysCompleted}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
