'use client'

/**
 * CALENDAR PAGE
 *
 * Full learning calendar with month view and day details.
 * Features:
 * - Month navigation
 * - Day progress details
 * - Upcoming scheduled sessions
 * - Calendar sync options
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { CalendarMonth } from '@/components/engagement/CalendarMonth'
import BottomNav from '@/components/BottomNav'
import {
  Loader2,
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Target,
  CheckCircle2,
  FileText,
  ChevronRight,
  Play,
} from 'lucide-react'

interface DayProgress {
  date: string
  targetMinutes: number
  actualMinutes: number
  goalMet: boolean
  stepsCompleted: number
  capturesCreated: number
}

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [monthData, setMonthData] = useState<DayProgress[]>([])
  const [isLoadingMonth, setIsLoadingMonth] = useState(false)

  // Fetch month data when month changes
  useEffect(() => {
    const fetchMonthData = async () => {
      setIsLoadingMonth(true)
      try {
        const response = await fetch(
          `/api/engagement/progress?year=${currentYear}&month=${currentMonth + 1}&type=month`
        )
        const data = await response.json()
        if (response.ok && data.monthProgress) {
          setMonthData(data.monthProgress)
        }
      } catch (error) {
        console.error('Failed to fetch month data:', error)
      } finally {
        setIsLoadingMonth(false)
      }
    }

    if (user) {
      fetchMonthData()
    }
  }, [currentYear, currentMonth, user])

  // Get selected day details
  const selectedDayData = useMemo(() => {
    return monthData.find(d => d.date === selectedDate)
  }, [monthData, selectedDate])

  const handleMonthChange = useCallback((year: number, month: number) => {
    setCurrentYear(year)
    setCurrentMonth(month)
  }, [])

  const handleDaySelect = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  const isToday = (dateStr: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return dateStr === todayStr
  }

  const isPast = (dateStr: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return dateStr < todayStr
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Learning Calendar
          </h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Calendar */}
        <CalendarMonth
          monthProgress={monthData}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onMonthChange={handleMonthChange}
          onDaySelect={handleDaySelect}
          selectedDate={selectedDate}
          isLoading={isLoadingMonth}
        />

        {/* Selected day details */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              {formatDate(selectedDate)}
              {isToday(selectedDate) && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                  Today
                </span>
              )}
            </h3>
          </div>

          {selectedDayData ? (
            <div className="p-4 space-y-4">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    Daily Progress
                  </span>
                  <span className={`font-medium ${
                    selectedDayData.goalMet
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-neutral-900 dark:text-white'
                  }`}>
                    {selectedDayData.actualMinutes}/{selectedDayData.targetMinutes} min
                  </span>
                </div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedDayData.goalMet ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (selectedDayData.actualMinutes / selectedDayData.targetMinutes) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-lg font-bold">{selectedDayData.actualMinutes}</span>
                  </div>
                  <div className="text-xs text-neutral-500">minutes</div>
                </div>
                <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-lg font-bold">{selectedDayData.stepsCompleted}</span>
                  </div>
                  <div className="text-xs text-neutral-500">steps</div>
                </div>
                <div className="text-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-lg font-bold">{selectedDayData.capturesCreated}</span>
                  </div>
                  <div className="text-xs text-neutral-500">notes</div>
                </div>
              </div>

              {/* Goal status */}
              {selectedDayData.goalMet ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-100">
                      Goal Completed!
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      You hit your {selectedDayData.targetMinutes} minute goal
                    </div>
                  </div>
                </div>
              ) : isPast(selectedDate) ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <Target className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <div className="font-medium text-red-900 dark:text-red-100">
                      Goal Missed
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      {selectedDayData.actualMinutes > 0
                        ? `You made ${selectedDayData.actualMinutes} minutes of progress`
                        : 'No learning activity recorded'}
                    </div>
                  </div>
                </div>
              ) : isToday(selectedDate) ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        Continue Learning
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        {selectedDayData.targetMinutes - selectedDayData.actualMinutes} minutes left today
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="p-8 text-center">
              {isPast(selectedDate) ? (
                <>
                  <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-400">
                    No learning activity recorded
                  </div>
                </>
              ) : isToday(selectedDate) ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Start Learning
                </button>
              ) : (
                <>
                  <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-400">
                    Upcoming day
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Calendar sync section */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">
            Sync with Calendar
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Add your learning schedule to your calendar to stay on track.
          </p>
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" />
              </svg>
              Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
              </svg>
              Apple
            </button>
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  )
}
