'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Coffee, Clock, Zap } from 'lucide-react'

// Timer state type exported for use in parent components
export type TimerState = 'idle' | 'study' | 'break' | 'paused'

// Interface for persisted timer data
interface PersistedTimerState {
  timerState: TimerState
  timeRemaining: number
  cycle: number
  totalStudyTime: number
  lastUpdatedAt: number // Timestamp when state was saved
  sessionId: string
}

interface AIPartnerSessionTimerProps {
  sessionStartedAt: Date | string
  sessionId: string // Required for persisting timer state per session
  onTimerComplete?: (isBreak: boolean) => void
  onStudyTimerComplete?: () => void // Callback when study timer ends (for showing feedback modal)
  onFocusTimeUpdate?: (focusTime: number) => void // Callback to report focus time in seconds
  onTimerStateChange?: (state: TimerState) => void // Callback when timer state changes
  externalStartTrigger?: number // Increment to trigger timer start externally
}

// Storage key for timer persistence
const getStorageKey = (sessionId: string) => `ai-timer-state-${sessionId}`

export default function AIPartnerSessionTimer({
  sessionStartedAt,
  sessionId,
  onTimerComplete,
  onStudyTimerComplete,
  onFocusTimeUpdate,
  onTimerStateChange,
  externalStartTrigger,
}: AIPartnerSessionTimerProps) {
  // Pomodoro settings (in seconds)
  const STUDY_DURATION = 25 * 60 // 25 minutes
  const BREAK_DURATION = 5 * 60 // 5 minutes

  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [timeRemaining, setTimeRemaining] = useState(STUDY_DURATION)
  const [cycle, setCycle] = useState(1)
  const [totalStudyTime, setTotalStudyTime] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const hasRestoredRef = useRef(false)

  // Restore timer state from localStorage on mount
  useEffect(() => {
    if (hasRestoredRef.current || !sessionId) return
    hasRestoredRef.current = true

    try {
      const storageKey = getStorageKey(sessionId)
      const savedState = localStorage.getItem(storageKey)

      if (savedState) {
        const parsed: PersistedTimerState = JSON.parse(savedState)

        // Only restore if it's for the same session
        if (parsed.sessionId === sessionId) {
          const now = Date.now()
          const elapsedSinceLastUpdate = Math.floor((now - parsed.lastUpdatedAt) / 1000)

          // If timer was running (study or break), calculate time elapsed while away
          if (parsed.timerState === 'study' || parsed.timerState === 'break') {
            let newTimeRemaining = parsed.timeRemaining - elapsedSinceLastUpdate
            let newTimerState = parsed.timerState
            let newCycle = parsed.cycle
            let additionalStudyTime = 0

            // Handle timer completion while away
            while (newTimeRemaining <= 0) {
              if (newTimerState === 'study') {
                // Study timer completed - track the remaining study time
                additionalStudyTime += parsed.timeRemaining
                newTimerState = 'break'
                newTimeRemaining += BREAK_DURATION
              } else {
                // Break completed
                newTimerState = 'study'
                newCycle += 1
                newTimeRemaining += STUDY_DURATION
              }
            }

            // If was studying, add elapsed time to total study time
            if (parsed.timerState === 'study' && newTimerState !== 'study') {
              additionalStudyTime = parsed.timeRemaining // Full study duration completed
            } else if (parsed.timerState === 'study' && newTimerState === 'study') {
              additionalStudyTime = elapsedSinceLastUpdate // Partial time
            }

            setTimerState(newTimerState)
            setTimeRemaining(Math.max(0, newTimeRemaining))
            setCycle(newCycle)
            setTotalStudyTime(parsed.totalStudyTime + additionalStudyTime)
          } else {
            // Timer was paused or idle - restore exactly as saved
            setTimerState(parsed.timerState)
            setTimeRemaining(parsed.timeRemaining)
            setCycle(parsed.cycle)
            setTotalStudyTime(parsed.totalStudyTime)
          }
        }
      }
    } catch (error) {
      console.error('[Timer] Failed to restore state:', error)
    }

    setIsInitialized(true)
  }, [sessionId, STUDY_DURATION, BREAK_DURATION])

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized || !sessionId) return

    const stateToSave: PersistedTimerState = {
      timerState,
      timeRemaining,
      cycle,
      totalStudyTime,
      lastUpdatedAt: Date.now(),
      sessionId,
    }

    try {
      const storageKey = getStorageKey(sessionId)
      localStorage.setItem(storageKey, JSON.stringify(stateToSave))
    } catch (error) {
      console.error('[Timer] Failed to save state:', error)
    }
  }, [timerState, timeRemaining, cycle, totalStudyTime, sessionId, isInitialized])

  // Clean up old timer states (keep only last 10 sessions)
  useEffect(() => {
    if (!isInitialized) return

    try {
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('ai-timer-state-'))
      if (allKeys.length > 10) {
        // Sort by last updated and remove oldest
        const states = allKeys.map(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            return { key, lastUpdatedAt: data.lastUpdatedAt || 0 }
          } catch {
            return { key, lastUpdatedAt: 0 }
          }
        }).sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)

        // Remove oldest entries beyond 10
        states.slice(10).forEach(({ key }) => localStorage.removeItem(key))
      }
    } catch {
      // Ignore cleanup errors
    }
  }, [isInitialized])

  // Notify parent when timer state changes
  useEffect(() => {
    onTimerStateChange?.(timerState)
  }, [timerState, onTimerStateChange])

  // Handle external trigger to start timer (from parent component)
  useEffect(() => {
    if (externalStartTrigger && externalStartTrigger > 0 && timerState === 'idle') {
      setTimerState('study')
      setTimeRemaining(STUDY_DURATION)
    }
  }, [externalStartTrigger, timerState, STUDY_DURATION])

  // Calculate session duration
  const [sessionDuration, setSessionDuration] = useState(0)

  useEffect(() => {
    const startTime = new Date(sessionStartedAt).getTime()
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionStartedAt])

  // Timer countdown
  useEffect(() => {
    if (timerState !== 'study' && timerState !== 'break') return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer complete
          if (timerState === 'study') {
            setTimerState('break')
            onTimerComplete?.(false)
            // Call onStudyTimerComplete to show feedback modal
            onStudyTimerComplete?.()
            return BREAK_DURATION
          } else {
            setTimerState('study')
            setCycle((c) => c + 1)
            onTimerComplete?.(true)
            return STUDY_DURATION
          }
        }

        // Track study time (only when timer is in 'study' state, not break)
        if (timerState === 'study') {
          setTotalStudyTime((t) => {
            const newTime = t + 1
            // Report focus time to parent - this is the key metric for analytics
            onFocusTimeUpdate?.(newTime)
            return newTime
          })
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerState, onTimerComplete, onStudyTimerComplete, onFocusTimeUpdate, STUDY_DURATION, BREAK_DURATION])

  const startTimer = useCallback(() => {
    setTimerState('study')
    if (timeRemaining === STUDY_DURATION || timeRemaining === BREAK_DURATION) {
      setTimeRemaining(STUDY_DURATION)
    }
  }, [timeRemaining, STUDY_DURATION, BREAK_DURATION])

  const pauseTimer = useCallback(() => {
    setTimerState('paused')
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  // Calculate progress percentage
  const maxTime = timerState === 'break' ? BREAK_DURATION : STUDY_DURATION
  const progress = ((maxTime - timeRemaining) / maxTime) * 100

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Pomodoro Timer
        </h3>
        <span className="text-xs text-slate-500">Cycle {cycle}</span>
      </div>

      {/* Timer Display */}
      <div className="relative mb-4">
        {/* Progress Ring */}
        <div className="relative w-32 h-32 mx-auto">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-700"
            />
            {/* Progress circle */}
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="url(#timerGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={352}
              strokeDashoffset={352 - (352 * progress) / 100}
              initial={false}
              animate={{ strokeDashoffset: 352 - (352 * progress) / 100 }}
              transition={{ duration: 0.5 }}
            />
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={timerState === 'break' ? '#10b981' : '#3b82f6'} />
                <stop offset="100%" stopColor={timerState === 'break' ? '#34d399' : '#8b5cf6'} />
              </linearGradient>
            </defs>
          </svg>

          {/* Time Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white tabular-nums">
              {formatTime(timeRemaining)}
            </span>
            <span
              className={`text-xs font-medium ${
                timerState === 'break' ? 'text-green-400' : 'text-blue-400'
              }`}
            >
              {timerState === 'break' ? (
                <span className="flex items-center gap-1">
                  <Coffee className="w-3 h-3" /> Break
                </span>
              ) : timerState === 'study' ? (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Focus
                </span>
              ) : (
                'Ready'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {timerState === 'idle' || timerState === 'paused' ? (
          <button
            onClick={startTimer}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors"
          >
            <Play className="w-4 h-4" />
            {timerState === 'paused' ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button
            onClick={pauseTimer}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition-colors"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-slate-900/50 rounded-lg p-2">
          <p className="text-xs text-slate-500">Session Time</p>
          <p className="text-sm font-medium text-white">
            {formatDuration(sessionDuration)}
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2">
          <p className="text-xs text-slate-500">Focus Time</p>
          <p className="text-sm font-medium text-green-400">
            {formatDuration(totalStudyTime)}
          </p>
        </div>
      </div>
    </div>
  )
}
