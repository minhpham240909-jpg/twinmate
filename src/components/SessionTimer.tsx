'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface SessionTimerProps {
  sessionId: string
  sessionStatus: string
  startedAt: string | null
  durationMinutes: number | null
  isHost: boolean
  onSessionUpdate: () => void
}

export default function SessionTimer({
  sessionId,
  sessionStatus,
  startedAt,
  durationMinutes,
  isHost,
  onSessionUpdate,
}: SessionTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sessionStatus !== 'ACTIVE' || !startedAt) {
      setElapsedSeconds((durationMinutes || 0) * 60)
      return
    }

    // Calculate initial elapsed time
    const start = new Date(startedAt).getTime()
    const now = Date.now()
    const initialElapsed = Math.floor((now - start) / 1000) + ((durationMinutes || 0) * 60)
    setElapsedSeconds(initialElapsed)

    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionStatus, startedAt, durationMinutes])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Session started! ⏱️')
        onSessionUpdate()
      } else {
        toast.error(data.error || 'Failed to start session')
      }
    } catch (error) {
      console.error('Error starting session:', error)
      toast.error('Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  const handlePause = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Session paused')
        onSessionUpdate()
      } else {
        toast.error(data.error || 'Failed to pause session')
      }
    } catch (error) {
      console.error('Error pausing session:', error)
      toast.error('Failed to pause session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl shadow-lg">
      <div className="text-center">
        <p className="text-sm mb-2 opacity-90">Session Timer</p>
        <p className="text-4xl font-bold mb-4 font-mono">{formatTime(elapsedSeconds)}</p>

        {isHost && sessionStatus !== 'COMPLETED' && (
          <div className="flex gap-2 justify-center">
            {sessionStatus === 'ACTIVE' ? (
              <button
                onClick={handlePause}
                disabled={loading}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50 font-semibold"
              >
                {loading ? 'Pausing...' : '⏸️ Pause'}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={loading}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50 font-semibold"
              >
                {loading ? 'Starting...' : '▶️ Start'}
              </button>
            )}
          </div>
        )}

        {!isHost && (
          <p className="text-sm opacity-75">
            {sessionStatus === 'ACTIVE' ? '🔴 Session in progress' : '⏸️ Session paused'}
          </p>
        )}
      </div>
    </div>
  )
}
