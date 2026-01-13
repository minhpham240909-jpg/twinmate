'use client'

/**
 * QuickFocusCard - Engaging Focus Challenge Entry Point
 *
 * Features:
 * - Live user count (real data only)
 * - Streak display with fire emoji
 * - Mode selection: Solo Focus vs AI-Guided Focus
 * - Big, inviting call-to-action button
 * - Instant timer start with no friction
 * - Gamification elements for motivation
 * - Blue color scheme
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Flame, Users, Zap, ChevronRight, Play, RefreshCw, Brain, Target } from 'lucide-react'

interface ActiveSession {
  id: string
  durationMinutes: number
  startedAt: string
  timeRemaining: number
  mode?: 'solo' | 'ai_guided'
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

type FocusMode = 'solo' | 'ai_guided'

interface QuickFocusCardProps {
  className?: string
}

export default function QuickFocusCard({ className = '' }: QuickFocusCardProps) {
  const router = useRouter()
  const t = useTranslations('quickFocus')
  const [isStarting, setIsStarting] = useState(false)
  const [stats, setStats] = useState<FocusStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [selectedMode, setSelectedMode] = useState<FocusMode>('solo')
  const [showModeSelector, setShowModeSelector] = useState(false)

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
    // Refresh stats every 30 seconds for live feel
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
      // Abandon the old session first if exists
      if (stats?.activeSession) {
        await fetch(`/api/focus/${stats.activeSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ABANDONED', actualMinutes: 0 }),
        })
      }

      // Start new session
      const response = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 5 }),
      })

      if (!response.ok) {
        throw new Error('Failed to start focus session')
      }

      const data = await response.json()
      router.push(`/focus/${data.session.id}`)
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  // Start new focus session (no existing session)
  const handleStartFocus = async () => {
    if (isStarting) return

    // If mode selector is not shown yet, show it first
    if (!showModeSelector) {
      setShowModeSelector(true)
      return
    }

    // If AI-guided mode, go to preview page
    if (selectedMode === 'ai_guided') {
      router.push('/focus/setup')
      return
    }

    // Solo mode - start immediately
    setIsStarting(true)

    try {
      const response = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 5, mode: 'solo' }),
      })

      if (!response.ok) {
        throw new Error('Failed to start focus session')
      }

      const data = await response.json()
      router.push(`/focus/${data.session.id}`)
    } catch (error) {
      console.error('Error starting focus session:', error)
      setIsStarting(false)
    }
  }

  // Handle mode selection
  const handleModeSelect = (mode: FocusMode) => {
    setSelectedMode(mode)
  }

  // Format time remaining (e.g., 125 seconds -> "2:05")
  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get the live users display text (real data only)
  const getLiveUsersText = (): string => {
    if (isLoadingStats) return ''
    const count = stats?.liveUsersCount || 0
    if (count === 0) {
      return t('noOneStudying')
    }
    return t('studyingNow', { count })
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Main Card - Blue gradient */}
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-500/25 relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-cyan-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Live Users Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="relative">
                <Users className="w-4 h-4 text-white" />
                {stats && stats.liveUsersCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-white/90 text-sm font-medium">
                {isLoadingStats ? (
                  <span className="inline-block w-20 h-4 bg-white/20 rounded animate-pulse" />
                ) : (
                  getLiveUsersText()
                )}
              </span>
            </div>

            {/* Streak Badge */}
            {stats && stats.userStreak > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-400/90 text-amber-900 rounded-full px-3 py-1.5">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-bold">Day {stats.userStreak}</span>
              </div>
            )}
          </div>

          {/* Main Heading */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  {t('challengeTitle')}
                </h2>
              </div>
            </div>
            <p className="text-white/80 text-base sm:text-lg ml-0 sm:ml-15">
              {t('challengeSubtitle')}
            </p>
          </div>

          {/* Action Buttons - Show Continue/Start Fresh if active session exists */}
          {stats?.activeSession ? (
            // User has an active session - show Continue and Start Fresh options
            <div className="space-y-3">
              {/* Continue Session - Primary */}
              <button
                onClick={handleContinueSession}
                className="w-full py-5 sm:py-6 bg-white hover:bg-blue-50 rounded-2xl font-bold text-xl sm:text-2xl text-blue-600 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/20 flex items-center justify-center gap-3 group"
              >
                <Play className="w-7 h-7 text-blue-500 fill-blue-500" />
                <span>Continue Session</span>
                <span className="text-blue-400 font-mono">
                  ({formatTimeRemaining(stats.activeSession.timeRemaining)} left)
                </span>
              </button>

              {/* Start Fresh - Secondary */}
              <button
                onClick={handleStartFresh}
                disabled={isStarting}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-all flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Starting fresh...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    <span>Start Fresh (5 min)</span>
                  </>
                )}
              </button>
            </div>
          ) : showModeSelector ? (
            // Mode selection UI
            <div className="space-y-4">
              {/* Mode Selection Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Solo Focus Mode */}
                <button
                  onClick={() => handleModeSelect('solo')}
                  className={`p-4 rounded-xl transition-all duration-200 ${
                    selectedMode === 'solo'
                      ? 'bg-white shadow-lg scale-[1.02]'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto ${
                    selectedMode === 'solo' ? 'bg-blue-100' : 'bg-white/20'
                  }`}>
                    <Target className={`w-5 h-5 ${selectedMode === 'solo' ? 'text-blue-600' : 'text-white'}`} />
                  </div>
                  <h3 className={`font-bold text-sm ${selectedMode === 'solo' ? 'text-gray-900' : 'text-white'}`}>
                    Solo Focus
                  </h3>
                  <p className={`text-xs mt-1 ${selectedMode === 'solo' ? 'text-gray-500' : 'text-white/70'}`}>
                    Self-directed study
                  </p>
                </button>

                {/* AI-Guided Mode */}
                <button
                  onClick={() => handleModeSelect('ai_guided')}
                  className={`p-4 rounded-xl transition-all duration-200 ${
                    selectedMode === 'ai_guided'
                      ? 'bg-white shadow-lg scale-[1.02]'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto ${
                    selectedMode === 'ai_guided' ? 'bg-purple-100' : 'bg-white/20'
                  }`}>
                    <Brain className={`w-5 h-5 ${selectedMode === 'ai_guided' ? 'text-purple-600' : 'text-white'}`} />
                  </div>
                  <h3 className={`font-bold text-sm ${selectedMode === 'ai_guided' ? 'text-gray-900' : 'text-white'}`}>
                    AI-Guided
                  </h3>
                  <p className={`text-xs mt-1 ${selectedMode === 'ai_guided' ? 'text-gray-500' : 'text-white/70'}`}>
                    Get tasks & feedback
                  </p>
                </button>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartFocus}
                disabled={isStarting}
                className="w-full py-4 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-xl font-bold text-lg text-blue-600 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    {selectedMode === 'ai_guided' ? (
                      <>
                        <Brain className="w-5 h-5 text-purple-500" />
                        <span>Set Up Task</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 text-blue-500" />
                        <span>Start Now</span>
                      </>
                    )}
                    <ChevronRight className="w-5 h-5 text-blue-400" />
                  </>
                )}
              </button>

              {/* Back button */}
              <button
                onClick={() => setShowModeSelector(false)}
                className="w-full py-2 text-white/70 hover:text-white text-sm transition-colors"
              >
                Back
              </button>
            </div>
          ) : (
            // No active session - show Start Challenge button
            <button
              onClick={handleStartFocus}
              disabled={isStarting}
              className="w-full py-5 sm:py-6 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl sm:text-2xl text-blue-600 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/20 flex items-center justify-center gap-3 group"
            >
              {isStarting ? (
                <>
                  <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>{t('starting')}</span>
                </>
              ) : (
                <>
                  <Zap className="w-7 h-7 text-blue-500 group-hover:animate-pulse" />
                  <span>{t('startChallenge')}</span>
                  <ChevronRight className="w-6 h-6 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}

          {/* Stats Row */}
          <div className="mt-5 flex items-center justify-center gap-6 text-white/70 text-sm">
            {stats && stats.userTodaySessions > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white">{stats.userTodaySessions}</span>
                <span>{stats.userTodaySessions === 1 ? 'session' : 'sessions'} today</span>
              </div>
            )}
            {stats && stats.userPercentile > 0 && (
              <div className="flex items-center gap-1.5">
                <span>Top</span>
                <span className="font-semibold text-white">{100 - stats.userPercentile}%</span>
                <span>of students</span>
              </div>
            )}
          </div>

          {/* Motivational micro-copy */}
          <p className="text-center text-white/60 text-sm mt-4">
            {t('microCopy')}
          </p>
        </div>
      </div>
    </div>
  )
}
