'use client'

import { useQuery } from '@tanstack/react-query'

interface ActiveSession {
  id: string
  durationMinutes: number
  startedAt: string
  timeRemaining: number
  sessionType: 'solo_study' | 'quick_focus'
}

interface FocusStats {
  liveUsersCount: number
  todayCompletedCount: number
  userStreak: number
  userTodaySessions: number
  userTotalSessions: number
  userPercentile: number
  activeSession: ActiveSession | null
}

interface FocusStatsResponse {
  success: boolean
  stats: FocusStats
}

/**
 * React Query hook for focus stats (Quick Focus)
 * - Used by QuickFocusCard
 * - Caches data for 30 seconds
 * - Shows cached data immediately on navigation
 */
export function useFocusStats() {
  return useQuery<FocusStatsResponse>({
    queryKey: ['focusStats'],
    queryFn: async () => {
      const response = await fetch('/api/focus/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch focus stats')
      }
      return response.json()
    },
    // Cache for 30 seconds - live users count changes frequently
    staleTime: 30 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry once on failure
    retry: 1,
    // Refetch every 30 seconds in background when component is mounted
    refetchInterval: 30 * 1000,
  })
}

/**
 * Hook for live studying count only
 * Refetches more frequently
 */
export function useStudyingCount() {
  return useQuery<{ count: number }>({
    queryKey: ['studyingCount'],
    queryFn: async () => {
      const response = await fetch('/api/presence/studying-count')
      if (!response.ok) {
        throw new Error('Failed to fetch studying count')
      }
      return response.json()
    },
    // Cache for 15 seconds
    staleTime: 15 * 1000,
    gcTime: 60 * 1000,
    retry: 1,
    // Refetch every 15 seconds
    refetchInterval: 15 * 1000,
  })
}
