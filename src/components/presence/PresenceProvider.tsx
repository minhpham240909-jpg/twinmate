'use client'

import { usePresence } from '@/hooks/usePresence'

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  // Automatically start heartbeat when component mounts
  usePresence()

  return <>{children}</>
}
