'use client'

import { useQuery } from '@tanstack/react-query'

interface StudyTime {
  today: string
  thisWeek: string
  allTime: string
  todayMinutes: number
  weekMinutes: number
  allTimeMinutes: number
}

interface SessionCount {
  today: number
  thisWeek: number
  allTime: number
}

interface ModeStats {
  streak: number
  studyTime: StudyTime
  sessions: SessionCount
}

interface UserStats {
  streak: {
    current: number
    longest: number
  }
  soloStudyStreak: number
  quickFocusStreak: number
  studyTime: StudyTime
  sessions: SessionCount
  soloStudy: ModeStats
  quickFocus: ModeStats
  points: number
  coins: number
  memberSince: string
}

interface UserStatsResponse {
  success: boolean
  stats: UserStats
}

/**
 * React Query hook for user stats
 * - Caches data for 5 minutes (staleTime)
 * - Shows cached data immediately on navigation
 * - Refetches in background when stale
 * - Prevents loading spinner on every page visit
 */
export function useUserStats() {
  return useQuery<UserStatsResponse>({
    queryKey: ['userStats'],
    queryFn: async () => {
      const response = await fetch('/api/user/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch user stats')
      }
      return response.json()
    },
    // Cache for 2 minutes - stats don't change frequently
    staleTime: 2 * 60 * 1000,
    // Keep in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
    // Retry once on failure
    retry: 1,
  })
}

/**
 * Hook specifically for Solo Study stats
 */
export function useSoloStudyStats() {
  const { data, isLoading, error, refetch } = useUserStats()

  const soloStats = data?.stats?.soloStudy
  const stats = soloStats ? {
    streak: soloStats.streak || data?.stats?.soloStudyStreak || 0,
    level: Math.floor((data?.stats?.points || 0) / 100) + 1,
    xp: data?.stats?.points || 0,
    todayMinutes: soloStats.studyTime?.todayMinutes || 0,
    todaySessions: soloStats.sessions?.today || 0,
  } : null

  return { stats, isLoading, error, refetch }
}

/**
 * Hook specifically for Quick Focus stats
 */
export function useQuickFocusStats() {
  const { data, isLoading, error, refetch } = useUserStats()

  const quickStats = data?.stats?.quickFocus
  const stats = quickStats ? {
    streak: quickStats.streak || data?.stats?.quickFocusStreak || 0,
    todayMinutes: quickStats.studyTime?.todayMinutes || 0,
    todaySessions: quickStats.sessions?.today || 0,
    totalSessions: quickStats.sessions?.allTime || 0,
  } : null

  return { stats, isLoading, error, refetch }
}

/**
 * Hook for combined dashboard stats
 */
export function useDashboardStats() {
  const { data, isLoading, error, refetch } = useUserStats()

  const stats = data?.stats ? {
    // Combined totals for dashboard stats row
    todayMinutes: data.stats.studyTime?.todayMinutes || 0,
    weekMinutes: data.stats.studyTime?.weekMinutes || 0,
    allTimeMinutes: data.stats.studyTime?.allTimeMinutes || 0,
    todaySessions: data.stats.sessions?.today || 0,
    weekSessions: data.stats.sessions?.thisWeek || 0,
    allTimeSessions: data.stats.sessions?.allTime || 0,
    // Streaks (use max of both)
    streak: Math.max(
      data.stats.soloStudyStreak || 0,
      data.stats.quickFocusStreak || 0,
      data.stats.streak?.current || 0
    ),
    // Points/XP
    points: data.stats.points || 0,
    coins: data.stats.coins || 0,
    // Formatted times
    todayFormatted: data.stats.studyTime?.today || '0m',
    weekFormatted: data.stats.studyTime?.thisWeek || '0m',
  } : null

  return { stats, isLoading, error, refetch }
}
