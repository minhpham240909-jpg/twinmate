'use client'

/**
 * Presence Heartbeat Hook
 *
 * Sends periodic heartbeats to track user presence.
 * Used by the admin dashboard to show accurate online user counts.
 *
 * Heartbeat interval: 30 seconds (2-minute threshold on server)
 */

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

// Heartbeat every 30 seconds - server considers users online if heartbeat within 2 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000

// Generate or get device ID from localStorage
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr'

  const stored = localStorage.getItem('clerva_device_id')
  if (stored) return stored

  // Generate a simple unique ID
  const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  localStorage.setItem('clerva_device_id', newId)
  return newId
}

export function usePresenceHeartbeat(enabled: boolean = true) {
  const pathname = usePathname()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const lastHeartbeatRef = useRef<number>(0)

  const sendHeartbeat = useCallback(async () => {
    if (!isMountedRef.current || !enabled) return

    // Debounce - don't send more than once every 10 seconds
    const now = Date.now()
    if (now - lastHeartbeatRef.current < 10000) return
    lastHeartbeatRef.current = now

    try {
      await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          currentPage: pathname,
        }),
        // Don't wait forever for heartbeat
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // Silently ignore heartbeat errors - non-critical
    }
  }, [pathname, enabled])

  useEffect(() => {
    if (!enabled) return

    isMountedRef.current = true

    // Send initial heartbeat
    sendHeartbeat()

    // Set up interval
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    // Also send heartbeat on visibility change (when tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sendHeartbeat, enabled])

  return { sendHeartbeat }
}
