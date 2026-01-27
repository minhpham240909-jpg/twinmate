'use client'

/**
 * CALENDAR WEEK VIEW
 *
 * Shows the current week's learning activity.
 * Features:
 * - Visual day indicators (completed/current/upcoming)
 * - Minutes learned per day
 * - Week total summary
 */

import { memo, useMemo } from 'react'
import {
  CheckCircle2,
  Circle,
  Flame,
} from 'lucide-react'
import type { WeekProgress } from '@/hooks/useEngagement'

interface CalendarWeekProps {
  weekProgress: WeekProgress | null
  isLoading: boolean
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CalendarWeek = memo(function CalendarWeek({
  weekProgress,
  isLoading,
}: CalendarWeekProps) {
  // Get current day index (0 = Monday, 6 = Sunday)
  const todayIndex = useMemo(() => {
    const day = new Date().getDay()
    // Convert from Sunday = 0 to Monday = 0
    return day === 0 ? 6 : day - 1
  }, [])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
        <div className="animate-pulse">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3 mb-4" />
          <div className="flex gap-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex-1 h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Build days data
  const days = useMemo(() => {
    return DAY_LABELS.map((label, i) => {
      const dayData = weekProgress?.days?.[i]
      const isToday = i === todayIndex
      const isPast = i < todayIndex
      const isFuture = i > todayIndex

      return {
        label,
        isToday,
        isPast,
        isFuture,
        goalMet: dayData?.goalMet ?? false,
        minutesLearned: dayData?.minutesLearned ?? 0,
        goalMinutes: dayData?.goalMinutes ?? 0,
      }
    })
  }, [weekProgress, todayIndex])

  const completedDays = days.filter(d => d.goalMet).length
  const totalMinutes = weekProgress?.totalMinutes ?? 0

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          This Week
        </h3>
        <div className="flex items-center gap-2">
          {completedDays > 0 && (
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {completedDays} day{completedDays !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <span className="text-xs text-neutral-400">
            {Math.round(totalMinutes / 60 * 10) / 10}h total
          </span>
        </div>
      </div>

      {/* Days grid */}
      <div className="flex gap-2">
        {days.map((day) => (
          <div
            key={day.label}
            className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-colors ${
              day.isToday
                ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/50'
                : day.goalMet
                ? 'bg-green-50 dark:bg-green-950/20'
                : day.isPast
                ? 'bg-neutral-50 dark:bg-neutral-800/50'
                : 'bg-neutral-50 dark:bg-neutral-800/30'
            }`}
          >
            {/* Day label */}
            <span className={`text-[10px] font-medium uppercase mb-1 ${
              day.isToday
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-neutral-400'
            }`}>
              {day.label}
            </span>

            {/* Status icon */}
            <div className="my-1">
              {day.goalMet ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : day.isToday ? (
                <Circle className="w-5 h-5 text-blue-400" fill="currentColor" fillOpacity={0.2} />
              ) : day.isPast ? (
                <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
              ) : (
                <Circle className="w-5 h-5 text-neutral-200 dark:text-neutral-700" />
              )}
            </div>

            {/* Minutes */}
            {day.minutesLearned > 0 && (
              <span className={`text-[10px] ${
                day.goalMet
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {day.minutesLearned}m
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Weekly goal progress */}
      {weekProgress && (
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-neutral-600 dark:text-neutral-400">
              Weekly progress
            </span>
            <span className="font-medium text-neutral-900 dark:text-white">
              {completedDays} / 7 days
            </span>
          </div>
          <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedDays / 7) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
})
