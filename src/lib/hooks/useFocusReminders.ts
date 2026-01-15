'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface FocusRemindersConfig {
  /** Whether the session is currently active */
  isSessionActive: boolean
  /** Whether the session is paused */
  isPaused: boolean
  /** Time remaining in seconds */
  timeRemaining: number
  /** Session ID for tracking */
  sessionId?: string | null
  /** Callback when user returns to the app */
  onReturn?: () => void
}

interface FocusRemindersState {
  /** Whether notification permission is granted */
  hasPermission: boolean
  /** Whether user has left the app during session */
  hasLeftDuringSession: boolean
  /** Time when user left (for tracking duration away) */
  leftAt: number | null
  /** Number of reminders sent this session */
  remindersSent: number
}

// Reminder configuration
const REMINDER_CONFIG = {
  // Time after leaving before first reminder (in ms)
  FIRST_REMINDER_DELAY: 2 * 60 * 1000, // 2 minutes
  // Maximum reminders per session
  MAX_REMINDERS: 2,
  // Minimum time remaining to send reminder (in seconds)
  MIN_TIME_FOR_REMINDER: 60, // 1 minute
}

/**
 * Hook for managing gentle focus session reminders
 * Sends browser notifications when user leaves the app during active session
 */
export function useFocusReminders({
  isSessionActive,
  isPaused,
  timeRemaining,
  sessionId,
  onReturn,
}: FocusRemindersConfig) {
  const [state, setState] = useState<FocusRemindersState>({
    hasPermission: false,
    hasLeftDuringSession: false,
    leftAt: null,
    remindersSent: 0,
  })

  const reminderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef(sessionId)

  // Update session ID ref
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setState(prev => ({
        ...prev,
        hasPermission: Notification.permission === 'granted',
      }))
    }
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      setState(prev => ({ ...prev, hasPermission: true }))
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      setState(prev => ({ ...prev, hasPermission: granted }))
      return granted
    }

    return false
  }, [])

  // Send a gentle reminder notification
  const sendReminder = useCallback((message: string, timeLeft?: string) => {
    if (!state.hasPermission || typeof window === 'undefined') return

    try {
      const notification = new Notification('Focus Session Active', {
        body: message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'focus-reminder',
        requireInteraction: false,
        silent: false,
        data: {
          sessionId: sessionIdRef.current,
          timeLeft,
        },
      })

      // Close notification after 10 seconds
      setTimeout(() => notification.close(), 10000)

      // Handle click - focus the window
      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      setState(prev => ({
        ...prev,
        remindersSent: prev.remindersSent + 1,
      }))
    } catch (error) {
      console.error('Failed to send notification:', error)
    }
  }, [state.hasPermission])

  // Format time remaining for display
  const formatTimeRemaining = useCallback((seconds: number): string => {
    if (seconds < 60) return 'less than a minute'
    const mins = Math.floor(seconds / 60)
    return `${mins} minute${mins !== 1 ? 's' : ''}`
  }, [])

  // Handle visibility change
  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === 'hidden'

      if (isHidden && isSessionActive && !isPaused) {
        // User left during active session
        setState(prev => ({
          ...prev,
          hasLeftDuringSession: true,
          leftAt: Date.now(),
        }))

        // Schedule gentle reminder (only if we haven't sent too many)
        if (state.remindersSent < REMINDER_CONFIG.MAX_REMINDERS &&
            timeRemaining > REMINDER_CONFIG.MIN_TIME_FOR_REMINDER) {
          reminderTimeoutRef.current = setTimeout(() => {
            const timeLeft = formatTimeRemaining(timeRemaining)
            sendReminder(
              `Your focus session is still running. ${timeLeft} remaining.`,
              timeLeft
            )
          }, REMINDER_CONFIG.FIRST_REMINDER_DELAY)
        }
      } else if (!isHidden && state.hasLeftDuringSession) {
        // User returned
        setState(prev => ({
          ...prev,
          hasLeftDuringSession: false,
          leftAt: null,
        }))

        // Clear pending reminder
        if (reminderTimeoutRef.current) {
          clearTimeout(reminderTimeoutRef.current)
          reminderTimeoutRef.current = null
        }

        // Notify callback
        onReturn?.()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current)
      }
    }
  }, [isSessionActive, isPaused, timeRemaining, state.hasLeftDuringSession, state.remindersSent, sendReminder, formatTimeRemaining, onReturn])

  // Reset reminders sent when session ends
  useEffect(() => {
    if (!isSessionActive) {
      setState(prev => ({
        ...prev,
        remindersSent: 0,
        hasLeftDuringSession: false,
        leftAt: null,
      }))

      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current)
        reminderTimeoutRef.current = null
      }
    }
  }, [isSessionActive])

  return {
    hasPermission: state.hasPermission,
    requestPermission,
    hasLeftDuringSession: state.hasLeftDuringSession,
    remindersSent: state.remindersSent,
  }
}
