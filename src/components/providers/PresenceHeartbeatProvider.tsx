'use client'

/**
 * Presence Heartbeat Provider
 *
 * Sends periodic heartbeats to track user presence.
 * Only active for authenticated users.
 */

import { ReactNode } from 'react'
import { useAuth } from '@/lib/auth/context'
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'

function PresenceHeartbeatInner() {
  const { user } = useAuth()

  // Only send heartbeats for authenticated users
  usePresenceHeartbeat(!!user)

  return null
}

interface PresenceHeartbeatProviderProps {
  children: ReactNode
}

export default function PresenceHeartbeatProvider({ children }: PresenceHeartbeatProviderProps) {
  return (
    <>
      <PresenceHeartbeatInner />
      {children}
    </>
  )
}
