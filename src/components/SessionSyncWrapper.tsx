'use client'

import { useEffect } from 'react'
import { syncSessionToCookies } from '@/lib/auth/session-sync'

export default function SessionSyncWrapper() {
  useEffect(() => {
    // Sync session on mount
    syncSessionToCookies()
  }, [])

  return null
}
