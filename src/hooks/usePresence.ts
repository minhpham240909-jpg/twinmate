'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useNetwork } from '@/contexts/NetworkContext'

// OPTIMIZATION: Adaptive heartbeat intervals
// Active users get faster updates, idle users reduce database writes
const HEARTBEAT_INTERVAL_ACTIVE = 30000 // 30 seconds when active
const HEARTBEAT_INTERVAL_IDLE = 60000 // 60 seconds when idle
const IDLE_THRESHOLD = 60000 // Consider idle after 1 minute of no activity
const DEVICE_ID_KEY = 'clerva_device_id'
const MAX_RETRY_ATTEMPTS = 3
const INITIAL_RETRY_DELAY = 2000 // 2 seconds

export interface PresenceStatus {
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
}

export function usePresence() {
  const { user, loading } = useAuth()
  const { isOnline, wasOffline } = useNetwork()
  const [isInitialized, setIsInitialized] = useState(false)
  const deviceIdRef = useRef<string | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Track user activity for adaptive heartbeat
  const lastActivityRef = useRef<number>(Date.now())
  const isIdleRef = useRef<boolean>(false)

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

  // Send heartbeat to server with retry logic (memoized to prevent unnecessary re-renders)
  const sendHeartbeat = useCallback(async (isRetry = false) => {
    // Don't send heartbeat if offline
    if (!isOnline) {
      console.log('[HEARTBEAT] Skipping - offline')
      return
    }

    // Only send heartbeat if user is authenticated
    if (!deviceIdRef.current || !user) return

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
        
        // Retry with exponential backoff if not already retrying
        if (!isRetry && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          retryCountRef.current += 1
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
          console.log(`[HEARTBEAT] Scheduling retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS} in ${retryDelay}ms`)
          
          retryTimeoutRef.current = setTimeout(() => {
            sendHeartbeat(true)
          }, retryDelay)
        }
      } else {
        // Success - reset retry count
        retryCountRef.current = 0
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }
      }
    } catch (error) {
      console.error('[HEARTBEAT] Error:', error)
      
      // Retry with exponential backoff if not already retrying
      if (!isRetry && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current += 1
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
        console.log(`[HEARTBEAT] Scheduling retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS} in ${retryDelay}ms`)
        
        retryTimeoutRef.current = setTimeout(() => {
          sendHeartbeat(true)
        }, retryDelay)
      } else if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        console.error('[HEARTBEAT] Max retries reached, giving up')
      }
    }
  }, [user, isOnline])

  // Disconnect device session (memoized to prevent unnecessary re-renders)
  const disconnect = useCallback(async () => {
    // Only disconnect if user is authenticated and device ID exists
    if (!deviceIdRef.current || !user) return

    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    try {
      // Use fetch with keepalive for reliable disconnect (works better than sendBeacon for JSON)
      await fetch('/api/presence/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceIdRef.current,
        }),
        keepalive: true, // Keep request alive even after page unload
      })
    } catch (error) {
      // Silently fail - disconnect is best-effort
      // Errors are expected if page is unloading
    }
  }, [user])

  // Get current heartbeat interval based on activity state
  const getHeartbeatInterval = useCallback(() => {
    const now = Date.now()
    const timeSinceActivity = now - lastActivityRef.current
    const isIdle = timeSinceActivity > IDLE_THRESHOLD
    
    if (isIdle !== isIdleRef.current) {
      isIdleRef.current = isIdle
      console.log(`[HEARTBEAT] User is now ${isIdle ? 'idle' : 'active'}, adjusting interval`)
    }
    
    return isIdle ? HEARTBEAT_INTERVAL_IDLE : HEARTBEAT_INTERVAL_ACTIVE
  }, [])

  // Track user activity for adaptive heartbeat
  useEffect(() => {
    if (!isInitialized || !user) return

    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Track various user interactions
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity)
      })
    }
  }, [isInitialized, user])

  // Start heartbeat interval (only when user is authenticated and online)
  // Uses adaptive interval based on user activity
  useEffect(() => {
    if (!isInitialized || loading) return
    if (!user) {
      // User logged out - clear any existing interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Don't start heartbeat if offline
    if (!isOnline) {
      console.log('[HEARTBEAT] User offline, pausing heartbeat')
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Set up adaptive interval - re-evaluate interval on each tick
    const scheduleNextHeartbeat = () => {
      const interval = getHeartbeatInterval()
      heartbeatIntervalRef.current = setTimeout(() => {
        sendHeartbeat()
        scheduleNextHeartbeat() // Schedule next with potentially different interval
      }, interval)
    }
    
    scheduleNextHeartbeat()

    // Cleanup on unmount or when user logs out
    return () => {
      if (heartbeatIntervalRef.current) {
        clearTimeout(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // Disconnect when component unmounts or user logs out
      if (user) {
        disconnect()
      }
    }
  }, [isInitialized, user, loading, isOnline, sendHeartbeat, disconnect, getHeartbeatInterval])

  // Handle network recovery - send immediate heartbeat when coming back online
  useEffect(() => {
    if (!isInitialized || !user) return

    if (wasOffline && isOnline) {
      console.log('[HEARTBEAT] Network restored, sending immediate heartbeat')
      // Reset retry count on network recovery
      retryCountRef.current = 0
      sendHeartbeat()
    }
  }, [isInitialized, user, wasOffline, isOnline, sendHeartbeat])

  // Handle page visibility changes (tab focus/blur)
  useEffect(() => {
    if (!isInitialized || !user || !isOnline) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && isOnline) {
        // Tab became visible - send immediate heartbeat
        sendHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isInitialized, user, isOnline, sendHeartbeat])

  // Handle beforeunload (browser close)
  useEffect(() => {
    if (!isInitialized || !user) return

    const handleBeforeUnload = () => {
      if (user) {
        disconnect()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isInitialized, user, disconnect])

  return {
    isInitialized,
    sendHeartbeat,
    disconnect,
  }
}
