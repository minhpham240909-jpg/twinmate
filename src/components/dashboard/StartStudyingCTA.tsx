'use client'

/**
 * StartStudyingCTA - The Primary Dashboard Action
 *
 * Vision: ONE button that removes all decision-making
 *
 * Logic:
 * 1. If has active session → "Continue" with subject + time remaining
 * 2. If has last session (today) → "Continue [Subject]"
 * 3. If has enrolled courses → "Start Studying [Most Recent Course]"
 * 4. Default → "Start Studying" with quick options
 *
 * This is the ONLY prominent CTA on the dashboard.
 * Everything else is secondary.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Play,
  Loader2,
  Sparkles,
  Clock,
  ChevronRight,
  Zap,
  X,
} from 'lucide-react'
import { handleSessionEnd } from '@/lib/session/events'

interface LastSession {
  id: string
  subject?: string
  durationMinutes: number
  completedAt?: string
  type: 'quick_focus' | 'solo_study' | 'group'
}

interface ActiveSession {
  id: string
  subject?: string
  timeRemaining: number
  type: 'quick_focus' | 'solo_study'
}

interface StartStudyingCTAProps {
  userName: string
  activeSession?: ActiveSession | null
  lastSession?: LastSession | null
  className?: string
  onEndSession?: () => void // Callback when user ends session from dashboard
}

export default function StartStudyingCTA({
  userName,
  activeSession,
  lastSession,
  className = '',
  onEndSession,
}: StartStudyingCTAProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isStarting, setIsStarting] = useState(false)
  const [showQuickOptions, setShowQuickOptions] = useState(false)
  const [isEndingSession, setIsEndingSession] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get first name for greeting
  const firstName = userName?.split(' ')[0] || 'there'

  // Determine what to show
  const hasActiveSession = !!activeSession
  const hasLastSession = !!lastSession

  // Get the subject to display
  const getDisplaySubject = (): string => {
    if (activeSession?.subject) return activeSession.subject
    if (lastSession?.subject) return lastSession.subject
    return ''
  }

  const displaySubject = getDisplaySubject()

  // Handle continue active session
  const handleContinue = () => {
    if (!activeSession) return

    if (activeSession.type === 'quick_focus') {
      // Quick Focus sessions are timed sessions - redirect to the session page with ID
      router.push(`/focus/${activeSession.id}`)
    } else {
      // Solo Study sessions use the solo-study page
      router.push('/solo-study')
    }
  }

  // Handle start new session based on last session
  const handleStartFromLast = async () => {
    if (isStarting) return
    setIsStarting(true)

    try {
      // If last session was a Quick Focus, start a new Quick Focus session
      if (lastSession?.type === 'quick_focus') {
        // Start a new Quick Focus session with similar duration
        const duration = lastSession.durationMinutes <= 10 ? lastSession.durationMinutes : 10
        const response = await fetch('/api/focus/start-smart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMinutes: duration }),
        })

        if (response.ok) {
          const data = await response.json()
          router.push(`/focus/${data.session.id}`)
          return
        }
        // Fallback to solo study if Quick Focus fails
      }

      // Default: go to solo study
      router.push('/solo-study')
    } catch (error) {
      console.error('Error starting session:', error)
      router.push('/solo-study')
    } finally {
      setIsStarting(false)
    }
  }

  // Handle quick start (no context)
  const handleQuickStart = async (duration: number) => {
    if (isStarting) return
    setIsStarting(true)
    setShowQuickOptions(false)

    try {
      const response = await fetch('/api/focus/start-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: duration }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/focus/${data.session.id}`)
      } else {
        // Fallback
        router.push('/solo-study')
      }
    } catch (error) {
      console.error('Error starting session:', error)
      router.push('/solo-study')
    } finally {
      setIsStarting(false)
    }
  }

  // Handle ending session from dashboard
  const handleEndSession = async () => {
    if (!activeSession || isEndingSession) return

    setIsEndingSession(true)
    setShowEndConfirm(false)

    try {
      if (activeSession.type === 'quick_focus') {
        // Quick Focus sessions - end via focus API
        await fetch(`/api/focus/${activeSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ABANDONED', actualMinutes: 0 }),
        })

        // Clear all session caches and notify other components
        await handleSessionEnd(queryClient, {
          sessionId: activeSession.id,
          sessionType: 'quick_focus',
          reason: 'ended_early',
        })
        onEndSession?.()
        return
      }

      // Solo study uses POST /api/solo-study/end
      const response = await fetch('/api/solo-study/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          totalMinutes: 0, // Ended early
          completedPomodoros: 0,
        }),
      })

      if (response.ok) {
        // Clear all session caches and notify other components
        await handleSessionEnd(queryClient, {
          sessionId: activeSession.id,
          sessionType: 'solo_study',
          reason: 'ended_early',
        })
        onEndSession?.()
      }
    } catch (error) {
      console.error('Error ending session:', error)
    } finally {
      setIsEndingSession(false)
    }
  }

  // Main CTA click handler
  const handleMainCTAClick = () => {
    if (hasActiveSession) {
      handleContinue()
    } else if (hasLastSession) {
      handleStartFromLast()
    } else {
      setShowQuickOptions(true)
    }
  }

  return (
    <div className={`${className}`}>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white mb-1">
          {hasActiveSession ? (
            <>Welcome back, {firstName}</>
          ) : (
            <>Ready to study, {firstName}?</>
          )}
        </h1>
        {hasActiveSession && (
          <p className="text-neutral-500 dark:text-neutral-400">
            You have an active session
          </p>
        )}
      </div>

      {/* Primary CTA Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 shadow-lg shadow-blue-500/20">
        {/* Main Button */}
        <button
          onClick={handleMainCTAClick}
          disabled={isStarting}
          className="w-full py-5 sm:py-6 bg-white hover:bg-neutral-50 disabled:bg-white/90 rounded-xl font-bold text-lg sm:text-xl text-neutral-900 transition-all flex items-center justify-center gap-3 shadow-lg"
        >
          {isStarting ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Starting...</span>
            </>
          ) : hasActiveSession ? (
            <>
              <Play className="w-6 h-6 fill-neutral-900" />
              <span>Continue Studying</span>
              <span className="text-blue-600 font-mono ml-2">
                {formatTimeRemaining(activeSession!.timeRemaining)}
              </span>
            </>
          ) : (
            <>
              <Play className="w-6 h-6 fill-neutral-900" />
              <span>
                {displaySubject ? `Continue: ${displaySubject}` : 'Start Studying'}
              </span>
              <ChevronRight className="w-5 h-5 ml-1" />
            </>
          )}
        </button>

        {/* Context hint */}
        <div className="mt-4 flex items-center justify-center gap-2 text-white/70 text-sm">
          <Sparkles className="w-4 h-4" />
          <span>
            {hasActiveSession ? (
              `${displaySubject || 'Session'} in progress`
            ) : hasLastSession ? (
              'Based on your last session'
            ) : (
              'AI will guide your session'
            )}
          </span>
        </div>

        {/* Quick Options (shown when no context) */}
        {showQuickOptions && !hasActiveSession && !hasLastSession && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-white/80 text-sm mb-3 text-center">How long do you have?</p>
            <div className="grid grid-cols-3 gap-3">
              {[5, 10, 25].map((duration) => (
                <button
                  key={duration}
                  onClick={() => handleQuickStart(duration)}
                  disabled={isStarting}
                  className="py-3 bg-white/20 hover:bg-white/30 disabled:bg-white/10 rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>{duration} min</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Alternative actions for active session */}
        {hasActiveSession && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => router.push('/solo-study')}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/90 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Start New</span>
            </button>

            {/* End Session Button */}
            {!showEndConfirm ? (
              <button
                onClick={() => setShowEndConfirm(true)}
                disabled={isEndingSession}
                className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 disabled:bg-red-500/10 rounded-xl font-medium text-red-300 transition-colors flex items-center justify-center gap-2"
                title="End this session"
              >
                <X className="w-4 h-4" />
                <span>End</span>
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={handleEndSession}
                  disabled={isEndingSession}
                  className="px-3 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-1"
                >
                  {isEndingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>Yes</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowEndConfirm(false)}
                  disabled={isEndingSession}
                  className="px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl font-medium text-white/70 transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
