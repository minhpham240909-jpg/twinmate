'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface BackgroundSessionContextType {
  activeSessionId: string | null
  setActiveSessionId: (sessionId: string | null) => void
  isOnline: boolean
}

const BackgroundSessionContext = createContext<BackgroundSessionContextType | undefined>(undefined)

export function BackgroundSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Sync with localStorage
  useEffect(() => {
    const storedSessionId = localStorage.getItem('activeSessionId')
    if (storedSessionId) {
      setActiveSessionIdState(storedSessionId)
    }

    // Listen for storage changes
    const handleStorageChange = () => {
      const sessionId = localStorage.getItem('activeSessionId')
      setActiveSessionIdState(sessionId)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Set active session and sync to localStorage
  const setActiveSessionId = (sessionId: string | null) => {
    setActiveSessionIdState(sessionId)
    if (sessionId) {
      localStorage.setItem('activeSessionId', sessionId)
    } else {
      localStorage.removeItem('activeSessionId')
    }
  }

  // Maintain Supabase presence in background
  useEffect(() => {
    if (!activeSessionId) {
      // Cleanup if no active session
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setIsOnline(false)
      return
    }

    // Get user from localStorage or session
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id
    }

    getUserId().then((userId) => {
      if (!userId) return

      const channel = supabase.channel(`session-${activeSessionId}-presence-bg`, {
        config: {
          presence: {
            key: activeSessionId,
          },
        },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const isUserOnline = Object.values(state).some((presences) =>
            presences.some((p) => {
              const presence = p as unknown as { user_id?: string }
              return presence.user_id === userId
            })
          )
          setIsOnline(isUserOnline)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: userId,
              online_at: new Date().toISOString(),
            })
            setIsOnline(true)
          }
        })

      channelRef.current = channel
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeSessionId, supabase])

  // Keep timer synced in background by polling the API
  useEffect(() => {
    if (!activeSessionId) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    // Poll timer API to keep it synced
    const pollTimer = async () => {
      try {
        await fetch(`/api/study-sessions/${activeSessionId}/timer`, {
          cache: 'no-store',
        })
      } catch (error) {
        console.error('Background timer sync error:', error)
      }
    }

    // Poll every 2 seconds
    timerIntervalRef.current = setInterval(pollTimer, 2000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [activeSessionId])

  return (
    <BackgroundSessionContext.Provider value={{ activeSessionId, setActiveSessionId, isOnline }}>
      {children}
    </BackgroundSessionContext.Provider>
  )
}

export function useBackgroundSession() {
  const context = useContext(BackgroundSessionContext)
  if (context === undefined) {
    throw new Error('useBackgroundSession must be used within a BackgroundSessionProvider')
  }
  return context
}
