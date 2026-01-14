'use client'

/**
 * QuickFocusCard - Quick Focus Session Entry
 *
 * Two modes:
 * 1. Quick Start (default) - 1 click, AI generates smart task, instant start
 * 2. Custom Task (optional) - For motivated students who want to specify
 *
 * Goal: Get user to START, not to be productive
 * Never force typing first - kills retention
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Zap, Play, RefreshCw, Loader2, X, Edit3 } from 'lucide-react'

interface ActiveSession {
  id: string
  durationMinutes: number
  startedAt: string
  timeRemaining: number
}

interface FocusStats {
  liveUsersCount: number
  todayCompletedCount: number
  userStreak: number
  userTodaySessions: number
  userTotalSessions: number
  userPercentile: number
  activeSession: ActiveSession | null
}

interface StudyingCount {
  count: number
  timestamp: string
}

interface QuickFocusCardProps {
  className?: string
}

// Duration options in minutes
const DURATION_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
]

export default function QuickFocusCard({ className = '' }: QuickFocusCardProps) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [stats, setStats] = useState<FocusStats | null>(null)
  const [, setIsLoadingStats] = useState(true)
  const [studyingCount, setStudyingCount] = useState<StudyingCount | null>(null)

  // Duration selection for quick start
  const [selectedDuration, setSelectedDuration] = useState(10)
  const [showDurationPicker, setShowDurationPicker] = useState(false)

  // Custom task modal state (optional flow)
  const [showCustomTaskModal, setShowCustomTaskModal] = useState(false)
  const [userTask, setUserTask] = useState('')
  const taskInputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch live stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/focus/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch focus stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  // Fetch global studying count
  const fetchStudyingCount = useCallback(async () => {
    try {
      const response = await fetch('/api/presence/studying-count')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStudyingCount(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch studying count:', error)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchStudyingCount()
    const statsInterval = setInterval(fetchStats, 30000)
    const countInterval = setInterval(fetchStudyingCount, 15000)
    return () => {
      clearInterval(statsInterval)
      clearInterval(countInterval)
    }
  }, [fetchStats, fetchStudyingCount])

  // Focus textarea when custom modal opens
  useEffect(() => {
    if (showCustomTaskModal && taskInputRef.current) {
      taskInputRef.current.focus()
    }
  }, [showCustomTaskModal])

  // Continue existing session
  const handleContinueSession = () => {
    if (stats?.activeSession) {
      router.push(`/focus/${stats.activeSession.id}`)
    }
  }

  // QUICK START - 1 click, no typing required
  const handleQuickStart = async () => {
    if (isStarting) return
    setIsStarting(true)
    setShowDurationPicker(false)

    try {
      // Start session without user task - AI generates smart task
      const response = await fetch('/api/focus/start-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: selectedDuration,
          // No userTask - let AI generate based on context
        }),
      })

      if (!response.ok) {
        // Fallback to basic session
        const fallbackResponse = await fetch('/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            durationMinutes: selectedDuration,
            mode: 'solo',
          }),
        })
        if (!fallbackResponse.ok) throw new Error('Failed to start session')
        const data = await fallbackResponse.json()
        router.push(`/focus/${data.session.id}`)
        return
      }

      const data = await response.json()
      router.push(`/focus/${data.session.id}`)
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  // CUSTOM TASK - For motivated students
  const handleCustomTaskStart = async () => {
    if (!userTask.trim() || isStarting) return
    setIsStarting(true)
    setShowCustomTaskModal(false)

    try {
      const response = await fetch('/api/focus/start-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: selectedDuration,
          userTask: userTask.trim(),
        }),
      })

      if (!response.ok) {
        const fallbackResponse = await fetch('/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            durationMinutes: selectedDuration,
            mode: 'solo',
            label: userTask.trim(),
          }),
        })
        if (!fallbackResponse.ok) throw new Error('Failed to start session')
        const data = await fallbackResponse.json()
        router.push(`/focus/${data.session.id}`)
        return
      }

      const data = await response.json()
      router.push(`/focus/${data.session.id}`)
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
      setShowCustomTaskModal(true)
    }
  }

  // Abandon old session and start fresh
  const handleStartFresh = async () => {
    if (isStarting) return

    try {
      if (stats?.activeSession) {
        await fetch(`/api/focus/${stats.activeSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ABANDONED', actualMinutes: 0 }),
        })
      }
      // After abandoning, show duration picker for new quick start
      setShowDurationPicker(true)
    } catch (error) {
      console.error('Error abandoning session:', error)
    }
  }

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Main Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-600/20 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Quick Focus
                </h2>
                <p className="text-white/70 text-sm">
                  Start now, think later
                </p>
              </div>
            </div>

            {/* Streak Badge */}
            {stats && stats.userStreak > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-400/90 text-amber-900 rounded-full px-3 py-1.5">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-bold">Day {stats.userStreak}</span>
              </div>
            )}
          </div>

          {/* Live students count */}
          {studyingCount && studyingCount.count > 0 && (
            <div className="mb-6 flex items-center justify-center gap-2 text-white/80 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>{studyingCount.count} student{studyingCount.count > 1 ? 's' : ''} studying right now</span>
            </div>
          )}

          {/* Action Buttons */}
          {stats?.activeSession ? (
            // Has active session
            <div className="space-y-3">
              <button
                onClick={handleContinueSession}
                className="w-full py-4 sm:py-5 bg-white hover:bg-blue-50 rounded-2xl font-bold text-lg sm:text-xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
              >
                <Play className="w-6 h-6 text-blue-600 fill-blue-600" />
                <span>Continue</span>
                <span className="text-blue-500 font-mono text-base">
                  {formatTimeRemaining(stats.activeSession.timeRemaining)}
                </span>
              </button>

              <button
                onClick={handleStartFresh}
                disabled={isStarting}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Start New Session</span>
              </button>
            </div>
          ) : showDurationPicker ? (
            // Duration picker before quick start
            <div className="space-y-4">
              <p className="text-white/80 text-center text-sm">How long?</p>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedDuration(option.value)}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      selectedDuration === option.value
                        ? 'bg-white text-blue-700'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleQuickStart}
                disabled={isStarting}
                className="w-full py-5 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 text-blue-600" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>

              {/* Optional: Custom task link */}
              <button
                onClick={() => {
                  setShowDurationPicker(false)
                  setShowCustomTaskModal(true)
                }}
                className="w-full text-white/60 hover:text-white/90 text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span>I want to specify my task</span>
              </button>
            </div>
          ) : (
            // Default: Big start button
            <div className="space-y-3">
              <button
                onClick={() => setShowDurationPicker(true)}
                disabled={isStarting}
                className="w-full py-5 sm:py-6 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl sm:text-2xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-7 h-7 text-blue-600" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>

              {/* Optional: Custom task link */}
              <button
                onClick={() => setShowCustomTaskModal(true)}
                className="w-full text-white/60 hover:text-white/90 text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span>I want to specify my task</span>
              </button>
            </div>
          )}

          {/* Stats Row */}
          {stats && stats.userTodaySessions > 0 && (
            <div className="mt-5 text-center text-white/60 text-sm">
              <span className="font-semibold text-white/90">{stats.userTodaySessions}</span>
              {' '}session{stats.userTodaySessions === 1 ? '' : 's'} today
            </div>
          )}
        </div>
      </div>

      {/* Custom Task Modal (Optional Flow) */}
      {showCustomTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  What are you working on?
                </h3>
                <button
                  onClick={() => setShowCustomTaskModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Be specific. AI will give you one clear action.
              </p>
            </div>

            {/* Task Input */}
            <div className="p-6 space-y-4">
              <textarea
                ref={taskInputRef}
                value={userTask}
                onChange={(e) => setUserTask(e.target.value)}
                placeholder="e.g., Math homework chapter 5, History essay on WWII, Debug the login function..."
                rows={3}
                className="w-full px-4 py-4 bg-neutral-100 dark:bg-neutral-800 border-0 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-blue-500 outline-none text-lg resize-none"
              />

              {/* Duration Selection */}
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                  How long?
                </p>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedDuration(option.value)}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                        selectedDuration === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={handleCustomTaskStart}
                disabled={!userTask.trim() || isStarting}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-neutral-300 disabled:to-neutral-300 dark:disabled:from-neutral-700 dark:disabled:to-neutral-700 text-white rounded-xl font-bold text-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>Start {selectedDuration}-min focus</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowCustomTaskModal(false)
                  setShowDurationPicker(true)
                }}
                className="w-full text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-sm transition-colors"
              >
                Skip, just start quickly
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
