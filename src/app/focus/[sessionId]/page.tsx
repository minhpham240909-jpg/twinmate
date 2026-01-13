'use client'

/**
 * Focus Timer Page
 *
 * A distraction-free timer experience with gamification.
 * Features: Timer, confetti on completion, percentile ranking.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Play, Pause, X, Check, Plus, Minus, Volume2, VolumeX, Flame, Trophy, Brain, Send, Loader2 } from 'lucide-react'

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
  // AI task fields
  mode: 'solo' | 'ai_guided'
  taskType: string | null
  taskSubject: string | null
  taskPrompt: string | null
  taskDifficulty: string | null
  userResponse: string | null
  aiFeedback: string | null
  taskCompleted: boolean
}

interface CompletionStats {
  userStreak: number
  userPercentile: number
  todaySessions: number
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

  // Completion stats for gamification
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true)

  // AI Task state
  const [userResponse, setUserResponse] = useState('')
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<{ feedback: string; score: string; encouragement: string } | null>(null)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const confettiRef = useRef<HTMLCanvasElement | null>(null)

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

  // Confetti animation
  const triggerConfetti = useCallback(() => {
    setShowConfetti(true)
    const canvas = confettiRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      color: string
      size: number
      rotation: number
      rotationSpeed: number
    }> = []

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']

    // Create particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      })
    }

    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let activeParticles = 0
      particles.forEach((p) => {
        if (p.y < canvas.height + 50) {
          activeParticles++
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.1 // gravity
          p.rotation += p.rotationSpeed

          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
          ctx.restore()
        }
      })

      if (activeParticles > 0) {
        animationId = requestAnimationFrame(animate)
      } else {
        setShowConfetti(false)
      }
    }

    animate()

    // Cleanup after 5 seconds
    setTimeout(() => {
      cancelAnimationFrame(animationId)
      setShowConfetti(false)
    }, 5000)
  }, [])

  // Fetch completion stats
  const fetchCompletionStats = useCallback(async () => {
    try {
      const response = await fetch('/api/focus/stats')
      if (response.ok) {
        const data = await response.json()
        setCompletionStats({
          userStreak: data.stats.userStreak,
          userPercentile: data.stats.userPercentile,
          todaySessions: data.stats.userTodaySessions,
        })
      }
    } catch (err) {
      console.error('Failed to fetch completion stats', err)
    }
  }, [])

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

      // Trigger celebration
      triggerConfetti()
      fetchCompletionStats()
    } catch (err) {
      console.error('Failed to complete session', err)
    }
  }, [session, sessionId, triggerConfetti, fetchCompletionStats])

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

  // Submit response for AI feedback (AI-guided mode)
  const handleSubmitResponse = async () => {
    if (!userResponse.trim() || !session || session.mode !== 'ai_guided') return

    setIsSubmittingResponse(true)

    try {
      const response = await fetch(`/api/focus/${sessionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userResponse: userResponse.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to get feedback')
      }

      const data = await response.json()
      setAiFeedback(data.feedback)

      // Complete the session after getting feedback
      await completeSession()
    } catch (err) {
      console.error('Failed to submit response', err)
    } finally {
      setIsSubmittingResponse(false)
    }
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
      {/* Header - Ensure buttons are clickable with proper z-index */}
      <header className="flex items-center justify-between p-6 relative z-50">
        <button
          onClick={handleAbandon}
          className="p-4 hover:bg-neutral-800 active:bg-neutral-700 rounded-xl transition-colors cursor-pointer touch-manipulation"
          title={t('abandonSession')}
          aria-label="Leave focus session"
          type="button"
        >
          <X className="w-7 h-7 text-neutral-400 hover:text-white pointer-events-none" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-4 hover:bg-neutral-800 active:bg-neutral-700 rounded-xl transition-colors cursor-pointer touch-manipulation"
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            type="button"
          >
            {soundEnabled ? (
              <Volume2 className="w-6 h-6 text-neutral-400 pointer-events-none" />
            ) : (
              <VolumeX className="w-6 h-6 text-neutral-400 pointer-events-none" />
            )}
          </button>
        </div>
      </header>

      {/* Confetti Canvas */}
      {showConfetti && (
        <canvas
          ref={confettiRef}
          className="fixed inset-0 pointer-events-none z-50"
          style={{ width: '100vw', height: '100vh' }}
        />
      )}

      {/* Main Timer Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 -mt-16">
        {isCompleted ? (
          // Enhanced Completion Screen with gamification
          <div className="text-center animate-in fade-in zoom-in duration-500 max-w-md">
            {/* Success Icon with glow */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse" />
              <div className="relative w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-500/30">
                <Check className="w-16 h-16 text-white" />
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-3">{t('sessionComplete') || 'Session Complete!'}</h1>
            <p className="text-xl text-neutral-400 mb-6">
              {t('greatJob', { minutes: session.durationMinutes }) || `You focused for ${session.durationMinutes} minutes!`}
            </p>

            {/* AI Feedback (for AI-guided sessions) */}
            {session.mode === 'ai_guided' && aiFeedback && (
              <div className="w-full max-w-md mb-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6 text-left">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">AI Feedback</span>
                  {aiFeedback.score && (
                    <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                      aiFeedback.score === 'excellent' ? 'bg-green-500/20 text-green-400' :
                      aiFeedback.score === 'good' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {aiFeedback.score === 'excellent' ? 'Excellent!' : aiFeedback.score === 'good' ? 'Good Job!' : 'Keep Practicing'}
                    </span>
                  )}
                </div>
                <p className="text-white text-base leading-relaxed mb-4">
                  {aiFeedback.feedback}
                </p>
                {aiFeedback.encouragement && (
                  <p className="text-purple-300 text-sm italic">
                    {aiFeedback.encouragement}
                  </p>
                )}
              </div>
            )}

            {/* Stats Cards */}
            {completionStats && (
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {/* Percentile Badge */}
                {completionStats.userPercentile > 0 && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full px-4 py-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-100 font-medium">
                      You beat {completionStats.userPercentile}% of students
                    </span>
                  </div>
                )}

                {/* Streak Badge */}
                {completionStats.userStreak > 0 && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-full px-4 py-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-100 font-medium">
                      {completionStats.userStreak} day streak!
                    </span>
                  </div>
                )}

                {/* Today's Sessions */}
                {completionStats.todaySessions > 1 && (
                  <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-full px-4 py-2">
                    <span className="text-neutral-300">
                      {completionStats.todaySessions} sessions today
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto px-8 py-4 bg-neutral-800 hover:bg-neutral-700 rounded-2xl font-semibold transition-colors"
              >
                {t('backToDashboard') || 'Back to Dashboard'}
              </button>
              <button
                onClick={async () => {
                  // Start another session
                  const response = await fetch('/api/focus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ durationMinutes: 5 }),
                  })
                  const data = await response.json()
                  router.push(`/focus/${data.session.id}`)
                }}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-2xl font-semibold transition-all transform hover:scale-105 shadow-lg shadow-orange-500/25"
              >
                {t('startAnother') || 'Keep Going! (+5 min)'}
              </button>
            </div>

            {/* Motivational message */}
            <p className="text-neutral-500 text-sm mt-6">
              Every session counts. You&apos;re building unstoppable momentum.
            </p>
          </div>
        ) : (
          // Active Timer
          <>
            {/* AI Task Display (AI-guided mode only) */}
            {session.mode === 'ai_guided' && session.taskPrompt && (
              <div className="w-full max-w-2xl mb-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">Your Task</span>
                  {session.taskSubject && (
                    <span className="text-xs text-neutral-500 ml-2">({session.taskSubject})</span>
                  )}
                </div>
                <p className="text-white text-base leading-relaxed">
                  {session.taskPrompt}
                </p>
              </div>
            )}

            {/* Progress Ring - Smaller for AI-guided mode */}
            <div className={`relative ${session.mode === 'ai_guided' ? 'w-48 h-48 mb-6' : 'w-80 h-80 mb-12'}`}>
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx={session.mode === 'ai_guided' ? '96' : '160'}
                  cy={session.mode === 'ai_guided' ? '96' : '160'}
                  r={session.mode === 'ai_guided' ? '84' : '140'}
                  stroke="currentColor"
                  strokeWidth={session.mode === 'ai_guided' ? '6' : '8'}
                  fill="none"
                  className="text-neutral-800"
                />
                {/* Progress circle */}
                <circle
                  cx={session.mode === 'ai_guided' ? '96' : '160'}
                  cy={session.mode === 'ai_guided' ? '96' : '160'}
                  r={session.mode === 'ai_guided' ? '84' : '140'}
                  stroke="url(#gradient)"
                  strokeWidth={session.mode === 'ai_guided' ? '6' : '8'}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * (session.mode === 'ai_guided' ? 84 : 140)}
                  strokeDashoffset={2 * Math.PI * (session.mode === 'ai_guided' ? 84 : 140) * (1 - progressPercent / 100)}
                  className="transition-all duration-1000 ease-linear"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={session.mode === 'ai_guided' ? '#a855f7' : '#3b82f6'} />
                    <stop offset="100%" stopColor={session.mode === 'ai_guided' ? '#ec4899' : '#60a5fa'} />
                  </linearGradient>
                </defs>
              </svg>

              {/* Time Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`font-mono font-bold tracking-tight ${session.mode === 'ai_guided' ? 'text-4xl' : 'text-7xl'}`}>
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-neutral-500 mt-1 text-sm">
                  {t('remaining')}
                </span>
              </div>
            </div>

            {/* Response Input for AI-guided mode */}
            {session.mode === 'ai_guided' && session.taskPrompt && (
              <div className="w-full max-w-2xl mb-6">
                <label className="text-sm text-neutral-400 mb-2 block">Your Response</label>
                <textarea
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full h-32 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-neutral-500">
                    {userResponse.length}/5000 characters
                  </span>
                  <button
                    onClick={handleSubmitResponse}
                    disabled={!userResponse.trim() || isSubmittingResponse}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-all flex items-center gap-2"
                  >
                    {isSubmittingResponse ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Getting Feedback...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit & Get Feedback
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

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
                className={`p-6 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                  session.mode === 'ai_guided'
                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                }`}
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
