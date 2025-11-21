'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useBackgroundSession } from '@/lib/session/BackgroundSessionContext'
import { useTimerSync } from '@/hooks/useTimerSync'
import { useEffect, useState } from 'react'

export default function FloatingSessionButton() {
  const router = useRouter()
  const pathname = usePathname()
  const { activeSessionId } = useBackgroundSession()

  // Always call hooks unconditionally (before early returns)
  const { timer } = useTimerSync(activeSessionId || '')
  const [displayTime, setDisplayTime] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Fix hydration: only render after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate display time based on timer state
  useEffect(() => {
    if (!timer) {
      setDisplayTime(0)
      return
    }

    // If timer is running, calculate elapsed time
    if (timer.state === 'RUNNING' && timer.lastStartedAt) {
      const updateDisplayTime = () => {
        const startTime = new Date(timer.lastStartedAt!).getTime()
        const now = Date.now()
        const elapsedSeconds = Math.floor((now - startTime) / 1000)
        const newTimeRemaining = Math.max(0, timer.timeRemaining - elapsedSeconds)
        setDisplayTime(newTimeRemaining)
      }

      updateDisplayTime()
      const interval = setInterval(updateDisplayTime, 1000)
      return () => clearInterval(interval)
    } else if (timer.state === 'PAUSED' || timer.state === 'BREAK_PAUSED') {
      // Show paused time
      setDisplayTime(timer.timeRemaining)
    } else if (timer.state === 'BREAK') {
      // Calculate break time remaining
      if (timer.lastStartedAt) {
        const updateDisplayTime = () => {
          const startTime = new Date(timer.lastStartedAt!).getTime()
          const now = Date.now()
          const elapsedSeconds = Math.floor((now - startTime) / 1000)
          const newTimeRemaining = Math.max(0, timer.timeRemaining - elapsedSeconds)
          setDisplayTime(newTimeRemaining)
        }

        updateDisplayTime()
        const interval = setInterval(updateDisplayTime, 1000)
        return () => clearInterval(interval)
      } else {
        setDisplayTime(timer.timeRemaining)
      }
    } else {
      setDisplayTime(timer.timeRemaining)
    }
  }, [timer])

  // Don't show button if:
  // 1. No active session
  // 2. Already on the session page
  // 3. Not mounted yet (hydration fix)
  if (!mounted || !activeSessionId || pathname?.startsWith(`/study-sessions/${activeSessionId}`)) {
    return null
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTimerStateLabel = () => {
    if (!timer) return ''
    switch (timer.state) {
      case 'RUNNING':
        return '⏱️'
      case 'PAUSED':
        return '⏸️'
      case 'BREAK':
        return '☕'
      case 'BREAK_PAUSED':
        return '⏸️'
      default:
        return '⏱️'
    }
  }

  const handleReturnToSession = () => {
    if (activeSessionId) {
      router.push(`/study-sessions/${activeSessionId}`)
    }
  }

  return (
    <button
      onClick={handleReturnToSession}
      className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 font-semibold animate-pulse"
    >
      <div className="px-6 py-3 flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <div className="flex flex-col items-start">
          <span className="text-sm">Return to Study Session</span>
          {timer && (
            <span className="text-xs opacity-90 flex items-center gap-1">
              {getTimerStateLabel()} {formatTime(displayTime)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
