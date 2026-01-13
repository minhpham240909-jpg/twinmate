'use client'

/**
 * QuickFocusCard - 5-Minute Focus Challenge
 *
 * Simple, frictionless entry to focused study:
 * - One button: "Start"
 * - AI analyzes profile → gives ONE tiny task
 * - Silent focus room with live student count
 * - No interruptions during session
 * - Reward moment at the end
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Zap, ChevronRight, Play, RefreshCw, Loader2 } from 'lucide-react'

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

interface QuickFocusCardProps {
  className?: string
}

export default function QuickFocusCard({ className = '' }: QuickFocusCardProps) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [stats, setStats] = useState<FocusStats | null>(null)
  const [, setIsLoadingStats] = useState(true)

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

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Continue existing session
  const handleContinueSession = () => {
    if (stats?.activeSession) {
      router.push(`/focus/${stats.activeSession.id}`)
    }
  }

  // Abandon old session and start fresh
  const handleStartFresh = async () => {
    if (isStarting) return
    setIsStarting(true)

    try {
      if (stats?.activeSession) {
        await fetch(`/api/focus/${stats.activeSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ABANDONED', actualMinutes: 0 }),
        })
      }
      await startNewSession()
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  // Start new focus session with profile-based AI task
  const startNewSession = async () => {
    try {
      // Create session - API will analyze profile and generate task
      const response = await fetch('/api/focus/start-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 5 }),
      })

      if (!response.ok) {
        // Fallback to regular focus if smart start fails
        const fallbackResponse = await fetch('/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMinutes: 5, mode: 'solo' }),
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

  // Start focus session
  const handleStartFocus = async () => {
    if (isStarting) return
    setIsStarting(true)
    await startNewSession()
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
                  5 minutes. One task. Let&apos;s go.
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
          {stats && stats.liveUsersCount > 0 && (
            <div className="mb-6 flex items-center justify-center gap-2 text-white/80 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>{stats.liveUsersCount} students focusing right now</span>
            </div>
          )}

          {/* Action Buttons */}
          {stats?.activeSession ? (
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
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-all flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    <span>Start New</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartFocus}
              disabled={isStarting}
              className="w-full py-5 sm:py-6 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl sm:text-2xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-7 h-7 text-blue-600" />
                  <span>Start</span>
                  <ChevronRight className="w-6 h-6 text-blue-500" />
                </>
              )}
            </button>
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
    </div>
  )
}
