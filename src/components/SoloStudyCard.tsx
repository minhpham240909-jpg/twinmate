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

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
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
import { useSoloStudyStats } from '@/hooks/useUserStats'
import { useFocusStats } from '@/hooks/useFocusStats'
import { subscribeToSessionEnd } from '@/lib/session/events'

interface SoloStudyCardProps {
  className?: string
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
  const queryClient = useQueryClient()

  // Use React Query hooks for cached data (prevents constant re-fetching)
  const { stats, isLoading } = useSoloStudyStats()
  const { data: focusData, refetch: refetchFocusData } = useFocusStats()

  // Only show active session if it's a Solo Study session
  const activeSession: ActiveSession | null =
    focusData?.stats?.activeSession?.sessionType === 'solo_study'
      ? focusData.stats.activeSession
      : null

  // Listen for session end events to refresh data
  useEffect(() => {
    const unsubscribe = subscribeToSessionEnd(() => {
      // Refetch focus stats when any session ends
      refetchFocusData()
      // Also invalidate the query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['focusStats'] })
    })

    return unsubscribe
  }, [refetchFocusData, queryClient])

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
    <div className={`relative ${className}`}>
      {/* Main Card - Clean neutral/black design */}
      <div className="bg-neutral-900 dark:bg-neutral-800 rounded-2xl p-6 relative">
        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Solo Study</h2>
                <p className="text-white/60 text-sm">Virtual study room</p>
              </div>
            </div>

            {/* Level Badge */}
            {stats && (
              <div className="flex items-center gap-1.5 bg-white/10 text-white rounded-full px-3 py-1.5">
                <Star className="w-4 h-4" />
                <span className="text-sm font-bold">Lv {stats.level}</span>
              </div>
            )}
          </div>

          {/* Features Preview - Simplified */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            <span className="px-2.5 py-1 bg-white/10 text-white/70 text-xs rounded-full">
              Backgrounds
            </span>
            <span className="px-2.5 py-1 bg-white/10 text-white/70 text-xs rounded-full">
              Sounds
            </span>
            <span className="px-2.5 py-1 bg-white/10 text-white/70 text-xs rounded-full">
              Pomodoro
            </span>
            <span className="px-2.5 py-1 bg-white/10 text-white/70 text-xs rounded-full">
              AI Tutor
            </span>
          </div>

          {/* Stats Row */}
          {stats && !isLoading && (
            <div className="flex items-center gap-4 mb-5">
              {stats.streak > 0 && (
                <div className="flex items-center gap-1.5 text-white/70 text-sm">
                  <Flame className="w-4 h-4" />
                  <span>{stats.streak} day</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-white/70 text-sm">
                <Sparkles className="w-4 h-4" />
                <span>{stats.xp} XP</span>
              </div>
              {stats.todayMinutes > 0 && (
                <div className="flex items-center gap-1.5 text-white/70 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{stats.todayMinutes}m</span>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {activeSession ? (
            <div className="space-y-2">
              <button
                onClick={handleContinueSession}
                className="w-full py-4 bg-white hover:bg-neutral-100 rounded-xl font-bold text-lg text-neutral-900 transition-colors flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5 fill-neutral-900" />
                <span>Continue</span>
                <span className="text-neutral-500 font-mono">
                  {formatTimeRemaining(activeSession.timeRemaining)}
                </span>
              </button>

              <button
                onClick={handleStartStudy}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>New Session</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartStudy}
              className="w-full py-4 bg-white hover:bg-neutral-100 rounded-xl font-bold text-lg text-neutral-900 transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              <span>Enter Study Room</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Benefits */}
          <div className="mt-4 text-center text-white/50 text-sm">
            Pomodoro timer with backgrounds & sounds
          </div>
        </div>
      </div>
    </div>
  )
}
