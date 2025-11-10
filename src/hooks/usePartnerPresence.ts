'use client'

import { useEffect, useState } from 'react'

export interface PartnerPresence {
  userId: string
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
  isPrivate: boolean
}

export function usePartnerPresence(partnerIds: string[]) {
  const [presences, setPresences] = useState<Record<string, PartnerPresence>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Fetch and poll for presence data
  useEffect(() => {
    if (partnerIds.length === 0) {
      setIsLoading(false)
      return
    }

    const fetchPresences = async () => {
      try {
        const response = await fetch('/api/presence/online-partners')
        const data = await response.json()

        if (data.success) {
          setPresences(data.presences)
        }
      } catch (error) {
        console.error('[FETCH PRESENCES] Error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Fetch immediately
    fetchPresences()

    // Poll every 30 seconds for updates
    const interval = setInterval(fetchPresences, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [partnerIds.join(',')])

  return {
    presences,
    isLoading,
  }
}
