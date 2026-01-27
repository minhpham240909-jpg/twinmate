'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/context'

/**
 * Hook to trigger mission reminder notifications
 *
 * Called when:
 * 1. User logs in (first visit to dashboard)
 * 2. User returns to the app after being away
 *
 * The API handles rate limiting (max 1 notification per 4 hours)
 * so it's safe to call this multiple times.
 */
export function useMissionReminder() {
  const { user } = useAuth()
  const hasSentRef = useRef(false)
  const lastVisibilityChangeRef = useRef<number>(Date.now())

  useEffect(() => {
    // Only run for logged-in users
    if (!user) {
      hasSentRef.current = false
      return
    }

    // Send reminder on first visit
    if (!hasSentRef.current) {
      hasSentRef.current = true
      triggerMissionReminder()
    }

    // Handle visibility change (user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        const timeSinceLastChange = now - lastVisibilityChangeRef.current

        // Only trigger if user was away for at least 30 minutes
        // This prevents spam when user quickly switches tabs
        if (timeSinceLastChange > 30 * 60 * 1000) {
          triggerMissionReminder()
        }

        lastVisibilityChangeRef.current = now
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])
}

/**
 * Trigger the mission reminder API
 * This is fire-and-forget - we don't need to wait for the result
 */
async function triggerMissionReminder() {
  try {
    const url = '/api/push/mission-reminder'

    // Fire-and-forget request with keepalive to ensure it completes
    fetch(url, {
      method: 'POST',
      keepalive: true, // Ensures request completes even if page unloads
    }).catch(() => {
      // Silently ignore errors - mission reminder is non-critical
    })
  } catch {
    // Silently ignore - mission reminder is non-critical
  }
}

export default useMissionReminder
