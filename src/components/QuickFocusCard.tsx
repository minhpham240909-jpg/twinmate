'use client'

/**
 * QuickFocusCard - Streamlined Focus Entry Point
 *
 * Features:
 * - Clean, professional design
 * - Single "Start" button - fast entry
 * - AI toggle for guided mode
 * - No time display on card
 * - Instant start with optional AI guidance
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Zap, ChevronRight, Play, RefreshCw, Brain, Loader2 } from 'lucide-react'

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

interface QuickFocusCardProps {
  className?: string
}

export default function QuickFocusCard({ className = '' }: QuickFocusCardProps) {
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [stats, setStats] = useState<FocusStats | null>(null)
  const [, setIsLoadingStats] = useState(true)
  const [aiEnabled, setAiEnabled] = useState(false)

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
    // Refresh stats every 30 seconds
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

  // Start new focus session
  const startNewSession = async () => {
    try {
      // Create session
      const response = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: 5,
          mode: aiEnabled ? 'ai_guided' : 'solo'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start focus session')
      }

      const data = await response.json()
      const sessionId = data.session.id

      // If AI mode, generate a task automatically
      if (aiEnabled) {
        try {
          // Generate a random task with random subject and type
          const subjects = ['General Knowledge', 'Critical Thinking', 'Problem Solving', 'Creative Writing', 'Logic']
          const taskTypes = ['question', 'problem', 'writing', 'random'] as const

          const randomSubject = subjects[Math.floor(Math.random() * subjects.length)]
          const randomTaskType = taskTypes[Math.floor(Math.random() * taskTypes.length)]

          const taskResponse = await fetch('/api/focus/generate-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: randomSubject,
              taskType: randomTaskType,
              difficulty: 'medium',
            }),
          })

          if (taskResponse.ok) {
            const taskData = await taskResponse.json()

            // Update session with task details
            await fetch(`/api/focus/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskType: taskData.task?.taskType || randomTaskType,
                taskSubject: taskData.task?.subject || randomSubject,
                taskPrompt: taskData.task?.prompt || 'Focus on your learning goals for this session.',
                taskDifficulty: 'medium',
              }),
            })
          }
        } catch (taskError) {
          console.error('Failed to generate AI task:', taskError)
          // Continue anyway - user can still use the session
        }
      }

      router.push(`/focus/${sessionId}`)
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
      {/* Main Card - Clean blue gradient */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-600/20 relative">
        {/* Subtle background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header with streak */}
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
                  5 minutes of pure focus
                </p>
              </div>
            </div>

            {/* Streak Badge */}
            {stats && stats.userStreak > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-400/90 text-amber-900 rounded-full px-3 py-1.5">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-bold">{stats.userStreak}</span>
              </div>
            )}
          </div>

          {/* AI Toggle */}
          <div className="mb-6">
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                aiEnabled
                  ? 'bg-purple-500/30 border-2 border-purple-400/50'
                  : 'bg-white/10 border-2 border-transparent hover:bg-white/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  aiEnabled ? 'bg-purple-500/50' : 'bg-white/10'
                }`}>
                  <Brain className={`w-5 h-5 ${aiEnabled ? 'text-purple-200' : 'text-white/70'}`} />
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${aiEnabled ? 'text-purple-200' : 'text-white'}`}>
                    AI Tutor
                  </p>
                  <p className={`text-xs ${aiEnabled ? 'text-purple-300/70' : 'text-white/50'}`}>
                    Get a task & feedback
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
                aiEnabled ? 'bg-purple-500' : 'bg-white/20'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  aiEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </button>
          </div>

          {/* Action Buttons */}
          {stats?.activeSession ? (
            // User has an active session
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
            // No active session - show Start button
            <button
              onClick={handleStartFocus}
              disabled={isStarting}
              className="w-full py-5 sm:py-6 bg-white hover:bg-blue-50 disabled:bg-white/80 rounded-2xl font-bold text-xl sm:text-2xl text-blue-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <span>{aiEnabled ? 'Preparing...' : 'Starting...'}</span>
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

          {/* Stats Row - Minimal */}
          {stats && (stats.userTodaySessions > 0 || stats.liveUsersCount > 0) && (
            <div className="mt-5 flex items-center justify-center gap-4 text-white/60 text-sm">
              {stats.userTodaySessions > 0 && (
                <span>
                  <span className="font-semibold text-white/90">{stats.userTodaySessions}</span>
                  {' '}today
                </span>
              )}
              {stats.liveUsersCount > 0 && (
                <span>
                  <span className="font-semibold text-white/90">{stats.liveUsersCount}</span>
                  {' '}focusing now
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
