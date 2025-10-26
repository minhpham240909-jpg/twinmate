/**
 * Presence Heartbeat Hook
 * Automatically updates user's online status every 30 seconds
 */

'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export interface PresenceOptions {
  enabled?: boolean
  intervalMs?: number
  currentActivity?: 'idle' | 'studying' | 'in_session' | 'available'
}

export function usePresence(user: User | null, options: PresenceOptions = {}) {
  const {
    enabled = true,
    intervalMs = 30000, // 30 seconds
    currentActivity = 'available',
  } = options

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!user || !enabled) {
      // Clear interval if disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Update presence immediately
    updatePresence(user.id, currentActivity)

    // Set up interval for heartbeat
    intervalRef.current = setInterval(() => {
      updatePresence(user.id, currentActivity)
    }, intervalMs)

    // Set user offline when tab closes/refreshes
    const handleBeforeUnload = () => {
      setOffline(user.id)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      setOffline(user.id)
    }
  }, [user, enabled, intervalMs, currentActivity])

  async function updatePresence(userId: string, activity: string) {
    try {
      const { error } = await supabase.from('presence').upsert({
        user_id: userId,
        is_online: true,
        last_seen: new Date().toISOString(),
        current_activity: activity,
      })

      if (error) {
        console.error('Presence update error:', error)
      }
    } catch (err) {
      console.error('Presence update failed:', err)
    }
  }

  async function setOffline(userId: string) {
    try {
      await supabase.from('presence').upsert({
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Set offline failed:', err)
    }
  }

  return {
    updateActivity: (activity: string) => {
      if (user) {
        updatePresence(user.id, activity)
      }
    },
  }
}
