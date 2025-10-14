'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import TimerSettings from './TimerSettings'
import { useTimerSync } from '@/hooks/useTimerSync'

interface Timer {
  id: string
  sessionId: string
  studyDuration: number
  breakDuration: number
  state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'BREAK' | 'BREAK_PAUSED'
  timeRemaining: number
  currentCycle: number
  isBreakTime: boolean
  totalStudyTime: number
  totalBreakTime: number
  lastStartedAt?: Date | string | null
  lastPausedAt?: Date | string | null
}

interface SessionTimerProps {
  sessionId: string
  isHost: boolean
  size?: 'small' | 'large'
  displayOnly?: boolean // If true, only show timer display without controls
}

export default function SessionTimer({
  sessionId,
  isHost,
  size = 'large',
  displayOnly = false,
}: SessionTimerProps) {
  // Use real-time sync hook
  const { timer: syncedTimer, loading, refetch } = useTimerSync(sessionId)
  const [timer, setTimer] = useState<Timer | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showBreakOptions, setShowBreakOptions] = useState(false)
  const [showStudyOptions, setShowStudyOptions] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const alertSoundRef = useRef<HTMLAudioElement | null>(null)

  // Sync timer state from real-time hook
  useEffect(() => {
    if (syncedTimer) {
      setTimer(syncedTimer)
    } else {
      setTimer(null)
    }
  }, [syncedTimer])

  // Load alert sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      alertSoundRef.current = new Audio('/sounds/timer-complete.mp3')
      alertSoundRef.current.volume = 0.5
    }
  }, [])

  // Countdown logic
  useEffect(() => {
    if (!timer) return

    if (timer.state === 'RUNNING' || timer.state === 'BREAK') {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (!prev) return prev

          const newTimeRemaining = prev.timeRemaining - 1

          // Timer reached zero
          if (newTimeRemaining <= 0) {
            handleTimerComplete(prev.isBreakTime)
            return prev
          }

          // Update server every 5 seconds
          if (newTimeRemaining % 5 === 0) {
            updateTimeRemaining(newTimeRemaining)
          }

          return {
            ...prev,
            timeRemaining: newTimeRemaining,
          }
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [timer?.state])

  const updateTimeRemaining = async (timeRemaining: number) => {
    try {
      await fetch(`/api/study-sessions/${sessionId}/timer/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_time',
          timeRemaining,
        }),
      })
    } catch (error) {
      console.error('Error updating time:', error)
    }
  }

  const handleTimerComplete = (wasBreakTime: boolean) => {
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      // Play alert sound
      if (alertSoundRef.current) {
        alertSoundRef.current.play().catch((e) => console.error('Sound error:', e))
      }

      // Show notification
      if (wasBreakTime) {
        toast('Break over! Ready to study?', {
          icon: '🎯',
          duration: 6000,
        })
        setShowStudyOptions(true)
      } else {
        toast('Study session complete! Time for a break!', {
          icon: '🎉',
          duration: 6000,
        })
        setShowBreakOptions(true)
      }

      // Pause the timer
      controlTimer('pause')
    }, 0)
  }

  const handleSaveSettings = async (
    studyDuration: number,
    breakDuration: number
  ) => {
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyDuration, breakDuration }),
      })

      const data = await res.json()

      if (data.success) {
        setTimer(data.timer)
        setShowSettings(false)
        toast.success('Timer settings saved!')
        // Immediately refetch to sync all components
        refetch()
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const controlTimer = async (
    action: string,
    additionalData?: Record<string, unknown>
  ) => {
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/timer/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...additionalData }),
      })

      const data = await res.json()

      if (data.success) {
        setTimer(data.timer)
        // Immediately refetch to sync all components
        refetch()
      } else {
        toast.error(data.error || 'Failed to control timer')
      }
    } catch (error) {
      console.error('Error controlling timer:', error)
      toast.error('Failed to control timer')
    }
  }

  const handleStartBreak = () => {
    controlTimer('start_break')
    setShowBreakOptions(false)
  }

  const handleSkipBreak = () => {
    controlTimer('skip')
    setShowBreakOptions(false)
  }

  const handleSameSettings = () => {
    controlTimer('end_break', { sameSettings: true })
    setShowStudyOptions(false)
  }

  const handleNewSettings = () => {
    controlTimer('end_break', { sameSettings: false })
    setShowStudyOptions(false)
    setShowSettings(true)
  }

  const handleDeleteTimer = async () => {
    if (!confirm('Are you sure you want to delete this timer? This will remove all timer settings and you can create a new one.')) {
      return
    }

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/timer`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        setTimer(null)
        toast.success('Timer deleted successfully!')
        // Immediately refetch to sync all components
        refetch()
      } else {
        toast.error(data.error || 'Failed to delete timer')
      }
    } catch (error) {
      console.error('Error deleting timer:', error)
      toast.error('Failed to delete timer')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const isSmall = size === 'small'

  if (loading) {
    return (
      <div className="text-center text-gray-500">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      </div>
    )
  }

  if (!timer) {
    return (
      <div className="text-center">
        {displayOnly ? (
          // Display-only mode: just show waiting message
          <p className={`${isSmall ? 'text-sm' : ''} text-gray-500`}>
            Waiting for timer...
          </p>
        ) : isHost ? (
          // Host can set up timer
          <button
            onClick={() => setShowSettings(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Set Up Timer
          </button>
        ) : (
          // Non-host participants wait
          <p className="text-gray-500">
            Waiting for host to set up timer...
          </p>
        )}
        {showSettings && !displayOnly && (
          <TimerSettings
            onSave={handleSaveSettings}
            onCancel={() => setShowSettings(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={isSmall ? 'space-y-3' : 'space-y-4'}>
      {/* Timer Display */}
      <div className={isSmall ? '' : 'text-center'}>
        <div
          className={`font-mono font-bold ${
            isSmall ? 'text-2xl' : 'text-6xl'
          } ${timer.isBreakTime ? 'text-green-600' : 'text-blue-600'}`}
        >
          {formatTime(timer.timeRemaining)}
        </div>
        <div className={`${isSmall ? 'mt-2' : 'mt-2'} text-sm text-gray-600`}>
          {timer.isBreakTime ? (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
              Break {Math.ceil(timer.currentCycle / 2)}
            </span>
          ) : (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
              Study Session {timer.currentCycle}
            </span>
          )}
        </div>
        {/* Show stats for small/display-only mode */}
        {isSmall && displayOnly && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total Study:</span>
              <span className="font-semibold text-blue-600">
                {Math.floor(timer.totalStudyTime / 60)} min
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Break:</span>
              <span className="font-semibold text-green-600">
                {Math.floor(timer.totalBreakTime / 60)} min
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {!isSmall && !displayOnly && (
        <div className="flex items-center justify-center gap-3">
          {timer.state === 'IDLE' && (
            <button
              onClick={() => controlTimer('start')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Start
            </button>
          )}

          {(timer.state === 'RUNNING' || timer.state === 'BREAK') && (
            <button
              onClick={() => controlTimer('pause')}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
              Pause
            </button>
          )}

          {(timer.state === 'PAUSED' || timer.state === 'BREAK_PAUSED') && (
            <button
              onClick={() => controlTimer('resume')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Resume
            </button>
          )}

          <button
            onClick={() => controlTimer('reset')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                clipRule="evenodd"
              />
            </svg>
            Reset
          </button>

          <button
            onClick={() => controlTimer('stop')}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z" />
            </svg>
            Stop
          </button>

          {isHost && (
            <>
              <button
                onClick={() => setShowSettings(true)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.992 6.992 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
                Settings
              </button>
              <button
                onClick={handleDeleteTimer}
                className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
                Delete Timer
              </button>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      {!isSmall && !displayOnly && (
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Total Study:</span>
            <span className="font-semibold">
              {Math.floor(timer.totalStudyTime / 60)} min
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Total Break:</span>
            <span className="font-semibold">
              {Math.floor(timer.totalBreakTime / 60)} min
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSettings && !displayOnly && (
        <TimerSettings
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
          initialStudyDuration={timer.studyDuration}
          initialBreakDuration={timer.breakDuration}
        />
      )}

      {/* Break Options Modal */}
      {showBreakOptions && !displayOnly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Study Session Complete!
            </h3>
            <p className="text-gray-600 mb-6">
              Great job! What would you like to do next?
            </p>
            <div className="space-y-3">
              <button
                onClick={handleStartBreak}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Start {timer.breakDuration} min Break
              </button>
              <button
                onClick={handleSkipBreak}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Skip Break → New Study Session
              </button>
              <button
                onClick={() => {
                  controlTimer('stop')
                  setShowBreakOptions(false)
                }}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                End Timer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Study Options Modal */}
      {showStudyOptions && !displayOnly && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Break Over!
            </h3>
            <p className="text-gray-600 mb-6">
              Ready to continue? Choose your next session settings.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleSameSettings}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Same Settings ({timer.studyDuration}/{timer.breakDuration} min)
              </button>
              <button
                onClick={handleNewSettings}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                New Settings
              </button>
              <button
                onClick={() => {
                  controlTimer('stop')
                  setShowStudyOptions(false)
                }}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                End Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
