'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useNetwork } from '@/contexts/NetworkContext'

// OPTIMIZATION: Adaptive heartbeat intervals for 3,000+ concurrent users
// Reduced frequency to minimize server load while maintaining presence accuracy
const HEARTBEAT_INTERVAL_ACTIVE = 45000 // 45 seconds when active (was 30s)
const HEARTBEAT_INTERVAL_IDLE = 90000 // 90 seconds when idle (was 60s)
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
  
  // FIX: Track if heartbeat loop is active to prevent multiple loops
  const heartbeatLoopActiveRef = useRef<boolean>(false)
  // FIX: Track user ID to detect user changes
  const currentUserIdRef = useRef<string | null>(null)

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
  // FIX: Using refs for user check to avoid dependency changes causing loop restarts
  const sendHeartbeat = useCallback(async (isRetry = false) => {
    // Don't send heartbeat if offline
    if (!isOnline) {
      // Removed console.log - use logger instead
      return
    }

    // Only send heartbeat if user is authenticated
    if (!deviceIdRef.current || !currentUserIdRef.current) return

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
        // FIX: Use logger instead of console.error
        if (process.env.NODE_ENV === 'development') {
          console.error('[HEARTBEAT] Failed:', response.statusText)
        }
        
        // Retry with exponential backoff if not already retrying
        if (!isRetry && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          retryCountRef.current += 1
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
          
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
      // FIX: Use logger instead of console.error
      if (process.env.NODE_ENV === 'development') {
        console.error('[HEARTBEAT] Error:', error)
      }
      
      // Retry with exponential backoff if not already retrying
      if (!isRetry && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current += 1
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
        
        retryTimeoutRef.current = setTimeout(() => {
          sendHeartbeat(true)
        }, retryDelay)
      }
    }
  }, [isOnline]) // FIX: Removed user from dependencies to prevent loop restarts

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
      // FIX: Removed console.log
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

  // FIX: Update currentUserIdRef when user changes
  useEffect(() => {
    currentUserIdRef.current = user?.id || null
  }, [user?.id])

  // Start heartbeat interval (only when user is authenticated and online)
  // Uses adaptive interval based on user activity
  // FIX: Separated into stable effect that won't restart unnecessarily
  useEffect(() => {
    if (!isInitialized || loading) return
    if (!user) {
      // User logged out - clear any existing interval and stop loop
      heartbeatLoopActiveRef.current = false
      if (heartbeatIntervalRef.current) {
        clearTimeout(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Don't start heartbeat if offline
    if (!isOnline) {
      // FIX: Pause heartbeat but don't completely stop the loop flag
      if (heartbeatIntervalRef.current) {
        clearTimeout(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // FIX: Prevent multiple heartbeat loops from running simultaneously
    if (heartbeatLoopActiveRef.current) {
      return
    }

    heartbeatLoopActiveRef.current = true

    // Send initial heartbeat immediately
    sendHeartbeat()

    // FIX: Set up adaptive interval with proper loop tracking
    const scheduleNextHeartbeat = () => {
      // Check if loop should continue
      if (!heartbeatLoopActiveRef.current) return
      if (!currentUserIdRef.current) return
      
      const interval = getHeartbeatInterval()
      heartbeatIntervalRef.current = setTimeout(() => {
        // Double-check before sending
        if (!heartbeatLoopActiveRef.current || !currentUserIdRef.current) return
        
        sendHeartbeat()
        scheduleNextHeartbeat() // Schedule next with potentially different interval
      }, interval)
    }
    
    scheduleNextHeartbeat()

    // Cleanup on unmount or when user logs out
    return () => {
      heartbeatLoopActiveRef.current = false
      if (heartbeatIntervalRef.current) {
        clearTimeout(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // Disconnect when component unmounts or user logs out
      if (currentUserIdRef.current) {
        disconnect()
      }
    }
  // FIX: Minimized dependencies to prevent unnecessary restarts
  // Using user?.id instead of user object for stable reference
  }, [isInitialized, user?.id, loading, isOnline, sendHeartbeat, disconnect, getHeartbeatInterval])

  // Handle network recovery - send immediate heartbeat when coming back online
  useEffect(() => {
    if (!isInitialized || !user) return

    if (wasOffline && isOnline) {
      // FIX: Reset retry count on network recovery
      retryCountRef.current = 0
      sendHeartbeat()
      
      // FIX: Restart heartbeat loop if it was stopped
      if (!heartbeatLoopActiveRef.current && currentUserIdRef.current) {
        heartbeatLoopActiveRef.current = true
        const scheduleNextHeartbeat = () => {
          if (!heartbeatLoopActiveRef.current || !currentUserIdRef.current) return
          const interval = getHeartbeatInterval()
          heartbeatIntervalRef.current = setTimeout(() => {
            if (!heartbeatLoopActiveRef.current || !currentUserIdRef.current) return
            sendHeartbeat()
            scheduleNextHeartbeat()
          }, interval)
        }
        scheduleNextHeartbeat()
      }
    }
  }, [isInitialized, user, wasOffline, isOnline, sendHeartbeat, getHeartbeatInterval])

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
