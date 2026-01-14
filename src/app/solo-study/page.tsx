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
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import SoloStudyBackground from '@/components/solo-study/SoloStudyBackground'
import SoloStudySoundMixer from '@/components/solo-study/SoloStudySoundMixer'
import SoloStudyWhiteboard from '@/components/solo-study/SoloStudyWhiteboard'
import SoloStudyAITutor from '@/components/solo-study/SoloStudyAITutor'
import FlashcardPanel from '@/components/solo-study/FlashcardPanel'
import FlashcardFullScreen from '@/components/solo-study/FlashcardFullScreen'
import { DistractionBlocker, MotivationalQuote } from '@/components/focus'

// Storage keys for Solo Study
const SOLO_STUDY_STORAGE = {
  BACKGROUND: 'solo_study_background',
  SOUNDS: 'solo_study_sounds',
  TIMER_FOCUS: 'solo_study_timer_focus',
  TIMER_BREAK: 'solo_study_timer_break',
}

// Default Pomodoro settings
const DEFAULT_FOCUS_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5

export default function SoloStudyPage() {
  const router = useRouter()
  const { user, profile } = useAuth()

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
  const [flashcardFullScreen, setFlashcardFullScreen] = useState<{ deckId: string; title: string } | null>(null)
  const [showQuote, setShowQuote] = useState(true)
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  // Stats
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalXP, setTotalXP] = useState(0)
  const [level, setLevel] = useState(1)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Load saved preferences
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
            setTodayMinutes(data.stats.studyTime?.today?.value || 0)
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
            // Focus ended, start break
            setCompletedPomodoros((p) => p + 1)
            setIsBreak(true)
            playSound('break')
            handlePomodoroComplete()
            return breakMinutes * 60
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
    setIsSessionActive(true)
    setIsPaused(false)
    setSessionStartTime(new Date())
    setTimeRemaining(focusMinutes * 60)
    setIsBreak(false)

    // Create session in backend
    try {
      const response = await fetch('/api/solo-study/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusMinutes,
          breakMinutes,
          background: selectedBackground,
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
        body: JSON.stringify({ activityType: 'studying' }),
      })
    } catch {
      // Ignore presence errors
    }
  }

  // Pause/resume
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev)
  }

  // End session
  const handleEndSession = async () => {
    setIsSessionActive(false)
    setIsPaused(false)
    setShowCompletionModal(true)

    // Calculate total time
    const totalMinutes = sessionStartTime
      ? Math.round((Date.now() - sessionStartTime.getTime()) / 60000)
      : 0

    // End session in backend
    try {
      await fetch('/api/solo-study/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          totalMinutes,
          completedPomodoros,
        }),
      })
    } catch (error) {
      console.error('Failed to end session:', error)
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

    sessionIdRef.current = null
  }

  // Reset timer
  const handleResetTimer = () => {
    setTimeRemaining(isBreak ? breakMinutes * 60 : focusMinutes * 60)
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
      {/* Motivational Quote at Start */}
      {showQuote && !isSessionActive && (
        <MotivationalQuote showAtStart={true} />
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Stats badges */}
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

        {/* Tools */}
        <div className="flex items-center gap-2">
          <SoloStudySoundMixer isPlaying={isSessionActive && !isPaused} />
          <DistractionBlocker isSessionActive={isSessionActive && !isPaused} />
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

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
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
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
                <div className="flex gap-2">
                  {[15, 25, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setFocusMinutes(mins)}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
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
                <label className="block text-sm text-neutral-400 mb-2">Break Duration</label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setBreakMinutes(mins)}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                        breakMinutes === mins
                          ? 'bg-green-500 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {mins}m
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

      {/* AI Tutor Panel */}
      {showAITutor && (
        <SoloStudyAITutor onClose={() => setShowAITutor(false)} />
      )}

      {/* Flashcard Panel */}
      {showFlashcards && (
        <FlashcardPanel
          onClose={() => setShowFlashcards(false)}
          onOpenFullScreen={(deckId) => {
            setShowFlashcards(false)
            setFlashcardFullScreen({ deckId, title: 'Flashcards' })
          }}
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
