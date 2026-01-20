'use client'

/**
 * Quick Focus Timer Page - Simplified Focus Session
 *
 * Features:
 * - Big centered countdown timer (the anchor)
 * - Task reminder (ONE line only) - AI assignment
 * - Presence indicator (silent social pressure)
 * - Ambient soundscapes (optional)
 * - Light distraction blocking
 * - Motivational quotes
 * - Exit friction (modal when trying to leave early)
 * - Reward moment at completion
 *
 * Max duration: 5-10 minutes
 * Work is done OUTSIDE the app (paper, textbook, other apps)
 * This room is for accountability only.
 *
 * NOTE: Virtual backgrounds and AI tutor moved to Solo Study (/solo-study)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { X, Check, Flame, Trophy, Users, RotateCcw, Map, Pause, Play } from 'lucide-react'
import { subscribeToFocusSessionParticipants } from '@/lib/supabase/realtime'
import {
  MotivationalQuote,
  DistractionBlocker,
  StudyRoadmapPanel,
} from '@/components/focus'
import SoloStudySoundMixer from '@/components/solo-study/SoloStudySoundMixer'
import { handleSessionEnd } from '@/lib/session/events'

// Study plan types for "I'm Stuck" roadmap
interface StudyPlanStep {
  id: string
  order: number
  duration: number
  title: string
  description: string
  tips?: string[]
}

interface StudyPlan {
  id: string
  subject: string
  totalMinutes: number
  encouragement: string
  steps: StudyPlanStep[]
}

interface FocusSession {
  id: string
  userId: string
  durationMinutes: number
  startedAt: string
  completedAt: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED'
  actualMinutes: number | null
  label: string | null
  mode: 'solo' | 'ai_guided'
  taskSubject: string | null
  taskPrompt: string | null
  taskDifficulty: string | null
}

interface CompletionStats {
  userStreak: number
  userPercentile: number
  todaySessions: number
  liveUsersCount: number
}

interface Participant {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  joinedAt: string | null
}

export default function FocusTimerPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const params = useParams()
  const sessionId = params.sessionId as string

  // Session state
  const [session, setSession] = useState<FocusSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showOneMinuteWarning, setShowOneMinuteWarning] = useState(false)
  const [hasShownWarning, setHasShownWarning] = useState(false)

  // Exit friction modal
  const [showExitModal, setShowExitModal] = useState(false)

  // Stats
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null)
  const [globalStudyingCount, setGlobalStudyingCount] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([])

  // Study Roadmap (from "I'm Stuck" flow)
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null)
  const [showRoadmap, setShowRoadmap] = useState(false)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const confettiRef = useRef<HTMLCanvasElement | null>(null)
  const presenceUpdatedRef = useRef(false)

  // Update presence activity with optional subject/course information
  const updatePresenceActivity = useCallback(async (
    activityType: 'studying' | 'browsing',
    subject?: string | null
  ) => {
    try {
      const activityDetails = activityType === 'studying' && subject
        ? { subject, startedAt: new Date().toISOString() }
        : undefined

      await fetch('/api/presence/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType, activityDetails }),
      })
    } catch (error) {
      console.error('Failed to update presence activity:', error)
    }
  }, [])

  // Play sound
  const playSound = useCallback((type: 'warning' | 'complete') => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      if (type === 'warning') {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()
        osc.connect(gain)
        gain.connect(audioContext.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.2, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        osc.start(audioContext.currentTime)
        osc.stop(audioContext.currentTime + 0.3)
      } else {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()
        osc.connect(gain)
        gain.connect(audioContext.destination)
        osc.frequency.value = 523.25
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        osc.start(audioContext.currentTime)
        osc.stop(audioContext.currentTime + 0.5)

        setTimeout(() => {
          const osc2 = audioContext.createOscillator()
          const gain2 = audioContext.createGain()
          osc2.connect(gain2)
          gain2.connect(audioContext.destination)
          osc2.frequency.value = 659.25
          osc2.type = 'sine'
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime)
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8)
          osc2.start(audioContext.currentTime)
          osc2.stop(audioContext.currentTime + 0.8)
        }, 200)
      }
    } catch {
      // Audio not available
    }
  }, [])

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
      x: number; y: number; vx: number; vy: number
      color: string; size: number; rotation: number; rotationSpeed: number
    }> = []

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']

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
          p.vy += 0.1
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

    setTimeout(() => {
      cancelAnimationFrame(animationId)
      setShowConfetti(false)
    }, 5000)
  }, [])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/focus/stats')
      if (response.ok) {
        const data = await response.json()
        setCompletionStats({
          userStreak: data.stats.userStreak,
          userPercentile: data.stats.userPercentile,
          todaySessions: data.stats.userTodaySessions,
          liveUsersCount: data.stats.liveUsersCount || 0,
        })
      }
    } catch (err) {
      console.error('Failed to fetch stats', err)
    }
  }, [])

  // Fetch global studying count (all modes: solo, partner, AI)
  const fetchGlobalStudyingCount = useCallback(async () => {
    try {
      const response = await fetch('/api/presence/studying-count')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setGlobalStudyingCount(data.count || 0)
        }
      }
    } catch (err) {
      console.error('Failed to fetch global studying count', err)
    }
  }, [])

  // Fetch participants
  const fetchParticipants = useCallback(async () => {
    try {
      const response = await fetch(`/api/focus/${sessionId}/invite`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data.participants.joined || [])
      }
    } catch (err) {
      console.error('Failed to fetch participants', err)
    }
  }, [sessionId])

  // Complete session
  const completeSession = useCallback(async () => {
    if (!session) return

    try {
      const elapsed = Date.now() - new Date(session.startedAt).getTime()
      const actualMinutes = Math.round(elapsed / 60000)

      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          actualMinutes: Math.min(Math.max(0, actualMinutes), session.durationMinutes),
        }),
      })

      // Determine session type based on label - Solo Study sessions have "Solo Study" prefix
      const isSoloStudy = session.label?.startsWith('Solo Study') ?? false

      // Clear all session caches and notify other components (e.g., dashboard)
      await handleSessionEnd(queryClient, {
        sessionId,
        sessionType: isSoloStudy ? 'solo_study' : 'quick_focus',
        reason: 'completed',
      })

      playSound('complete')
      triggerConfetti()
      fetchStats()
    } catch (err) {
      console.error('Failed to complete session', err)
    }
  }, [session, sessionId, queryClient, playSound, triggerConfetti, fetchStats])

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(`/api/focus/${sessionId}`)
        if (!response.ok) throw new Error('Session not found')

        const data = await response.json()
        const sessionData = data.session

        setSession(sessionData)

        // Calculate remaining time
        const startTime = new Date(sessionData.startedAt).getTime()
        const durationMs = sessionData.durationMinutes * 60 * 1000
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))

        setTimeRemaining(remaining)

        if (sessionData.status !== 'ACTIVE' || remaining === 0) {
          setIsCompleted(true)
          setIsRunning(false)
        }

        // Load study plan from sessionStorage (from "I'm Stuck" flow)
        try {
          const savedPlan = sessionStorage.getItem('imstuck_study_plan')
          if (savedPlan && sessionData.mode === 'ai_guided') {
            const plan = JSON.parse(savedPlan) as StudyPlan
            setStudyPlan(plan)
            setShowRoadmap(true)
            // Clear after loading to avoid stale data on refresh
            // Keep in sessionStorage for page refreshes during same session
          }
        } catch {
          // Ignore parse errors
        }

        fetchStats()
      } catch (err) {
        setError('Failed to load session')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
    fetchGlobalStudyingCount()

    const statsInterval = setInterval(fetchStats, 30000)
    const countInterval = setInterval(fetchGlobalStudyingCount, 15000)
    return () => {
      clearInterval(statsInterval)
      clearInterval(countInterval)
    }
  }, [sessionId, fetchStats, fetchGlobalStudyingCount])

  // Update presence when entering/leaving focus room
  useEffect(() => {
    // Set activity to 'studying' when entering the room (with subject if available)
    if (!presenceUpdatedRef.current && !isCompleted) {
      presenceUpdatedRef.current = true
      updatePresenceActivity('studying', session?.taskSubject)
    }

    // Reset to 'browsing' when leaving the room
    return () => {
      if (presenceUpdatedRef.current) {
        updatePresenceActivity('browsing')
      }
    }
  }, [updatePresenceActivity, isCompleted, session?.taskSubject])

  // Reset presence when session is completed or abandoned
  useEffect(() => {
    if (isCompleted && presenceUpdatedRef.current) {
      updatePresenceActivity('browsing')
    }
  }, [isCompleted, updatePresenceActivity])

  // Load participants and subscribe to real-time updates
  useEffect(() => {
    fetchParticipants()

    const unsubscribe = subscribeToFocusSessionParticipants(
      sessionId,
      fetchParticipants
    )

    return () => {
      unsubscribe()
    }
  }, [sessionId, fetchParticipants])

  // Timer logic
  useEffect(() => {
    if (!isRunning || isCompleted || timeRemaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        // 1-minute warning
        if (prev === 61 && !hasShownWarning) {
          setShowOneMinuteWarning(true)
          setHasShownWarning(true)
          playSound('warning')
          setTimeout(() => setShowOneMinuteWarning(false), 3000)
        }

        if (prev <= 1) {
          setIsCompleted(true)
          setIsRunning(false)
          completeSession()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, isCompleted, hasShownWarning, playSound, completeSession])

  // Handle exit attempt - show friction modal
  const handleExitAttempt = () => {
    if (timeRemaining > 0 && timeRemaining <= 120) {
      // Less than 2 minutes left - show modal
      setShowExitModal(true)
    } else {
      handleAbandon()
    }
  }

  // Abandon session
  const handleAbandon = async () => {
    if (!session) return

    try {
      const elapsed = Date.now() - new Date(session.startedAt).getTime()
      const actualMinutes = Math.max(0, Math.round(elapsed / 60000))

      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ABANDONED', actualMinutes }),
      })

      // Determine session type based on label - Solo Study sessions have "Solo Study" prefix
      const isSoloStudy = session.label?.startsWith('Solo Study') ?? false

      // Clear all session caches and notify other components (e.g., dashboard)
      await handleSessionEnd(queryClient, {
        sessionId,
        sessionType: isSoloStudy ? 'solo_study' : 'quick_focus',
        reason: 'ended_early',
      })

      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    }
  }

  // Start another round - go back to dashboard to enter new task
  const handleAnotherRound = () => {
    router.push('/dashboard')
  }

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Progress percentage
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
        <h1 className="text-2xl font-bold mb-4">Session not found</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Confetti */}
      {showConfetti && (
        <canvas
          ref={confettiRef}
          className="fixed inset-0 pointer-events-none z-50"
          style={{ width: '100vw', height: '100vh' }}
        />
      )}


      {/* 1-Minute Warning */}
      {showOneMinuteWarning && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in duration-200">
          <div className="bg-amber-500/90 text-amber-950 px-8 py-4 rounded-2xl font-bold text-xl shadow-2xl">
            1 minute left
          </div>
        </div>
      )}

      {/* Exit Friction Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="text-4xl mb-4">
              {formatTime(timeRemaining)}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Almost there!
            </h3>
            <p className="text-neutral-400 mb-6">
              {timeRemaining <= 60 ? 'Less than a minute left.' : `${Math.ceil(timeRemaining / 60)} minutes left.`} Want to finish?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl font-semibold transition-all"
              >
                Finish this session
              </button>
              <button
                onClick={handleAbandon}
                className="w-full py-3 text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - with tools */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <button
              onClick={handleExitAttempt}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              aria-label="Leave session"
            >
              <X className="w-5 h-5 text-neutral-400 hover:text-neutral-200" />
            </button>
          )}
        </div>

        {/* Focus Tools - Simplified for Quick Focus */}
        {!isCompleted && (
          <div className="flex items-center gap-2">
            {/* Roadmap toggle button - only show if we have a study plan */}
            {studyPlan && (
              <button
                onClick={() => setShowRoadmap(!showRoadmap)}
                className={`p-2 rounded-xl transition-colors ${
                  showRoadmap
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'hover:bg-white/10 text-neutral-400 hover:text-neutral-200'
                }`}
                aria-label={showRoadmap ? 'Hide study plan' : 'Show study plan'}
                title={showRoadmap ? 'Hide study plan' : 'Show study plan'}
              >
                <Map className="w-5 h-5" />
              </button>
            )}
            <SoloStudySoundMixer isPlaying={isRunning && !isCompleted} />
            <DistractionBlocker isSessionActive={isRunning && !isCompleted} />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {isCompleted ? (
          // COMPLETION SCREEN
          <div className="text-center animate-in fade-in zoom-in duration-500 max-w-md w-full">
            {/* Success Icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl opacity-30 animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                <Check className="w-12 h-12 text-white" />
              </div>
            </div>

            {/* Message */}
            <h1 className="text-3xl font-bold mb-2">Session complete</h1>
            <p className="text-neutral-400 text-lg mb-8">
              You showed up. That counts.
            </p>

            {/* Stats */}
            {completionStats && (
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {completionStats.userStreak > 0 && (
                  <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-200 font-medium">
                      {completionStats.userStreak} day streak
                    </span>
                  </div>
                )}

                {completionStats.userPercentile > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-200 font-medium">
                      Top {100 - completionStats.userPercentile}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAnotherRound}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Start another session
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 rounded-2xl font-semibold transition-colors"
              >
                Done for now
              </button>
            </div>
          </div>
        ) : (
          // ACTIVE TIMER - SILENT FOCUS ROOM
          <>
            {/* Presence Indicator - shows all users studying across all modes */}
            {globalStudyingCount > 1 && (
              <div className="flex items-center gap-2 mb-4 text-neutral-500 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>{globalStudyingCount} student{globalStudyingCount > 1 ? 's' : ''} studying right now</span>
              </div>
            )}

            {/* Participants */}
            {participants.length > 0 && (
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-400 text-sm">
                  {participants.map(p => p.name.split(' ')[0]).join(', ')} focusing with you
                </span>
              </div>
            )}

            {/* Timer - Big & Centered */}
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 mb-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-white/10"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="url(#timerGradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: '283%',
                    strokeDashoffset: `${283 * (1 - progressPercent / 100)}%`,
                    transition: 'stroke-dashoffset 1s linear'
                  }}
                />
                <defs>
                  <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Time Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-7xl sm:text-8xl font-bold tracking-tight">
                  {formatTime(timeRemaining)}
                </span>
                {/* Pause/Resume Button */}
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm text-white/70 hover:text-white transition-all"
                  aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Resume</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Task Reminder - ONE line */}
            {session.taskPrompt && (
              <div className="max-w-md text-center mb-8 px-4">
                <p className="text-neutral-300 text-lg leading-relaxed">
                  {session.taskPrompt}
                </p>
              </div>
            )}

            {/* Motivational Quote - Always Visible */}
            <div className="max-w-md w-full mb-6">
              <MotivationalQuote alwaysVisible={true} />
            </div>

            {/* Work outside reminder */}
            <p className="text-neutral-600 text-sm text-center max-w-xs">
              Do your work on paper, textbook, or another app. Stay here for accountability.
            </p>
          </>
        )}
      </main>

      {/* Study Roadmap Panel - Slides in from right */}
      {studyPlan && showRoadmap && !isCompleted && (
        <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 z-40 animate-in slide-in-from-right duration-300">
          <div className="h-full overflow-y-auto p-4 bg-neutral-950/80 backdrop-blur-xl">
            <StudyRoadmapPanel
              plan={studyPlan}
              onClose={() => setShowRoadmap(false)}
            />
          </div>
        </div>
      )}

    </div>
  )
}
