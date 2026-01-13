'use client'

/**
 * Focus Timer Page - Silent Focus Room
 *
 * A distraction-free, silent focus experience:
 * - Shows task immediately (no friction)
 * - Silent room with live student count
 * - No interruptions during session
 * - 1-minute warning alert
 * - Reward moment with confetti and percentile
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { X, Check, Volume2, VolumeX, Flame, Trophy, Users, RotateCcw, UserPlus, Search, Loader2, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { subscribeToFocusSessionParticipants } from '@/lib/supabase/realtime'

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
  pausedAt: string | null
  totalPausedMs: number
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

interface Partner {
  id: string
  name: string
  avatarUrl: string | null
  onlineStatus: string
  activityType: string | null
}

export default function FocusTimerPage() {
  const router = useRouter()
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

  // Stats
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null)
  const [liveUsersCount, setLiveUsersCount] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isHost, setIsHost] = useState(false)

  // Invitation UI state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Partner[]>([])
  const [selectedPartners, setSelectedPartners] = useState<Partner[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const confettiRef = useRef<HTMLCanvasElement | null>(null)

  // Play sound
  const playSound = useCallback((type: 'warning' | 'complete') => {
    if (!soundEnabled) return

    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      if (type === 'warning') {
        // Quick alert beep
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
        // Success chime
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

  // Fetch stats (live users, percentile, streak)
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/focus/stats')
      if (response.ok) {
        const data = await response.json()
        setLiveUsersCount(data.stats.liveUsersCount || 0)
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

  // Fetch participants
  const fetchParticipants = useCallback(async () => {
    try {
      const response = await fetch(`/api/focus/${sessionId}/invite`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data.participants.joined || [])
        setIsHost(data.isHost || false)
      }
    } catch (err) {
      console.error('Failed to fetch participants', err)
    }
  }, [sessionId])

  // Search partners with debouncing
  const searchPartners = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch('/api/partners/search-for-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10 }),
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.partners || [])
      }
    } catch (error) {
      console.error('Error searching partners:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search handler
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchPartners(query)
    }, 300)
  }, [searchPartners])

  // Toggle partner selection
  const togglePartnerSelection = useCallback((partner: Partner) => {
    setSelectedPartners(prev => {
      const isSelected = prev.some(p => p.id === partner.id)
      if (isSelected) {
        return prev.filter(p => p.id !== partner.id)
      } else {
        if (prev.length >= 10) {
          return prev
        }
        return [...prev, partner]
      }
    })
  }, [])

  // Send invitations
  const sendInvitations = useCallback(async () => {
    if (selectedPartners.length === 0) return

    setIsSendingInvites(true)
    try {
      const response = await fetch(`/api/focus/${sessionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerIds: selectedPartners.map(p => p.id),
        }),
      })

      if (response.ok) {
        setShowInviteModal(false)
        setSelectedPartners([])
        setSearchQuery('')
        setSearchResults([])
        fetchParticipants()
      } else {
        const error = await response.json()
        console.error('Error sending invitations:', error)
      }
    } catch (error) {
      console.error('Error sending invitations:', error)
    } finally {
      setIsSendingInvites(false)
    }
  }, [sessionId, selectedPartners, fetchParticipants])

  // Complete session
  const completeSession = useCallback(async () => {
    if (!session) return

    try {
      // Calculate actual minutes spent focusing (excluding paused time)
      const totalPausedMs = session.totalPausedMs || 0
      const effectiveElapsed = Date.now() - new Date(session.startedAt).getTime() - totalPausedMs
      const actualMinutes = Math.round(effectiveElapsed / 60000)

      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          actualMinutes: Math.min(Math.max(0, actualMinutes), session.durationMinutes),
        }),
      })

      playSound('complete')
      triggerConfetti()
      fetchStats()
    } catch (err) {
      console.error('Failed to complete session', err)
    }
  }, [session, sessionId, playSound, triggerConfetti, fetchStats])

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(`/api/focus/${sessionId}`)
        if (!response.ok) throw new Error('Session not found')

        const data = await response.json()
        const sessionData = data.session

        // If session was paused, resume it first
        if (sessionData.pausedAt && sessionData.status === 'ACTIVE') {
          try {
            const resumeResponse = await fetch(`/api/focus/${sessionId}/pause`, {
              method: 'DELETE',
            })
            if (resumeResponse.ok) {
              const resumeData = await resumeResponse.json()
              // Update session with resumed data
              sessionData.pausedAt = null
              sessionData.totalPausedMs = resumeData.session.totalPausedMs
            }
          } catch (resumeErr) {
            console.error('Failed to resume session', resumeErr)
          }
        }

        setSession(sessionData)

        // Calculate remaining time accounting for paused time
        const startTime = new Date(sessionData.startedAt).getTime()
        const durationMs = sessionData.durationMinutes * 60 * 1000
        const totalPausedMs = sessionData.totalPausedMs || 0
        const effectiveElapsed = Date.now() - startTime - totalPausedMs
        const remaining = Math.max(0, Math.ceil((durationMs - effectiveElapsed) / 1000))

        setTimeRemaining(remaining)

        if (sessionData.status !== 'ACTIVE' || remaining === 0) {
          setIsCompleted(true)
          setIsRunning(false)
        }

        // Fetch initial stats
        fetchStats()
      } catch (err) {
        setError('Failed to load session')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    // Refresh live count periodically
    const statsInterval = setInterval(fetchStats, 30000)
    return () => clearInterval(statsInterval)
  }, [sessionId, fetchStats])

  // Load participants and subscribe to real-time updates
  useEffect(() => {
    // Fetch initial participants
    fetchParticipants()

    // Subscribe to real-time participant changes
    const unsubscribe = subscribeToFocusSessionParticipants(
      sessionId,
      fetchParticipants
    )

    return () => {
      unsubscribe()
    }
  }, [sessionId, fetchParticipants])

  // Timer logic with 1-minute warning
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

  // Abandon session (permanently end it)
  const handleAbandon = async () => {
    if (!session) return

    try {
      // Calculate actual minutes spent (excluding paused time)
      const totalPausedMs = session.totalPausedMs || 0
      const effectiveElapsed = Date.now() - new Date(session.startedAt).getTime() - totalPausedMs
      const actualMinutes = Math.max(0, Math.round(effectiveElapsed / 60000))

      await fetch(`/api/focus/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ABANDONED', actualMinutes }),
      })

      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    }
  }

  // Go back to dashboard (pause session, can continue later)
  const handleGoBack = async () => {
    if (!session || session.status !== 'ACTIVE') {
      router.push('/dashboard')
      return
    }

    try {
      // Pause the session before navigating away
      await fetch(`/api/focus/${sessionId}/pause`, {
        method: 'POST',
      })
      router.push('/dashboard')
    } catch {
      // Still navigate even if pause fails
      router.push('/dashboard')
    }
  }

  // Start another round
  const handleAnotherRound = async () => {
    try {
      const response = await fetch('/api/focus/start-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 5 }),
      })

      if (!response.ok) {
        // Fallback
        const fallback = await fetch('/api/focus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMinutes: 5, mode: 'solo' }),
        })
        const data = await fallback.json()
        router.push(`/focus/${data.session.id}`)
        return
      }

      const data = await response.json()
      router.push(`/focus/${data.session.id}`)
    } catch {
      router.push('/dashboard')
    }
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
            ⏰ 1 minute left!
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-4 sm:p-6 relative z-40">
        <div className="flex items-center gap-2">
          {/* Back button - pauses session and goes to dashboard */}
          {!isCompleted && (
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-800 rounded-xl transition-colors text-neutral-400 hover:text-white"
              aria-label="Go back (pause session)"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Back</span>
            </button>
          )}

          {/* Abandon button - ends session permanently */}
          {!isCompleted && (
            <button
              onClick={handleAbandon}
              className="p-2 hover:bg-red-900/30 rounded-xl transition-colors group"
              aria-label="Abandon session"
              title="End session permanently"
            >
              <X className="w-5 h-5 text-neutral-600 group-hover:text-red-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Invite Button - Only show for host during active session */}
          {isHost && !isCompleted && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors text-white text-sm font-medium"
              aria-label="Invite partners"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite</span>
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 hover:bg-neutral-800 rounded-xl transition-colors"
            aria-label={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-neutral-500" />
            ) : (
              <VolumeX className="w-5 h-5 text-neutral-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        {isCompleted ? (
          // ✅ COMPLETION SCREEN
          <div className="text-center animate-in fade-in zoom-in duration-500 max-w-md w-full">
            {/* Success Icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl opacity-30 animate-pulse" />
              <div className="relative w-28 h-28 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                <Check className="w-14 h-14 text-white" />
              </div>
            </div>

            {/* Message */}
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Nice. You showed up.</h1>
            <p className="text-neutral-400 text-lg mb-8">
              You completed today&apos;s focus challenge.
            </p>

            {/* Stats */}
            {completionStats && (
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {completionStats.userPercentile > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-200 font-medium">
                      You beat {completionStats.userPercentile}% of students
                    </span>
                  </div>
                )}

                {completionStats.userStreak > 0 && (
                  <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <span className="text-orange-200 font-medium">
                      {completionStats.userStreak} day streak!
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Exit Message */}
            <p className="text-neutral-500 text-sm mb-6">
              You can stop now — or do another 5 minutes.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto px-8 py-4 bg-neutral-800 hover:bg-neutral-700 rounded-2xl font-semibold transition-colors"
              >
                I&apos;m done
              </button>
              <button
                onClick={handleAnotherRound}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl font-semibold transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Another round
              </button>
            </div>

            {/* Streak protection message */}
            <p className="text-neutral-600 text-sm mt-6">
              Streak protected. See you tomorrow.
            </p>
          </div>
        ) : (
          // ⏱️ ACTIVE TIMER - SILENT FOCUS ROOM
          <>
            {/* Silent Focus Room Badge */}
            <div className="flex items-center gap-3 mb-6 text-neutral-400">
              <span className="text-2xl">🔇</span>
              <span className="font-medium">Silent Focus Room</span>
            </div>

            {/* Live Users Count */}
            {liveUsersCount > 0 && (
              <div className="flex items-center gap-2 mb-8 text-neutral-500 text-sm">
                <Users className="w-4 h-4" />
                <span>{liveUsersCount} students focusing right now</span>
              </div>
            )}

            {/* Session Participants - Live */}
            {participants.length > 0 && (
              <div className="w-full max-w-lg mb-8 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3 text-neutral-400 text-sm">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">
                    Focusing together ({participants.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 bg-neutral-800 rounded-full px-3 py-1.5"
                    >
                      {participant.avatarUrl ? (
                        <Image
                          src={participant.avatarUrl}
                          alt={participant.name}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {participant.name[0]}
                        </div>
                      )}
                      <span className="text-white text-sm">{participant.name}</span>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Display */}
            {session.taskPrompt && (
              <div className="w-full max-w-lg mb-8 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center">
                <p className="text-white text-lg leading-relaxed">
                  {session.taskPrompt}
                </p>
                {session.taskSubject && session.taskSubject !== 'General' && (
                  <p className="text-neutral-500 text-sm mt-3">
                    {session.taskSubject}
                  </p>
                )}
              </div>
            )}

            {/* Timer Ring */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 mb-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-neutral-800"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  stroke="url(#timerGradient)"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercent / 100)}`}
                  className="transition-all duration-1000 ease-linear"
                  style={{ strokeDasharray: '283%', strokeDashoffset: `${283 * (1 - progressPercent / 100)}%` }}
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
                <span className="font-mono text-6xl sm:text-7xl font-bold tracking-tight">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {/* Pause/Resume - Subtle */}
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
            >
              {isRunning ? 'Pause' : 'Resume'}
            </button>
          </>
        )}
      </main>

      {/* Footer - Silent during session */}
      {!isCompleted && (
        <footer className="p-6 text-center">
          <p className="text-neutral-700 text-sm">
            Stay focused. You got this.
          </p>
        </footer>
      )}

      {/* Invite Partners Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Invite Partners
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Max {10 - selectedPartners.length} more
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search partners by name..."
                  className="w-full pl-10 pr-4 py-3 bg-neutral-800 border-0 rounded-xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Selected Partners */}
            {selectedPartners.length > 0 && (
              <div className="p-4 border-b border-neutral-800">
                <p className="text-xs font-semibold text-neutral-400 mb-2">
                  SELECTED ({selectedPartners.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedPartners.map(partner => (
                    <button
                      key={partner.id}
                      onClick={() => togglePartnerSelection(partner)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 text-blue-300 rounded-full hover:bg-blue-900/50 transition-colors"
                    >
                      {partner.avatarUrl ? (
                        <Image
                          src={partner.avatarUrl}
                          alt={partner.name}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {partner.name[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium">{partner.name}</span>
                      <X className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchQuery.trim().length < 2 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-400 text-sm">
                    Type at least 2 characters to search
                  </p>
                </div>
              ) : searchResults.length === 0 && !isSearching ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-400 text-sm">
                    No partners found
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map(partner => {
                    const isSelected = selectedPartners.some(p => p.id === partner.id)
                    return (
                      <button
                        key={partner.id}
                        onClick={() => togglePartnerSelection(partner)}
                        disabled={!isSelected && selectedPartners.length >= 10}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-blue-900/30 border-2 border-blue-500'
                            : 'bg-neutral-800 hover:bg-neutral-700 border-2 border-transparent'
                        } ${!isSelected && selectedPartners.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {partner.avatarUrl ? (
                          <Image
                            src={partner.avatarUrl}
                            alt={partner.name}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {partner.name[0]}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-white">
                            {partner.name}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {partner.onlineStatus === 'online' ? (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full" />
                                Online
                              </span>
                            ) : (
                              'Offline'
                            )}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-800">
              <button
                onClick={sendInvitations}
                disabled={selectedPartners.length === 0 || isSendingInvites}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-neutral-700 disabled:to-neutral-700 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSendingInvites ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>
                      Send {selectedPartners.length > 0 ? `${selectedPartners.length} ` : ''}
                      Invitation{selectedPartners.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
