'use client'

import { useEffect, useRef, useState } from 'react'

const HEARTBEAT_INTERVAL = 15000 // 15 seconds - faster offline detection
const DEVICE_ID_KEY = 'clerva_device_id'

export interface PresenceStatus {
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
}

export function usePresence() {
  const [isInitialized, setIsInitialized] = useState(false)
  const deviceIdRef = useRef<string | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize device ID (persists across page refreshes)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Generate UUID for device ID
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }

    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = generateUUID()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    deviceIdRef.current = deviceId
    setIsInitialized(true)
  }, [])

  // Send heartbeat to server
  const sendHeartbeat = async () => {
    if (!deviceIdRef.current) return

    try {
      const response = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceIdRef.current,
          userAgent: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        console.error('[HEARTBEAT] Failed:', response.statusText)
      }
    } catch (error) {
      console.error('[HEARTBEAT] Error:', error)
    }
  }

  // Disconnect device session
  const disconnect = async () => {
    if (!deviceIdRef.current) return

    try {
      await fetch('/api/presence/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceIdRef.current,
        }),
      })
    } catch (error) {
      console.error('[DISCONNECT] Error:', error)
    }
  }

  // Start heartbeat interval
  useEffect(() => {
    if (!isInitialized) return

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Set up interval for subsequent heartbeats
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      disconnect()
    }
  }, [isInitialized])

  // Handle page visibility changes (tab focus/blur)
  useEffect(() => {
    if (!isInitialized) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - send immediate heartbeat
        sendHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isInitialized])

  // Handle beforeunload (browser close)
  useEffect(() => {
    if (!isInitialized) return

    const handleBeforeUnload = () => {
      disconnect()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isInitialized])

  return {
    isInitialized,
    sendHeartbeat,
    disconnect,
  }
}
