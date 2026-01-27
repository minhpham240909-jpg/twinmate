'use client'

/**
 * CALENDAR MONTH VIEW
 *
 * Full month calendar showing learning progress.
 * Features:
 * - Month navigation
 * - Day status indicators (completed, scheduled, missed, today)
 * - Click to view day details
 * - Weekly summary
 */

import { memo, useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Target,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react'

interface DayProgress {
  date: string // YYYY-MM-DD
  targetMinutes: number
  actualMinutes: number
  goalMet: boolean
  stepsCompleted: number
  capturesCreated: number
}

interface CalendarMonthProps {
  monthProgress: DayProgress[]
  currentMonth: number // 0-11
  currentYear: number
  onMonthChange: (year: number, month: number) => void
  onDaySelect?: (date: string) => void
  selectedDate?: string
  isLoading?: boolean
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const CalendarMonth = memo(function CalendarMonth({
  monthProgress,
  currentMonth,
  currentYear,
  onMonthChange,
  onDaySelect,
  selectedDate,
  isLoading = false,
}: CalendarMonthProps) {
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Build progress map for O(1) lookup
  const progressMap = useMemo(() => {
    const map = new Map<string, DayProgress>()
    monthProgress.forEach(day => {
      map.set(day.date, day)
    })
    return map
  }, [monthProgress])

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean } | null> = []

    // Add padding for days from previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date, day, isCurrentMonth: true })
    }

    return days
  }, [currentMonth, currentYear])

  // Month stats
  const monthStats = useMemo(() => {
    const completed = monthProgress.filter(d => d.goalMet).length
    const totalMinutes = monthProgress.reduce((sum, d) => sum + d.actualMinutes, 0)
    const totalSteps = monthProgress.reduce((sum, d) => sum + d.stepsCompleted, 0)
    return { completed, totalMinutes, totalSteps }
  }, [monthProgress])

  const handlePrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      onMonthChange(currentYear - 1, 11)
    } else {
      onMonthChange(currentYear, currentMonth - 1)
    }
  }, [currentMonth, currentYear, onMonthChange])

  const handleNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      onMonthChange(currentYear + 1, 0)
    } else {
      onMonthChange(currentYear, currentMonth + 1)
    }
  }, [currentMonth, currentYear, onMonthChange])

  const handleTodayClick = useCallback(() => {
    const now = new Date()
    onMonthChange(now.getFullYear(), now.getMonth())
    if (onDaySelect) {
      onDaySelect(today)
    }
  }, [onMonthChange, onDaySelect, today])

  const getDayStatus = (date: string): 'completed' | 'partial' | 'missed' | 'scheduled' | 'future' | 'none' => {
    const progress = progressMap.get(date)
    const isToday = date === today
    const isPast = date < today

    if (progress) {
      if (progress.goalMet) return 'completed'
      if (progress.actualMinutes > 0) return 'partial'
      if (isPast) return 'missed'
      if (isToday) return 'scheduled'
    }

    if (isPast) return 'none'
    return 'future'
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>

          <div className="text-center">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* Quick today button */}
        <button
          onClick={handleTodayClick}
          className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_OF_WEEK.map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dayInfo, index) => {
            if (!dayInfo) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const { date, day } = dayInfo
            const status = getDayStatus(date)
            const progress = progressMap.get(date)
            const isToday = date === today
            const isSelected = date === selectedDate

            return (
              <button
                key={date}
                onClick={() => onDaySelect?.(date)}
                disabled={isLoading}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all
                  ${isToday ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-neutral-900' : ''}
                  ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}
                `}
              >
                {/* Day number */}
                <span
                  className={`text-sm font-medium ${
                    isToday
                      ? 'text-blue-600 dark:text-blue-400'
                      : status === 'completed'
                      ? 'text-green-600 dark:text-green-400'
                      : status === 'missed'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {day}
                </span>

                {/* Status indicator */}
                <div className="absolute bottom-1">
                  {status === 'completed' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  )}
                  {status === 'partial' && (
                    <div className="w-3 h-3 rounded-full border-2 border-yellow-500 bg-yellow-500/30" />
                  )}
                  {status === 'missed' && (
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                  )}
                  {status === 'scheduled' && (
                    <Circle className="w-3.5 h-3.5 text-blue-500" />
                  )}
                </div>

                {/* Progress indicator on hover */}
                {progress && progress.actualMinutes > 0 && (
                  <div className="absolute inset-x-1 bottom-0 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        progress.goalMet ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (progress.actualMinutes / progress.targetMinutes) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Month summary */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-lg font-bold">{monthStats.completed}</span>
            </div>
            <div className="text-xs text-neutral-500">goals met</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-bold">{Math.round(monthStats.totalMinutes / 60)}h</span>
            </div>
            <div className="text-xs text-neutral-500">total time</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-lg font-bold">{monthStats.totalSteps}</span>
            </div>
            <div className="text-xs text-neutral-500">steps done</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex flex-wrap justify-center gap-4 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-yellow-500 bg-yellow-500/30" />
          <span>Partial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="w-3 h-3 text-blue-500" />
          <span>Scheduled</span>
        </div>
      </div>
    </div>
  )
})

export default CalendarMonth
