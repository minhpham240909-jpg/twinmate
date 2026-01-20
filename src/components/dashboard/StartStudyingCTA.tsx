'use client'

/**
 * StartStudyingCTA - The Primary Dashboard Action
 *
 * Vision: ONE button that removes all decision-making
 *
 * Logic:
 * 1. If has active session → "Continue" with subject + time remaining
 * 2. Default → "Start Studying" → Goes to Solo Study Room
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
  ChevronRight,
  Zap,
  X,
} from 'lucide-react'
import { handleSessionEnd } from '@/lib/session/events'

interface ActiveSession {
  id: string
  subject?: string
  timeRemaining: number
  type: 'quick_focus' | 'solo_study'
}

interface StartStudyingCTAProps {
  userName: string
  activeSession?: ActiveSession | null
  className?: string
  onEndSession?: () => void // Callback when user ends session from dashboard
}

export default function StartStudyingCTA({
  userName,
  activeSession,
  className = '',
  onEndSession,
}: StartStudyingCTAProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
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

  // Get the subject to display
  const displaySubject = activeSession?.subject || ''

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

  // Main CTA click handler - always go to Solo Study Room
  const handleMainCTAClick = () => {
    if (hasActiveSession) {
      handleContinue()
    } else {
      // Go directly to Solo Study Room - user can set timer there
      router.push('/solo-study')
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
          className="w-full py-5 sm:py-6 bg-white hover:bg-neutral-50 rounded-xl font-bold text-lg sm:text-xl text-neutral-900 transition-all flex items-center justify-center gap-3 shadow-lg"
        >
          {hasActiveSession ? (
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
              <span>Start Studying</span>
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
            ) : (
              'Choose your study environment'
            )}
          </span>
        </div>

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
