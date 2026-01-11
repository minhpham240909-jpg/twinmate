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
    let realtimeWorking = false
    let isCleanedUp = false

    // Fetch timer from API
    const fetchTimer = async () => {
      if (isCleanedUp) return

      try {
        const res = await fetch(`/api/study-sessions/${sessionId}/timer`, {
          cache: 'no-store',
        })
        const data = await res.json()

        if (isCleanedUp) return

        if (data.success && data.timer) {
          setTimer(data.timer)
        } else {
          setTimer(null)
        }
      } catch (error) {
        // Silently handle errors
      } finally {
        if (!isCleanedUp) {
          setLoading(false)
        }
      }
    }

    // Store ref for external calls
    fetchTimerRef.current = fetchTimer

    // Initial fetch
    fetchTimer()

    // Start polling fallback function
    const startPollingFallback = () => {
      if (pollingInterval || isCleanedUp) return

      console.log('[Timer Sync] Starting polling fallback (realtime not working)')
      pollingInterval = setInterval(() => {
        if (!realtimeWorking && !isCleanedUp) {
          fetchTimer()
        }
      }, 10000) // Poll every 10 seconds as fallback (much slower than before)
    }

    // Stop polling when realtime works
    const stopPolling = () => {
      if (pollingInterval) {
        console.log('[Timer Sync] Stopping polling (realtime working)')
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

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
          if (isCleanedUp) return

          // Mark realtime as working and stop polling
          realtimeWorking = true
          stopPolling()

          // Refetch timer when any change occurs
          fetchTimer()
        }
      )
      .subscribe((status) => {
        if (isCleanedUp) return

        console.log('[Timer Sync] Subscription status:', status)

        if (status === 'SUBSCRIBED') {
          console.log('[Timer Sync] Realtime connected successfully')
          // Don't stop polling yet - wait for first realtime event to confirm it's working
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Timer Sync] Realtime failed, using polling fallback')
          realtimeWorking = false
          startPollingFallback()
        }
      })

    // Start polling fallback after 5 seconds if no realtime events received
    const fallbackTimeout = setTimeout(() => {
      if (!realtimeWorking && !isCleanedUp) {
        startPollingFallback()
      }
    }, 5000)

    // Cleanup
    return () => {
      isCleanedUp = true
      clearTimeout(fallbackTimeout)
      stopPolling()
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
