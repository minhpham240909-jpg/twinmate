'use client'

import { useQuery } from '@tanstack/react-query'

interface FormattedTime {
  value: number
  unit: string
  display: string
}

interface StudyTime {
  today: FormattedTime
  thisWeek: FormattedTime
  allTime: FormattedTime
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
 * - Caches data for 2 minutes (staleTime)
 * - Shows cached data immediately on navigation
 * - Refetches in background when stale
 * - Prevents loading spinner on every page visit
 * - Prevents UI flickering with placeholderData
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
    // Return previous data while refetching to prevent UI flickering
    placeholderData: (previousData) => previousData,
    // Refetch when window regains focus (user comes back to app)
    refetchOnWindowFocus: true,
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
    // Formatted times - extract display string from object
    todayFormatted: data.stats.studyTime?.today?.display || '0m',
    weekFormatted: data.stats.studyTime?.thisWeek?.display || '0m',
    allTimeFormatted: data.stats.studyTime?.allTime?.display || '0m',
  } : null

  return { stats, isLoading, error, refetch }
}

// ============================================
// SESSION HOOKS
// ============================================

interface ActiveSession {
  id: string
  subject?: string
  timeRemaining: number
  type: 'quick_focus' | 'solo_study'
}

interface LastSession {
  id: string
  subject?: string
  durationMinutes: number
  completedAt?: string
  type: 'quick_focus' | 'solo_study' | 'group'
}

interface SessionDataResponse {
  activeSession: ActiveSession | null
  lastSession: LastSession | null
}

/**
 * React Query hook for session data (active session, last session, enrolled courses)
 * - Caches data to prevent flickering on navigation
 * - Shows cached data immediately when returning to dashboard
 * - Refetches in background when stale
 */
export function useSessionData() {
  return useQuery<SessionDataResponse>({
    queryKey: ['sessionData'],
    queryFn: async () => {
      const response = await fetch('/api/study/last-session')
      if (!response.ok) {
        throw new Error('Failed to fetch session data')
      }
      return response.json()
    },
    // Cache for 30 seconds - sessions change more frequently than stats
    staleTime: 30 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry once on failure
    retry: 1,
    // Return previous data while refetching to prevent flickering
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook for active session only
 */
export function useActiveSession() {
  const { data, isLoading, error, refetch } = useSessionData()

  return {
    activeSession: data?.activeSession || null,
    lastSession: data?.lastSession || null,
    isLoading,
    error,
    refetch,
  }
}

// ============================================
// PARTNER DATA HOOK
// ============================================

interface PartnerProfile {
  bio: string | null
  subjects: string[]
  interests: string[]
  goals: string[]
  skillLevel: string | null
  studyStyle: string | null
  onlineStatus: string
  locationCity: string | null
  locationState: string | null
  locationCountry: string | null
  timezone: string | null
  availableDays: string[]
  availableHours: string[]
  aboutYourself: string | null
  aboutYourselfItems: string[]
}

interface Partner {
  matchId: string
  id: string
  name: string
  avatarUrl: string | null
  onlineStatus: 'ONLINE' | 'OFFLINE'
  activityType: string
  activityDetails: Record<string, unknown> | null
  streak: number
  soloStudyStreak: number
  quickFocusStreak: number
  profile: PartnerProfile | null
  connectedAt: string
}

interface PartnerDataResponse {
  success: boolean
  partners: Partner[]
}

/**
 * React Query hook for partner data
 * - Single optimized query returns all partners with presence
 * - Caches data for 30 seconds to reduce load
 * - Polls every 30 seconds for near-real-time presence updates
 * - No N+1 queries - all data in one API call
 */
export function usePartnerData() {
  return useQuery<PartnerDataResponse>({
    queryKey: ['partnerData'],
    queryFn: async () => {
      const response = await fetch('/api/partners/active')
      if (!response.ok) {
        throw new Error('Failed to fetch partner data')
      }
      return response.json()
    },
    // Cache for 30 seconds - presence data needs to be relatively fresh
    staleTime: 30 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry once on failure
    retry: 1,
    // Return previous data while refetching to prevent flickering
    placeholderData: (previousData) => previousData,
    // Refetch every 30 seconds for presence updates
    refetchInterval: 30 * 1000,
    // Only refetch when window is focused
    refetchIntervalInBackground: false,
  })
}

/**
 * Hook for online partners only (for dashboard sidebar)
 */
export function useOnlinePartners() {
  const { data, isLoading, error, refetch } = usePartnerData()

  const onlinePartners = data?.partners?.filter(p => p.onlineStatus === 'ONLINE') || []
  const partnersCount = data?.partners?.length || 0

  return {
    onlinePartners,
    partnersCount,
    isLoading,
    error,
    refetch,
  }
}

// ============================================
// DASHBOARD COUNTS HOOK
// ============================================

interface DashboardCountsResponse {
  success: boolean
  counts: {
    pendingInvites: number
    connectionRequests: number
    groupInvites: number
    newCommunityPosts: number
    unreadMessages: {
      total: number
      partner: number
      group: number
    }
  }
}

/**
 * React Query hook for dashboard notification counts
 * - Single API call replaces 5 separate calls
 * - Caches data for 30 seconds
 * - Reduces network round-trips significantly
 */
export function useDashboardCounts() {
  return useQuery<DashboardCountsResponse>({
    queryKey: ['dashboardCounts'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/counts')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard counts')
      }
      return response.json()
    },
    // Cache for 30 seconds - counts don't need real-time updates
    staleTime: 30 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry once on failure
    retry: 1,
    // Show previous data while refetching
    placeholderData: (previousData) => previousData,
  })
}

// ============================================
// STUDY SUGGESTIONS HOOK
// ============================================

interface StudySuggestion {
  id: string
  type: 'review_needed' | 'continue' | 'new_topic' | 'streak'
  title: string
  description: string
  subject?: string
  priority: number
  actionUrl?: string
}

interface StudySuggestionsResponse {
  success: boolean
  suggestions: StudySuggestion[]
}

/**
 * React Query hook for personalized study suggestions
 * - Fetches AI-generated study recommendations
 * - Caches for 5 minutes (suggestions don't need real-time)
 * - Shows "Review Chemistry" or "Continue Math" based on activity
 */
export function useStudySuggestions() {
  return useQuery<StudySuggestionsResponse>({
    queryKey: ['studySuggestions'],
    queryFn: async () => {
      const response = await fetch('/api/study/suggestions')
      if (!response.ok) {
        throw new Error('Failed to fetch study suggestions')
      }
      return response.json()
    },
    // Cache for 5 minutes - suggestions don't change frequently
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 15 minutes
    gcTime: 15 * 60 * 1000,
    // Retry once on failure
    retry: 1,
    // Return previous data while refetching
    placeholderData: (previousData) => previousData,
  })
}
