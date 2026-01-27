'use client'

/**
 * ENGAGEMENT HOOK
 *
 * Manages daily commitment, progress tracking, and streaks.
 * Provides:
 * - Daily commitment settings
 * - Today's progress
 * - Streak data
 * - Week/month statistics
 *
 * Uses React Query for caching to prevent loading spinners.
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================
// TYPES
// ============================================

export interface DailyCommitment {
  dailyMinutes: number
  preferredStartTime: string | null
  preferredEndTime: string | null
  preferredDays: string[]
  reminderEnabled: boolean
  reminderTime: string | null
  weekendMode: 'SAME' | 'REDUCED' | 'OFF'
}

export interface TodayProgress {
  date: string
  minutesLearned: number
  stepsCompleted: number
  capturesCreated: number
  reviewsCompleted: number
  xpEarned: number
  goalMet: boolean
  goalMinutes: number
  percentComplete: number
}

export interface WeekProgress {
  startDate: string
  endDate: string
  days: {
    date: string
    minutesLearned: number
    goalMet: boolean
    goalMinutes: number
  }[]
  totalMinutes: number
  daysCompleted: number
  averageMinutes: number
}

export interface StreakData {
  current: number
  longest: number
  currentStart: string | null
  lastCompleted: string | null
}

export interface StreakStats {
  thisWeek: {
    daysCompleted: number
    minutesLearned: number
  }
  thisMonth: {
    daysCompleted: number
    minutesLearned: number
  }
  allTime: {
    daysCompleted: number
    minutesLearned: number
    xpEarned: number
  }
  freezes: {
    available: number
  }
  atRisk: boolean
  hoursRemaining: number
}

export interface EngagementData {
  commitment: DailyCommitment
  todayProgress: TodayProgress
  weekProgress: WeekProgress
  streak: StreakData
  streakStats: StreakStats
}

interface UseEngagementReturn {
  // State
  commitment: DailyCommitment | null
  todayProgress: TodayProgress | null
  weekProgress: WeekProgress | null
  streak: StreakData | null
  streakStats: StreakStats | null
  isLoading: boolean
  error: string | null

  // Actions
  refresh: () => Promise<void>
  setCommitment: (minutes: number) => Promise<boolean>
  recordLearning: (minutes: number, options?: RecordLearningOptions) => Promise<RecordResult | null>
  recordCapture: () => Promise<boolean>
  recordReview: () => Promise<boolean>
}

interface RecordLearningOptions {
  roadmapId?: string
  stepCompleted?: boolean
  xpEarned?: number
}

interface RecordResult {
  progress: TodayProgress
  goalJustMet: boolean
  streakMilestone: number | null
  xpAwarded: number
}

// Query keys
const COMMITMENT_KEY = ['engagement', 'commitment']
const STREAK_KEY = ['engagement', 'streak']

// ============================================
// HOOK
// ============================================

export function useEngagement(): UseEngagementReturn {
  const queryClient = useQueryClient()

  // Fetch commitment and today's progress
  const {
    data: commitmentData,
    isLoading: commitmentLoading,
    error: commitmentError,
    refetch: refetchCommitment,
  } = useQuery({
    queryKey: COMMITMENT_KEY,
    queryFn: async () => {
      const response = await fetch('/api/engagement/commitment')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return null
        }
        throw new Error(data.error || 'Failed to fetch commitment data')
      }

      return {
        commitment: data.commitment as DailyCommitment,
        todayProgress: data.todayProgress as TodayProgress,
        weekProgress: data.weekProgress as WeekProgress,
      }
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
  })

  // Fetch streak data
  const {
    data: streakData,
    isLoading: streakLoading,
    error: streakError,
    refetch: refetchStreak,
  } = useQuery({
    queryKey: STREAK_KEY,
    queryFn: async () => {
      const response = await fetch('/api/engagement/streak')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return null
        }
        throw new Error(data.error || 'Failed to fetch streak data')
      }

      return {
        streak: data.streak as StreakData,
        thisWeek: data.thisWeek,
        thisMonth: data.thisMonth,
        allTime: data.allTime,
        freezes: data.freezes,
        atRisk: data.atRisk,
        hoursRemaining: data.hoursRemaining,
      }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
  })

  // Set commitment mutation
  const setCommitmentMutation = useMutation({
    mutationFn: async (dailyMinutes: number) => {
      const response = await fetch('/api/engagement/commitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyMinutes }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set commitment')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMITMENT_KEY })
    },
  })

  // Record learning mutation
  const recordLearningMutation = useMutation({
    mutationFn: async ({ minutes, options }: { minutes: number; options?: RecordLearningOptions }) => {
      const response = await fetch('/api/engagement/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learning',
          minutesSpent: minutes,
          ...options,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record learning')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMITMENT_KEY })
      queryClient.invalidateQueries({ queryKey: STREAK_KEY })
    },
  })

  // Record capture mutation
  const recordCaptureMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/engagement/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'capture' }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record capture')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMITMENT_KEY })
    },
  })

  // Record review mutation
  const recordReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/engagement/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'review' }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record review')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMITMENT_KEY })
    },
  })

  // Action functions
  const setCommitment = useCallback(async (minutes: number): Promise<boolean> => {
    try {
      await setCommitmentMutation.mutateAsync(minutes)
      return true
    } catch {
      return false
    }
  }, [setCommitmentMutation])

  const recordLearning = useCallback(async (
    minutes: number,
    options?: RecordLearningOptions
  ): Promise<RecordResult | null> => {
    try {
      const result = await recordLearningMutation.mutateAsync({ minutes, options })
      return {
        progress: result.todayProgress,
        goalJustMet: result.goalJustMet,
        streakMilestone: result.streakMilestone,
        xpAwarded: result.xpAwarded,
      }
    } catch {
      return null
    }
  }, [recordLearningMutation])

  const recordCapture = useCallback(async (): Promise<boolean> => {
    try {
      await recordCaptureMutation.mutateAsync()
      return true
    } catch {
      return false
    }
  }, [recordCaptureMutation])

  const recordReview = useCallback(async (): Promise<boolean> => {
    try {
      await recordReviewMutation.mutateAsync()
      return true
    } catch {
      return false
    }
  }, [recordReviewMutation])

  const refresh = useCallback(async () => {
    await Promise.all([refetchCommitment(), refetchStreak()])
  }, [refetchCommitment, refetchStreak])

  // Build streak stats from streakData
  const streakStats: StreakStats | null = streakData
    ? {
        thisWeek: streakData.thisWeek,
        thisMonth: streakData.thisMonth,
        allTime: streakData.allTime,
        freezes: streakData.freezes,
        atRisk: streakData.atRisk,
        hoursRemaining: streakData.hoursRemaining,
      }
    : null

  return {
    commitment: commitmentData?.commitment ?? null,
    todayProgress: commitmentData?.todayProgress ?? null,
    weekProgress: commitmentData?.weekProgress ?? null,
    streak: streakData?.streak ?? null,
    streakStats,
    isLoading: commitmentLoading || streakLoading,
    error: commitmentError
      ? (commitmentError instanceof Error ? commitmentError.message : 'Failed to load commitment')
      : streakError
      ? (streakError instanceof Error ? streakError.message : 'Failed to load streak')
      : null,
    refresh,
    setCommitment,
    recordLearning,
    recordCapture,
    recordReview,
  }
}
