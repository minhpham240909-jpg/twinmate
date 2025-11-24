'use client'

import { useEffect, useState, useRef } from 'react'

const MAX_RETRY_ATTEMPTS = 3
const INITIAL_RETRY_DELAY = 2000 // 2 seconds

export interface PartnerPresence {
  userId: string
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
  isPrivate: boolean
}

export function usePartnerPresence(partnerIds: string[]) {
  const [presences, setPresences] = useState<Record<string, PartnerPresence>>({})
  const [isLoading, setIsLoading] = useState(true)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch and poll for presence data
  useEffect(() => {
    if (partnerIds.length === 0) {
      setIsLoading(false)
      return
    }

    const fetchPresences = async (isRetry = false) => {
      try {
        const response = await fetch('/api/presence/online-partners')

        if (!response.ok) {
          console.error('[FETCH PRESENCES] HTTP error:', response.status, response.statusText)

          // Retry with exponential backoff if not already retrying
          if (!isRetry && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
            retryCountRef.current += 1
            const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
            console.log(`[FETCH PRESENCES] Scheduling retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS} in ${retryDelay}ms`)

            retryTimeoutRef.current = setTimeout(() => {
              fetchPresences(true)
            }, retryDelay)
          }
          return
        }

        const data = await response.json()

        if (data.success) {
          setPresences(data.presences)
          // Success - reset retry count
          retryCountRef.current = 0
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
            retryTimeoutRef.current = null
          }
        }
      } catch (error) {
        console.error('[FETCH PRESENCES] Error:', error)

        // Retry with exponential backoff if not already retrying
        if (!isRetry && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          retryCountRef.current += 1
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1)
          console.log(`[FETCH PRESENCES] Scheduling retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS} in ${retryDelay}ms`)

          retryTimeoutRef.current = setTimeout(() => {
            fetchPresences(true)
          }, retryDelay)
        } else if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
          console.error('[FETCH PRESENCES] Max retries reached, giving up')
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Fetch immediately
    fetchPresences()

    // Poll every 15 seconds for updates (matches heartbeat interval for real-time presence)
    const interval = setInterval(() => fetchPresences(), 15000)

    return () => {
      clearInterval(interval)
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [partnerIds.join(',')])

  return {
    presences,
    isLoading,
  }
}
