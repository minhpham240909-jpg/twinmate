'use client'

/**
 * SoloStudyCard - Full-Featured Virtual Study Room Entry
 *
 * Features:
 * - Virtual backgrounds
 * - Ambient soundscapes
 * - Pomodoro timers
 * - Progress tracking
 * - Gamification
 * - AI tutor
 * - Whiteboard
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Star,
  Flame,
  ChevronRight,
  Clock,
  Sparkles,
  Play,
  RefreshCw,
} from 'lucide-react'

interface SoloStudyCardProps {
  className?: string
}

interface UserStats {
  streak: number
  level: number
  xp: number
  todayMinutes: number
}

interface ActiveSession {
  id: string
  durationMinutes: number
  startedAt: string
  timeRemaining: number
  sessionType: 'solo_study' | 'quick_focus'
}

export default function SoloStudyCard({ className = '' }: SoloStudyCardProps) {
  const router = useRouter()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/user/stats')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.stats) {
          setStats({
            streak: data.stats.streak?.current || 0,
            level: Math.floor((data.stats.points || 0) / 100) + 1,
            xp: data.stats.points || 0,
            todayMinutes: data.stats.studyTime?.today?.value || 0,
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch active session (check if Solo Study session is active)
  const fetchActiveSession = useCallback(async () => {
    try {
      const response = await fetch('/api/focus/stats')
      if (response.ok) {
        const data = await response.json()
        // Only show if it's a Solo Study session
        if (data.stats?.activeSession?.sessionType === 'solo_study') {
          setActiveSession(data.stats.activeSession)
        } else {
          setActiveSession(null)
        }
      }
    } catch (error) {
      console.error('Failed to fetch active session:', error)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchActiveSession()
    // Poll for active session updates
    const interval = setInterval(fetchActiveSession, 30000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchActiveSession])

  const handleStartStudy = () => {
    router.push('/solo-study')
  }

  const handleContinueSession = () => {
    router.push('/solo-study')
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
      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-600/20 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-400/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Solo Study
                </h2>
                <p className="text-white/70 text-sm">
                  Full virtual study room
                </p>
              </div>
            </div>

            {/* Level Badge */}
            {stats && (
              <div className="flex items-center gap-1.5 bg-purple-400/90 text-purple-900 rounded-full px-3 py-1.5">
                <Star className="w-4 h-4" />
                <span className="text-sm font-bold">Lv {stats.level}</span>
              </div>
            )}
          </div>

          {/* Features Preview */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-white/10 text-white/80 text-xs rounded-full">
              Virtual Backgrounds
            </span>
            <span className="px-3 py-1 bg-white/10 text-white/80 text-xs rounded-full">
              Sound Mixer
            </span>
            <span className="px-3 py-1 bg-white/10 text-white/80 text-xs rounded-full">
              Pomodoro Timer
            </span>
            <span className="px-3 py-1 bg-white/10 text-white/80 text-xs rounded-full">
              AI Tutor
            </span>
            <span className="px-3 py-1 bg-white/10 text-white/80 text-xs rounded-full">
              Whiteboard
            </span>
          </div>

          {/* Stats Row */}
          {stats && !isLoading && (
            <div className="flex items-center gap-4 mb-6">
              {stats.streak > 0 && (
                <div className="flex items-center gap-1.5 text-orange-300 text-sm">
                  <Flame className="w-4 h-4" />
                  <span>{stats.streak} day streak</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-amber-300 text-sm">
                <Sparkles className="w-4 h-4" />
                <span>{stats.xp} XP</span>
              </div>
              {stats.todayMinutes > 0 && (
                <div className="flex items-center gap-1.5 text-blue-300 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{stats.todayMinutes}m today</span>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {activeSession ? (
            // Has active Solo Study session
            <div className="space-y-3">
              <button
                onClick={handleContinueSession}
                className="w-full py-4 sm:py-5 bg-white hover:bg-purple-50 rounded-2xl font-bold text-lg sm:text-xl text-purple-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
              >
                <Play className="w-6 h-6 text-purple-600 fill-purple-600" />
                <span>Continue</span>
                <span className="text-purple-500 font-mono text-base">
                  {formatTimeRemaining(activeSession.timeRemaining)}
                </span>
              </button>

              <button
                onClick={handleStartStudy}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Start New Session</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartStudy}
              className="w-full py-4 sm:py-5 bg-white hover:bg-purple-50 rounded-2xl font-bold text-lg sm:text-xl text-purple-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
            >
              <BookOpen className="w-6 h-6 text-purple-600" />
              <span>Enter Study Room</span>
              <ChevronRight className="w-5 h-5 text-purple-600" />
            </button>
          )}

          {/* Benefits */}
          <div className="mt-4 text-center text-white/60 text-sm">
            Immersive study environment with Pomodoro technique
          </div>
        </div>
      </div>
    </div>
  )
}
