'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  createdAt: string
  updatedAt: string
}

export function useTimerSync(sessionId: string) {
  const [timer, setTimer] = useState<Timer | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchTimerRef = useRef<(() => Promise<void>) | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!sessionId) return

    let pollingInterval: NodeJS.Timeout | null = null

    // Fetch timer from API
    const fetchTimer = async () => {
      try {
        const res = await fetch(`/api/study-sessions/${sessionId}/timer`, {
          cache: 'no-store',
        })
        const data = await res.json()

        if (data.success && data.timer) {
          setTimer(data.timer)
        } else {
          setTimer(null)
        }
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }

    // Store ref for external calls
    fetchTimerRef.current = fetchTimer

    // Initial fetch
    fetchTimer()

    // Set up polling as fallback (every 2 seconds)
    pollingInterval = setInterval(() => {
      fetchTimer()
    }, 2000)

    // Subscribe to real-time updates on SessionTimer table
    const channel = supabase
      .channel(`session-${sessionId}-timer`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'SessionTimer',
          filter: `sessionId=eq.${sessionId}`,
        },
        () => {
          // Refetch timer when any change occurs
          fetchTimer()
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase])

  // Expose refetch function for manual updates
  const refetch = () => {
    if (fetchTimerRef.current) {
      fetchTimerRef.current()
    }
  }

  return { timer, setTimer, loading, refetch }
}
