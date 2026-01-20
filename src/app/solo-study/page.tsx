'use client'

/**
 * Solo Study Page - Full-Featured Virtual Study Room
 *
 * Features:
 * - Virtual backgrounds (library, cafe, nature)
 * - Ambient soundscapes with mixing
 * - Pomodoro / custom timers
 * - Light distraction blocking
 * - Progress tracking & streaks
 * - Gamification (XP, badges, levels)
 * - Motivational quotes
 * - AI tutor/friend
 * - Whiteboard/scratchpad
 *
 * This is the premium study experience for longer, focused sessions.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Trophy,
  Flame,
  Star,
  Zap,
  MessageSquare,
  PenTool,
  X,
  Check,
  Layers,
  Map,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { handleSessionEnd } from '@/lib/session/events'
import SoloStudyBackground from '@/components/solo-study/SoloStudyBackground'
import SoloStudySoundMixer from '@/components/solo-study/SoloStudySoundMixer'
import SoloStudyWhiteboard from '@/components/solo-study/SoloStudyWhiteboard'
import SoloStudyAITutor from '@/components/solo-study/SoloStudyAITutor'
import FlashcardPanel from '@/components/solo-study/FlashcardPanel'
import FlashcardFullScreen from '@/components/solo-study/FlashcardFullScreen'
import FocusSessionReminder, { NotificationStatusIndicator } from '@/components/solo-study/FocusSessionReminder'
import StudyMaterialsPanel from '@/components/solo-study/StudyMaterialsPanel'
import { useFocusReminders } from '@/lib/hooks/useFocusReminders'
import { DistractionBlocker, MotivationalQuote, StudyRoadmapPanel } from '@/components/focus'

// Types for study plan from "I'm Stuck" flow
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

// Storage keys for Solo Study
const SOLO_STUDY_STORAGE = {
  BACKGROUND: 'solo_study_background',
  SOUNDS: 'solo_study_sounds',
  TIMER_FOCUS: 'solo_study_timer_focus',
  TIMER_BREAK: 'solo_study_timer_break',
  // Session persistence (for pause on page leave)
  ACTIVE_SESSION: 'solo_study_active_session',
}

// Default Pomodoro settings
const DEFAULT_FOCUS_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5

export default function SoloStudyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Get subject from URL query param (from study suggestions)
  const subjectFromUrl = searchParams.get('subject')

  // Session state
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)

  // Timer settings
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES)
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES)
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_FOCUS_MINUTES * 60)

  // UI state
  const [selectedBackground, setSelectedBackground] = useState('library')
  const [showSettings, setShowSettings] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [showAITutor, setShowAITutor] = useState(false)
  const [showFlashcards, setShowFlashcards] = useState(false)
  const [showMaterials, setShowMaterials] = useState(false)
  const [flashcardFullScreen, setFlashcardFullScreen] = useState<{ deckId: string; title: string } | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null)

  // Away time tracking state
  const [showAwayModal, setShowAwayModal] = useState(false)
  const [awayMinutes, setAwayMinutes] = useState(0)
  const [awayActivity, setAwayActivity] = useState('')
  const [awayMessage, setAwayMessage] = useState<{ type: 'success' | 'warning'; text: string } | null>(null)
  const awayStartTimeRef = useRef<number | null>(null)

  // Stats
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalXP, setTotalXP] = useState(0)
  const [level, setLevel] = useState(1)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const isEndingSessionRef = useRef(false) // Prevent saving session when ending

  // Focus reminders - gentle notifications when user leaves during session
  const {
    hasPermission: hasNotificationPermission,
    requestPermission: requestNotificationPermission,
  } = useFocusReminders({
    isSessionActive,
    isPaused,
    timeRemaining,
    sessionId: sessionIdRef.current,
    onReturn: () => {
      // User returned to the app - session is already paused by visibility handler
    },
  })

  // Load saved preferences and restore active session
  useEffect(() => {
    const savedBg = localStorage.getItem(SOLO_STUDY_STORAGE.BACKGROUND)
    const savedFocus = localStorage.getItem(SOLO_STUDY_STORAGE.TIMER_FOCUS)
    const savedBreak = localStorage.getItem(SOLO_STUDY_STORAGE.TIMER_BREAK)

    if (savedBg) setSelectedBackground(savedBg)
    if (savedFocus) {
      const mins = parseInt(savedFocus)
      setFocusMinutes(mins)
      setTimeRemaining(mins * 60)
    }
    if (savedBreak) setBreakMinutes(parseInt(savedBreak))

    // Check for "I'm Stuck" auto-start first (takes priority for new sessions)
    const savedPlan = sessionStorage.getItem('imstuck_study_plan')
    const shouldAutoStart = sessionStorage.getItem('imstuck_auto_start') === 'true'

    // Clear the flags immediately to prevent re-triggering on refresh
    sessionStorage.removeItem('imstuck_study_plan')
    sessionStorage.removeItem('imstuck_auto_start')

    if (savedPlan && shouldAutoStart) {
      try {
        const plan = JSON.parse(savedPlan)
        if (plan && plan.id && plan.steps && plan.steps.length > 0) {
          setStudyPlan(plan)
          setShowRoadmap(true)
          const planMinutes = plan.totalMinutes || DEFAULT_FOCUS_MINUTES
          setFocusMinutes(planMinutes)
          setTimeRemaining(planMinutes * 60)

          // Auto-start the session
          setTimeout(() => {
            setIsSessionActive(true)
            setIsPaused(false)
            setSessionStartTime(new Date())

            fetch('/api/solo-study/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                focusMinutes: planMinutes,
                breakMinutes: DEFAULT_BREAK_MINUTES,
                background: localStorage.getItem(SOLO_STUDY_STORAGE.BACKGROUND) || 'library',
                label: plan.subject,
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.sessionId) {
                  sessionIdRef.current = data.sessionId
                }
              })
              .catch((err) => console.error('Failed to start session:', err))

            fetch('/api/presence/activity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ activityType: 'studying' }),
            }).catch(() => {})
          }, 100)
        }
      } catch {
        // Invalid plan data, continue with normal flow
      }
      return // Don't try to restore existing session if auto-starting new one
    }

    // Restore active session if exists (user navigated away and came back)
    const savedSession = localStorage.getItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION)
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession)
        // Validate session data
        if (session.sessionId && session.timeRemaining > 0) {
          // Verify session is still active on server before restoring
          fetch('/api/study/last-session')
            .then((res) => res.json())
            .then((data) => {
              // Only restore if server confirms session is still active
              if (data.hasActiveSession && data.activeSession?.id === session.sessionId) {
                sessionIdRef.current = session.sessionId
                // Use the paused time from server if available, otherwise use localStorage
                const serverTime = data.activeSession.timeRemaining
                setTimeRemaining(serverTime > 0 ? serverTime : session.timeRemaining)
                setIsBreak(session.isBreak || false)
                setCompletedPomodoros(session.completedPomodoros || 0)
                setSessionStartTime(session.sessionStartTime ? new Date(session.sessionStartTime) : new Date())
                setFocusMinutes(session.focusMinutes || DEFAULT_FOCUS_MINUTES)
                setBreakMinutes(session.breakMinutes || DEFAULT_BREAK_MINUTES)
                // Start in paused state so user can resume when ready
                setIsSessionActive(true)
                setIsPaused(true)
              } else {
                // Session was ended or doesn't exist, clear localStorage
                localStorage.removeItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION)
              }
            })
            .catch(() => {
              // On error, don't restore session to be safe
              localStorage.removeItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION)
            })
        }
      } catch {
        // Invalid session data, clear it
        localStorage.removeItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION)
      }
    }
  }, [])

  // Fetch user stats
  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/user/stats')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.stats) {
            setStreak(data.stats.streak?.current || 0)
            // Use todayMinutes (raw minutes) not today.value (which is hours if >= 60)
            setTodayMinutes(data.stats.studyTime?.todayMinutes || 0)
            setTotalXP(data.stats.points || 0)
            // Calculate level (100 XP per level)
            setLevel(Math.floor((data.stats.points || 0) / 100) + 1)
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [user])

  // Save session state when leaving page (pause on navigate away)
  useEffect(() => {
    const saveSessionState = async () => {
      // Don't save if session is being ended (prevents race condition)
      if (isEndingSessionRef.current) return

      if (isSessionActive && sessionIdRef.current && timeRemaining > 0) {
        // Save to localStorage for quick restore
        const sessionState = {
          sessionId: sessionIdRef.current,
          timeRemaining,
          isBreak,
          completedPomodoros,
          sessionStartTime: sessionStartTime?.toISOString(),
          focusMinutes,
          breakMinutes,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION, JSON.stringify(sessionState))

        // Also save to database so dashboard shows correct paused time
        try {
          await fetch('/api/solo-study/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              action: 'pause',
              timeRemaining,
            }),
          })
        } catch {
          // Ignore errors - localStorage backup is enough
        }
      }
    }

    // Handle page visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isSessionActive && !isPaused) {
        // Pause the timer when page becomes hidden and track when they left
        awayStartTimeRef.current = Date.now()
        setIsPaused(true)
        saveSessionState()
      } else if (document.visibilityState === 'visible' && isSessionActive && isPaused && awayStartTimeRef.current) {
        // User returned - calculate how long they were away
        const awayTimeMs = Date.now() - awayStartTimeRef.current
        const awayMins = Math.round(awayTimeMs / 60000)

        // Only show modal if away for at least 1 minute
        if (awayMins >= 1) {
          setAwayMinutes(awayMins)
          setAwayActivity('')
          setAwayMessage(null)
          setShowAwayModal(true)
        }
        awayStartTimeRef.current = null
      }
    }

    // Handle before unload (page refresh, close)
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery during page unload
      if (isSessionActive && sessionIdRef.current && timeRemaining > 0 && !isEndingSessionRef.current) {
        const data = JSON.stringify({
          sessionId: sessionIdRef.current,
          action: 'pause',
          timeRemaining,
        })
        navigator.sendBeacon('/api/solo-study/pause', new Blob([data], { type: 'application/json' }))

        // Also save to localStorage
        const sessionState = {
          sessionId: sessionIdRef.current,
          timeRemaining,
          isBreak,
          completedPomodoros,
          sessionStartTime: sessionStartTime?.toISOString(),
          focusMinutes,
          breakMinutes,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION, JSON.stringify(sessionState))
      }
    }

    // Handle route change (Next.js navigation)
    const handleRouteChange = () => {
      if (isSessionActive && !isEndingSessionRef.current) {
        setIsPaused(true)
        saveSessionState()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleRouteChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleRouteChange)
    }
  }, [isSessionActive, isPaused, timeRemaining, isBreak, completedPomodoros, sessionStartTime, focusMinutes, breakMinutes])

  // Timer logic
  useEffect(() => {
    if (!isSessionActive || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer completed
          if (isBreak) {
            // Break ended, start focus
            setIsBreak(false)
            playSound('focus')
            return focusMinutes * 60
          } else {
            // Focus ended
            setCompletedPomodoros((p) => p + 1)
            handlePomodoroComplete()

            // Skip break if breakMinutes is 0 (user chose "None")
            if (breakMinutes === 0) {
              playSound('focus')
              return focusMinutes * 60
            } else {
              // Start break
              setIsBreak(true)
              playSound('break')
              return breakMinutes * 60
            }
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isSessionActive, isPaused, isBreak, focusMinutes, breakMinutes])

  // Play notification sound
  const playSound = useCallback((type: 'focus' | 'break' | 'complete') => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain)
      gain.connect(audioContext.destination)

      if (type === 'break') {
        osc.frequency.value = 523.25 // C5
        gain.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        osc.start(audioContext.currentTime)
        osc.stop(audioContext.currentTime + 0.5)
      } else if (type === 'focus') {
        osc.frequency.value = 659.25 // E5
        gain.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        osc.start(audioContext.currentTime)
        osc.stop(audioContext.currentTime + 0.5)
      } else {
        // Complete - triumphant sound
        osc.frequency.value = 523.25
        gain.gain.setValueAtTime(0.3, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8)
        osc.start(audioContext.currentTime)
        osc.stop(audioContext.currentTime + 0.8)
      }
    } catch {
      // Audio not available
    }
  }, [])

  // Handle pomodoro completion - award XP
  const handlePomodoroComplete = useCallback(async () => {
    const xpEarned = 25 // Base XP for completing a pomodoro
    setTotalXP((prev) => prev + xpEarned)
    setTodayMinutes((prev) => prev + focusMinutes)

    // Update level
    const newTotalXP = totalXP + xpEarned
    setLevel(Math.floor(newTotalXP / 100) + 1)

    // Track in backend
    try {
      await fetch('/api/solo-study/complete-pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          focusMinutes,
          xpEarned,
        }),
      })
    } catch (error) {
      console.error('Failed to track pomodoro:', error)
    }
  }, [focusMinutes, totalXP])

  // Start session
  const handleStartSession = async () => {
    // Clear any stale saved session (starting fresh)
    localStorage.removeItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION)

    setIsSessionActive(true)
    setIsPaused(false)
    setSessionStartTime(new Date())
    setTimeRemaining(focusMinutes * 60)
    setIsBreak(false)
    setCompletedPomodoros(0)

    // Create session in backend
    try {
      const response = await fetch('/api/solo-study/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusMinutes,
          breakMinutes,
          background: selectedBackground,
          subject: subjectFromUrl || undefined,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        sessionIdRef.current = data.sessionId
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    }

    // Update presence
    try {
      await fetch('/api/presence/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: 'studying',
          activityDetails: subjectFromUrl ? { subject: subjectFromUrl } : undefined,
        }),
      })
    } catch {
      // Ignore presence errors
    }
  }

  // Pause/resume
  const handleTogglePause = async () => {
    const newPausedState = !isPaused
    setIsPaused(newPausedState)

    // Update pause state in database
    if (sessionIdRef.current) {
      try {
        if (newPausedState) {
          // Pausing - save current time remaining
          await fetch('/api/solo-study/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              action: 'pause',
              timeRemaining,
            }),
          })
        } else {
          // Resuming - clear paused state
          await fetch('/api/solo-study/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              action: 'resume',
            }),
          })
        }
      } catch {
        // Ignore errors - local state is updated
      }
    }
  }

  // End session
  const handleEndSession = async () => {
    // Mark session as ending to prevent race conditions with save handlers
    isEndingSessionRef.current = true

    const currentSessionId = sessionIdRef.current

    // Clear saved session state FIRST (session is ending properly)
    localStorage.removeItem(SOLO_STUDY_STORAGE.ACTIVE_SESSION)
    sessionIdRef.current = null

    // Reset all session state
    setIsSessionActive(false)
    setIsPaused(false)
    setIsBreak(false)
    setCompletedPomodoros(0)
    setSessionStartTime(null)
    // Reset timer to default focus time
    setTimeRemaining(focusMinutes * 60)

    // Show completion modal
    setShowCompletionModal(true)

    // Calculate total time for stats
    const totalMinutes = sessionStartTime
      ? Math.round((Date.now() - sessionStartTime.getTime()) / 60000)
      : 0

    // End session in backend
    if (currentSessionId) {
      try {
        await fetch('/api/solo-study/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            totalMinutes,
            completedPomodoros,
          }),
        })

        // Clear all session caches and notify other components (e.g., dashboard)
        await handleSessionEnd(queryClient, {
          sessionId: currentSessionId,
          sessionType: 'solo_study',
          reason: totalMinutes >= focusMinutes * 0.8 ? 'completed' : 'ended_early',
        })
      } catch (error) {
        console.error('Failed to end session:', error)
      }
    }

    // Update presence
    try {
      await fetch('/api/presence/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: 'browsing' }),
      })
    } catch {
      // Ignore presence errors
    }

    // Reset the ending flag so new sessions can start
    isEndingSessionRef.current = false
  }

  // Reset timer
  const handleResetTimer = () => {
    setTimeRemaining(isBreak ? breakMinutes * 60 : focusMinutes * 60)
  }

  // Productive activities that count as study time
  const PRODUCTIVE_KEYWORDS = [
    'homework', 'assignment', 'study', 'studying', 'reading', 'research',
    'tutorial', 'course', 'lecture', 'learning', 'practice', 'exercise',
    'notes', 'flashcard', 'review', 'quiz', 'test', 'exam', 'project',
    'writing', 'essay', 'paper', 'coding', 'programming', 'documentation',
    'khan', 'coursera', 'udemy', 'edx', 'textbook', 'article', 'solving',
    'problem', 'math', 'science', 'history', 'language', 'vocabulary'
  ]

  // Non-productive activities
  const NON_PRODUCTIVE_KEYWORDS = [
    'game', 'gaming', 'youtube', 'netflix', 'tiktok', 'instagram', 'facebook',
    'twitter', 'reddit', 'twitch', 'discord', 'video', 'movie', 'show',
    'social media', 'browsing', 'scrolling', 'chatting', 'texting', 'nothing',
    'break', 'rest', 'snack', 'food', 'eating', 'bathroom', 'phone'
  ]

  // Handle away activity submission
  const handleAwayActivitySubmit = () => {
    const activityLower = awayActivity.toLowerCase().trim()

    if (!activityLower) {
      setAwayMessage({ type: 'warning', text: 'Please tell us what you did.' })
      return
    }

    // Check if activity is productive
    const isProductive = PRODUCTIVE_KEYWORDS.some(keyword => activityLower.includes(keyword))
    const isNonProductive = NON_PRODUCTIVE_KEYWORDS.some(keyword => activityLower.includes(keyword))

    if (isProductive && !isNonProductive) {
      // Subtract away time from remaining time (credit progress for productive time)
      const secondsToSubtract = awayMinutes * 60
      setTimeRemaining(prev => Math.max(0, prev - secondsToSubtract))
      setTodayMinutes(prev => prev + awayMinutes)

      setAwayMessage({
        type: 'success',
        text: `Great work! ${awayMinutes} ${awayMinutes === 1 ? 'minute' : 'minutes'} of study time credited!`
      })

      // Close modal after showing success message
      setTimeout(() => {
        setShowAwayModal(false)
        setIsPaused(false) // Auto-resume after productive activity
      }, 2000)
    } else {
      // Don't add time
      setAwayMessage({
        type: 'warning',
        text: 'Keep studying! Time not added, but you can get back to it now.'
      })

      // Close modal after showing message
      setTimeout(() => {
        setShowAwayModal(false)
        // Stay paused - user needs to manually resume
      }, 2000)
    }
  }

  // Skip the away activity prompt (user doesn't want to explain)
  const handleSkipAwayActivity = () => {
    setShowAwayModal(false)
    // Stay paused - user can manually resume
  }

  // Save settings
  const handleSaveSettings = (focus: number, breakMins: number) => {
    setFocusMinutes(focus)
    setBreakMinutes(breakMins)
    localStorage.setItem(SOLO_STUDY_STORAGE.TIMER_FOCUS, focus.toString())
    localStorage.setItem(SOLO_STUDY_STORAGE.TIMER_BREAK, breakMins.toString())
    if (!isSessionActive) {
      setTimeRemaining(focus * 60)
    }
    setShowSettings(false)
  }

  // Handle background change
  const handleBackgroundChange = (bgId: string) => {
    setSelectedBackground(bgId)
    localStorage.setItem(SOLO_STUDY_STORAGE.BACKGROUND, bgId)
  }

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progressPercent = isBreak
    ? ((breakMinutes * 60 - timeRemaining) / (breakMinutes * 60)) * 100
    : ((focusMinutes * 60 - timeRemaining) / (focusMinutes * 60)) * 100

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <SoloStudyBackground backgroundId={selectedBackground}>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Stats badges - HIDDEN during active session to keep focus on learning */}
        {/* Show only when session is NOT active (before starting or after completing) */}
        {!isSessionActive && (
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-300 rounded-full px-3 py-1.5 text-sm">
                <Flame className="w-4 h-4" />
                <span>{streak}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-purple-500/20 text-purple-300 rounded-full px-3 py-1.5 text-sm">
              <Star className="w-4 h-4" />
              <span>Lv {level}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 rounded-full px-3 py-1.5 text-sm">
              <Zap className="w-4 h-4" />
              <span>{totalXP} XP</span>
            </div>
          </div>
        )}

        {/* Tools */}
        <div className="flex items-center gap-2">
          <SoloStudySoundMixer isPlaying={isSessionActive && !isPaused} />
          <DistractionBlocker isSessionActive={isSessionActive && !isPaused} />
          <NotificationStatusIndicator
            hasPermission={hasNotificationPermission}
            onRequestPermission={requestNotificationPermission}
          />
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Focus Session Reminder - notification permission prompt and welcome back message */}
      <FocusSessionReminder
        hasPermission={hasNotificationPermission}
        onRequestPermission={requestNotificationPermission}
        isSessionActive={isSessionActive}
        isPaused={isPaused}
        onResume={() => setIsPaused(false)}
      />

      {/* Main Content */}
      <main className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-32">
        {/* Timer Display */}
        <div className="relative w-80 h-80 sm:w-96 sm:h-96 mb-8">
          {/* Progress Ring */}
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
              stroke={isBreak ? '#10b981' : '#3b82f6'}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              style={{
                strokeDasharray: '283%',
                strokeDashoffset: `${283 * (1 - progressPercent / 100)}%`,
                transition: 'stroke-dashoffset 1s linear',
              }}
            />
          </svg>

          {/* Timer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-white/60 mb-2">
              {isBreak ? 'Break Time' : 'Focus Time'}
            </span>
            <span className="font-mono text-7xl sm:text-8xl font-bold text-white tracking-tight">
              {formatTime(timeRemaining)}
            </span>
            {completedPomodoros > 0 && (
              <div className="flex items-center gap-1 mt-3 text-white/60">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm">{completedPomodoros} completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-4">
          {!isSessionActive ? (
            <button
              onClick={handleStartSession}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-lg transition-all transform hover:scale-105 flex items-center gap-3 shadow-xl shadow-blue-500/25"
            >
              <Play className="w-6 h-6 fill-white" />
              Start Session
            </button>
          ) : (
            <>
              <button
                onClick={handleTogglePause}
                className={`p-4 rounded-2xl font-semibold transition-all ${
                  isPaused
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {isPaused ? <Play className="w-6 h-6 fill-white" /> : <Pause className="w-6 h-6" />}
              </button>
              <button
                onClick={handleResetTimer}
                className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
              <button
                onClick={handleEndSession}
                className="px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-2xl font-semibold transition-all"
              >
                End Session
              </button>
            </>
          )}
        </div>

        {/* Today's Progress */}
        <div className="mt-8 text-center text-white/60 text-sm">
          <span className="font-semibold text-white/90">{todayMinutes}</span> minutes studied today
        </div>

        {/* Always-visible motivational quote */}
        <div className="mt-6 max-w-md w-full">
          <MotivationalQuote alwaysVisible={true} />
        </div>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button
          onClick={() => setShowMaterials(true)}
          className="p-4 bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-sm hover:from-purple-500/30 hover:to-blue-500/30 text-purple-300 rounded-2xl transition-all shadow-lg"
          title="Study Materials"
        >
          <BookOpen className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowFlashcards(true)}
          className="p-4 bg-blue-500/20 backdrop-blur-sm hover:bg-blue-500/30 text-blue-300 rounded-2xl transition-all shadow-lg"
          title="Flashcards"
        >
          <Layers className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowWhiteboard(true)}
          className="p-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-2xl transition-all shadow-lg"
          title="Whiteboard"
        >
          <PenTool className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowAITutor(true)}
          className="p-4 bg-purple-500/20 backdrop-blur-sm hover:bg-purple-500/30 text-purple-300 rounded-2xl transition-all shadow-lg"
          title="AI Tutor"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
        {/* Roadmap toggle - only show if there's a study plan */}
        {studyPlan && (
          <button
            onClick={() => setShowRoadmap(!showRoadmap)}
            className={`p-4 backdrop-blur-sm rounded-2xl transition-all shadow-lg ${
              showRoadmap
                ? 'bg-amber-500/30 text-amber-300'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Study Roadmap"
          >
            <Map className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Background Selector */}
      <div className="fixed bottom-6 left-6 z-40">
        <SoloStudyBackground
          backgroundId={selectedBackground}
          onChangeBackground={handleBackgroundChange}
          showSelector={true}
        />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Timer Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Focus Duration */}
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Focus Duration</label>
                <div className="flex flex-wrap gap-2">
                  {[10, 15, 25, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setFocusMinutes(mins)}
                      className={`flex-1 min-w-[48px] py-3 rounded-xl font-medium transition-all ${
                        focusMinutes === mins
                          ? 'bg-blue-500 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Break Duration */}
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Break Duration (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {[0, 5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setBreakMinutes(mins)}
                      className={`flex-1 min-w-[48px] py-3 rounded-xl font-medium transition-all ${
                        breakMinutes === mins
                          ? mins === 0 ? 'bg-neutral-600 text-white' : 'bg-green-500 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {mins === 0 ? 'None' : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings(focusMinutes, breakMinutes)}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-bold transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whiteboard Modal */}
      {showWhiteboard && (
        <SoloStudyWhiteboard onClose={() => setShowWhiteboard(false)} />
      )}

      {/* AI Tutor Panel - with study plan context if available */}
      {showAITutor && (
        <SoloStudyAITutor
          onClose={() => setShowAITutor(false)}
          studyPlan={studyPlan}
        />
      )}

      {/* Study Materials Panel - AI-powered content explanation */}
      {showMaterials && (
        <StudyMaterialsPanel
          onClose={() => setShowMaterials(false)}
          studyPlan={studyPlan}
        />
      )}

      {/* Flashcard Panel - with study plan context if available */}
      {showFlashcards && (
        <FlashcardPanel
          onClose={() => setShowFlashcards(false)}
          onOpenFullScreen={(deckId) => {
            setShowFlashcards(false)
            setFlashcardFullScreen({ deckId, title: 'Flashcards' })
          }}
          studyPlan={studyPlan}
        />
      )}

      {/* Flashcard Full Screen */}
      {flashcardFullScreen && (
        <FlashcardFullScreen
          deckId={flashcardFullScreen.deckId}
          deckTitle={flashcardFullScreen.title}
          onClose={() => setFlashcardFullScreen(null)}
        />
      )}

      {/* Study Roadmap Panel */}
      {showRoadmap && studyPlan && (
        <div className="fixed top-20 right-6 z-40 w-96 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <StudyRoadmapPanel
            plan={studyPlan}
            onClose={() => setShowRoadmap(false)}
          />
        </div>
      )}

      {/* Away Time Modal - shown when user returns after leaving the tab */}
      {showAwayModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👋</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Welcome back!</h2>
              <p className="text-neutral-400">
                You were away for{' '}
                <span className="text-amber-400 font-semibold">
                  {awayMinutes} {awayMinutes === 1 ? 'minute' : 'minutes'}
                </span>
              </p>
            </div>

            {/* Activity Input */}
            {!awayMessage && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">
                    What did you do while away?
                  </label>
                  <input
                    type="text"
                    value={awayActivity}
                    onChange={(e) => setAwayActivity(e.target.value)}
                    placeholder="e.g., Doing homework, Watching tutorial, Playing games..."
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAwayActivitySubmit()
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    If you were doing something productive (homework, tutorial, reading), that time will be added to your session!
                  </p>
                </div>

                {/* Quick Select Options */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAwayActivity('Doing homework')}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      awayActivity === 'Doing homework'
                        ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    📚 Homework
                  </button>
                  <button
                    onClick={() => setAwayActivity('Watching tutorial')}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      awayActivity === 'Watching tutorial'
                        ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    🎬 Tutorial
                  </button>
                  <button
                    onClick={() => setAwayActivity('Reading textbook')}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      awayActivity === 'Reading textbook'
                        ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    📖 Reading
                  </button>
                  <button
                    onClick={() => setAwayActivity('Taking a break')}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      awayActivity === 'Taking a break'
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    ☕ Break
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSkipAwayActivity}
                    className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-medium transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleAwayActivitySubmit}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-bold transition-all"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Result Message */}
            {awayMessage && (
              <div className="text-center py-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    awayMessage.type === 'success'
                      ? 'bg-green-500/20'
                      : 'bg-amber-500/20'
                  }`}
                >
                  <span className="text-3xl">
                    {awayMessage.type === 'success' ? '✅' : '💪'}
                  </span>
                </div>
                <p
                  className={`font-medium ${
                    awayMessage.type === 'success' ? 'text-green-300' : 'text-amber-300'
                  }`}
                >
                  {awayMessage.text}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Great Session!</h2>
            <p className="text-neutral-400 mb-6">You completed {completedPomodoros} focus sessions.</p>

            <div className="flex justify-center gap-4 mb-8">
              <div className="bg-purple-500/20 text-purple-300 rounded-xl px-4 py-3">
                <div className="text-2xl font-bold">+{completedPomodoros * 25}</div>
                <div className="text-xs">XP earned</div>
              </div>
              <div className="bg-blue-500/20 text-blue-300 rounded-xl px-4 py-3">
                <div className="text-2xl font-bold">{completedPomodoros * focusMinutes}</div>
                <div className="text-xs">minutes</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCompletionModal(false)
                  setCompletedPomodoros(0)
                  setTimeRemaining(focusMinutes * 60)
                }}
                className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-bold transition-all"
              >
                Start Another
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-4 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </SoloStudyBackground>
  )
}
