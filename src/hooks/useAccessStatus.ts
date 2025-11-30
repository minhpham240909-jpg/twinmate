/**
 * Hook to check user's access status (banned/deactivated)
 * Automatically fetches status on mount and provides UI-ready data
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'

export interface BanInfo {
  isBanned: boolean
  banType?: 'TEMPORARY' | 'PERMANENT'
  expiresAt?: string
  reason?: string
  bannedAt?: string
}

export interface AccessStatus {
  canAccess: boolean
  reason?: string
  banStatus?: BanInfo
  isDeactivated?: boolean
  isLoading: boolean
  error?: string
  refetch: () => Promise<void>
}

export function useAccessStatus(): AccessStatus {
  const { user } = useAuth()
  const [status, setStatus] = useState<Omit<AccessStatus, 'refetch' | 'isLoading'>>({
    canAccess: true,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus({ canAccess: true })
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/user/access-status')

      if (!response.ok) {
        throw new Error('Failed to fetch access status')
      }

      const data = await response.json()
      setStatus({
        canAccess: data.canAccess,
        reason: data.reason,
        banStatus: data.banStatus,
        isDeactivated: data.isDeactivated,
      })
      setError(undefined)
    } catch (err) {
      console.error('[useAccessStatus] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Default to allowing access on error to not block legitimate users
      setStatus({ canAccess: true })
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
    ...status,
    isLoading,
    error,
    refetch: fetchStatus,
  }
}

/**
 * Format ban expiration for display
 */
export function formatBanExpiration(expiresAt?: string): string {
  if (!expiresAt) return 'permanently'

  const date = new Date(expiresAt)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs <= 0) return 'expired'

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'in 1 day'
  if (diffDays < 7) return `in ${diffDays} days`
  if (diffDays < 30) return `in ${Math.ceil(diffDays / 7)} weeks`

  return `until ${date.toLocaleDateString()}`
}
