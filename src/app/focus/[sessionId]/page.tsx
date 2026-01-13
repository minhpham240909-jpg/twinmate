'use client'

/**
 * Focus Timer Page
 *
 * A distraction-free timer experience.
 * Minimal UI, calming design, focused on one thing: the timer.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Play, Pause, X, Check, Plus, Minus, Volume2, VolumeX } from 'lucide-react'

interface FocusSession {
  id: string
  userId: string
  durationMinutes: number
  startedAt: string
  completedAt: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED'
  actualMinutes: number | null
  label: string | null
  notes: string | null
}

export default function FocusTimerPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const t = useTranslations('quickFocus')

  // Session state
  const [session, setSession] = useState<FocusSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0) // in seconds
  const [isRunning, setIsRunning] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Play completion sound - defined before the useEffect that uses it
  const playCompletionSound = useCallback(() => {
    if (!soundEnabled) return

    try {
      // Use Web Audio API for a simple chime
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 523.25 // C5
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)

      // Second note
      setTimeout(() => {
        const osc2 = audioContext.createOscillator()
        const gain2 = audioContext.createGain()
        osc2.connect(gain2)
        gain2.connect(audioContext.destination)
        osc2.frequency.value = 659.25 // E5
        osc2.type = 'sine'
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8)
        osc2.start(audioContext.currentTime)
        osc2.stop(audioContext.currentTime + 0.8)
      }, 200)
    } catch {
      console.log('Audio not available')
    }
  }, [soundEnabled])

  // Complete session API call - defined before the useEffect that uses it
  const completeSession = useCallback(async () => {
    if (!session) return

    try {
      const actualMinutes = Math.round(
        (Date.now() - new Date(session.startedAt).getTime()) / 60000
      )

      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          actualMinutes: Math.min(actualMinutes, session.durationMinutes),
        }),
      })
    } catch (err) {
      console.error('Failed to complete session', err)
    }
  }, [session, sessionId])

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(`/api/focus/${sessionId}`)
        if (!response.ok) {
          throw new Error('Session not found')
        }
        const data = await response.json()
        setSession(data.session)

        // Calculate remaining time
        const startTime = new Date(data.session.startedAt).getTime()
        const durationMs = data.session.durationMinutes * 60 * 1000
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))

        setTimeRemaining(remaining)
        startTimeRef.current = startTime

        // Check if already completed
        if (data.session.status !== 'ACTIVE' || remaining === 0) {
          setIsCompleted(true)
          setIsRunning(false)
        }
      } catch (err) {
        setError('Failed to load session')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId])

  // Timer logic
  useEffect(() => {
    if (!isRunning || isCompleted || timeRemaining <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer completed!
          setIsCompleted(true)
          setIsRunning(false)
          playCompletionSound()
          completeSession()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRunning, isCompleted, playCompletionSound, completeSession])

  // Abandon session
  const handleAbandon = async () => {
    if (!session) return

    try {
      const actualMinutes = Math.round(
        (Date.now() - new Date(session.startedAt).getTime()) / 60000
      )

      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ABANDONED',
          actualMinutes,
        }),
      })

      router.push('/dashboard')
    } catch (err) {
      console.error('Failed to abandon session', err)
      router.push('/dashboard')
    }
  }

  // Add more time
  const handleAddTime = (minutes: number) => {
    setTimeRemaining((prev) => prev + minutes * 60)
  }

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progressPercent = session
    ? ((session.durationMinutes * 60 - timeRemaining) / (session.durationMinutes * 60)) * 100
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-8">
        <h1 className="text-2xl font-bold mb-4">{t('sessionNotFound')}</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
        >
          {t('backToDashboard')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <button
          onClick={handleAbandon}
          className="p-3 hover:bg-neutral-800 rounded-xl transition-colors"
          title={t('abandonSession')}
        >
          <X className="w-6 h-6 text-neutral-400 hover:text-white" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 hover:bg-neutral-800 rounded-xl transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-neutral-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-neutral-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Timer Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 -mt-16">
        {isCompleted ? (
          // Completion Screen
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-500/30">
              <Check className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">{t('sessionComplete')}</h1>
            <p className="text-xl text-neutral-400 mb-8">
              {t('greatJob', { minutes: session.durationMinutes })}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-4 bg-neutral-800 hover:bg-neutral-700 rounded-2xl font-semibold transition-colors"
              >
                {t('backToDashboard')}
              </button>
              <button
                onClick={async () => {
                  // Start another session
                  const response = await fetch('/api/focus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ durationMinutes: 7 }),
                  })
                  const data = await response.json()
                  router.push(`/focus/${data.session.id}`)
                }}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-semibold transition-colors"
              >
                {t('startAnother')}
              </button>
            </div>
          </div>
        ) : (
          // Active Timer
          <>
            {/* Progress Ring */}
            <div className="relative w-80 h-80 mb-12">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-neutral-800"
                />
                {/* Progress circle */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 140}
                  strokeDashoffset={2 * Math.PI * 140 * (1 - progressPercent / 100)}
                  className="transition-all duration-1000 ease-linear"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Time Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-7xl font-mono font-bold tracking-tight">
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-neutral-500 mt-2 text-lg">
                  {t('remaining')}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              {/* Subtract time */}
              <button
                onClick={() => handleAddTime(-1)}
                disabled={timeRemaining <= 60}
                className="p-4 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl transition-colors"
              >
                <Minus className="w-6 h-6" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="p-6 bg-blue-600 hover:bg-blue-700 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
              >
                {isRunning ? (
                  <Pause className="w-10 h-10" />
                ) : (
                  <Play className="w-10 h-10 ml-1" />
                )}
              </button>

              {/* Add time */}
              <button
                onClick={() => handleAddTime(1)}
                className="p-4 bg-neutral-800 hover:bg-neutral-700 rounded-2xl transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            {/* Session label */}
            {session.label && (
              <div className="mt-8 px-4 py-2 bg-neutral-800 rounded-full text-neutral-400 text-sm">
                {session.label}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer - Motivational message */}
      {!isCompleted && (
        <footer className="p-8 text-center">
          <p className="text-neutral-600 text-sm">
            {t('motivationalMessage')}
          </p>
        </footer>
      )}
    </div>
  )
}
