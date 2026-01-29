/**
 * ACTIVE ROADMAP HOOK
 *
 * Manages the user's active roadmap state.
 * Provides:
 * - Load active roadmap on mount
 * - Save new roadmaps
 * - Complete steps
 * - Today's Mission
 *
 * Uses React Query for caching to prevent loading spinners
 * when navigating back to dashboard from other pages.
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ============================================
// FETCH WITH RETRY & SESSION REFRESH
// ============================================

/**
 * Fetch with automatic retry and session refresh on auth errors.
 * This handles the case where the session has expired while the tab was idle.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const supabase = createClient()
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // If unauthorized, try to refresh the session and retry
      if (response.status === 401 && attempt < maxRetries - 1) {
        console.log(`[useActiveRoadmap] Got 401, refreshing session (attempt ${attempt + 1})...`)

        // Try to refresh the session
        const { data, error } = await supabase.auth.refreshSession()

        if (error || !data.session) {
          // Session refresh failed - user needs to log in again
          console.error('[useActiveRoadmap] Session refresh failed:', error?.message)
          // Return the 401 response to be handled by the caller
          return response
        }

        // Session refreshed - retry the request
        console.log('[useActiveRoadmap] Session refreshed, retrying request...')
        // Small delay to ensure token is propagated
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      // For other errors or success, return the response
      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Network error')
      console.error(`[useActiveRoadmap] Fetch attempt ${attempt + 1} failed:`, lastError.message)

      // On network error, wait and retry
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)))
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Request failed after retries')
}

// ============================================
// TYPES
// ============================================

// Resource suggestion type
export interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  url?: string
  searchQuery?: string
}

// Micro-task for task-based progression
export interface MicroTask {
  id: string
  order: number
  title: string
  description: string
  taskType: 'ACTION' | 'LEARN' | 'PRACTICE' | 'TEST' | 'REFLECT'
  duration: number
  verificationMethod?: string
  proofRequired: boolean
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  completedAt?: string
  attempts: number
}

export interface RoadmapStep {
  id: string
  order: number
  title: string
  description: string
  timeframe?: string
  method?: string
  avoid?: string
  doneWhen?: string
  duration: number
  resources?: StepResource[]
  status: 'locked' | 'current' | 'completed' | 'skipped'
  completedAt?: string
  minutesSpent?: number
  // Enhanced fields for professor-level roadmaps
  whyFirst?: string
  timeBreakdown?: { daily: string; total: string; flexible: string }
  commonMistakes?: string[]
  selfTest?: { challenge: string; passCriteria: string }
  abilities?: string[]
  whyAfterPrevious?: string
  previewAbilities?: string[]
  phase?: 'NOW' | 'NEXT' | 'LATER'
  milestone?: string
  risk?: { warning: string; consequence: string; severity: string }
  // Micro-tasks for task-based progression
  microTasks?: MicroTask[]
}

// Recommended platform type
export interface RecommendedPlatform {
  id: string
  name: string
  description: string
  url: string
  icon: string
  color: string
  searchUrl?: string
}

// Critical warning structure
export interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
}

export interface ActiveRoadmap {
  id: string
  title: string
  overview?: string
  goal: string
  subject?: string
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ABANDONED'
  currentStepIndex: number
  totalSteps: number
  completedSteps: number
  estimatedMinutes: number
  actualMinutesSpent: number
  pitfalls?: string[]
  successLooksLike?: string
  recommendedPlatforms?: RecommendedPlatform[]
  targetDate?: string // Accountability: user-set deadline
  createdAt: string
  lastActivityAt: string
  steps: RoadmapStep[]
  // Vision & Strategy fields
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  outOfScope?: string[]
  criticalWarning?: CriticalWarning
  estimatedDays?: number
  dailyCommitment?: string
}

export interface TodaysMission {
  stepId: string
  title: string
  description: string
  timeframe?: string
  method?: string
  avoid?: string
  doneWhen?: string
  estimatedMinutes: number
  stepNumber: number
  totalSteps: number
}

export interface RoadmapStats {
  totalRoadmaps: number
  completedRoadmaps: number
  totalMinutesLearned: number
  averageCompletionRate: number
}

interface UseActiveRoadmapReturn {
  // State
  activeRoadmap: ActiveRoadmap | null
  currentStep: RoadmapStep | null
  todaysMission: TodaysMission | null
  stats: RoadmapStats | null
  isLoading: boolean
  error: string | null

  // Actions
  refresh: () => Promise<void>
  saveRoadmap: (roadmapData: SaveRoadmapInput) => Promise<ActiveRoadmap | null>
  completeStep: (stepId: string, options?: CompleteStepOptions) => Promise<boolean>
  deleteRoadmap: () => Promise<boolean>
}

export interface SaveRoadmapInput {
  goal: string
  subject?: string
  goalType?: string
  title: string
  overview?: string
  pitfalls?: string[]
  successLooksLike?: string
  estimatedMinutes?: number
  recommendedPlatforms?: RecommendedPlatform[]
  steps: {
    order: number
    title: string
    description: string
    timeframe?: string
    method?: string
    avoid?: string
    doneWhen?: string
    duration?: number
    resources?: StepResource[]
  }[]
}

export interface CompleteStepOptions {
  userNotes?: string
  difficultyRating?: number
  minutesSpent?: number
}

// ============================================
// API RESPONSE TYPE
// ============================================

interface ActiveRoadmapResponse {
  activeRoadmap: ActiveRoadmap | null
  currentStep: RoadmapStep | null
  todaysMission: TodaysMission | null
  stats: RoadmapStats | null
}

// Query key for React Query
const ROADMAP_QUERY_KEY = ['activeRoadmap']

// ============================================
// HOOK
// ============================================

/**
 * React Query-based hook for active roadmap
 * - Caches data to prevent loading spinners on navigation
 * - Shows cached data immediately when returning to dashboard
 * - Refetches in background when stale
 */
export function useActiveRoadmap(): UseActiveRoadmapReturn {
  const queryClient = useQueryClient()

  // Use React Query for data fetching with caching
  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<ActiveRoadmapResponse>({
    queryKey: ROADMAP_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/roadmap/active')
      const data = await response.json()

      if (!response.ok) {
        // 401 means user not logged in - return empty state, not error
        if (response.status === 401) {
          return {
            activeRoadmap: null,
            currentStep: null,
            todaysMission: null,
            stats: null,
          }
        }
        throw new Error(data.error || 'Failed to fetch active roadmap')
      }

      // Debug logging for production issues
      if (data.activeRoadmap && !data.activeRoadmap.steps) {
        console.error('[useActiveRoadmap] API returned roadmap without steps!', {
          roadmapId: data.activeRoadmap.id,
          hasSteps: !!data.activeRoadmap.steps,
          keys: Object.keys(data.activeRoadmap),
        })
      }

      return {
        activeRoadmap: data.activeRoadmap,
        currentStep: data.currentStep,
        todaysMission: data.todaysMission,
        stats: data.stats,
      }
    },
    // Cache for 2 minutes - roadmap doesn't change frequently
    staleTime: 2 * 60 * 1000,
    // Keep in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
    // Retry once on failure
    retry: 1,
    // Return previous data while refetching to prevent UI flickering
    placeholderData: (previousData) => previousData,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  })

  // Save a new roadmap (with retry and session refresh)
  const saveRoadmap = useCallback(async (roadmapData: SaveRoadmapInput): Promise<ActiveRoadmap | null> => {
    try {
      const response = await fetchWithRetry('/api/roadmap/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roadmapData),
      })

      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.')
        }
        throw new Error(responseData.error || 'Failed to save roadmap')
      }

      // Refetch the query to get fresh data (wait for refetch to complete)
      await queryClient.refetchQueries({ queryKey: ROADMAP_QUERY_KEY })

      return responseData.roadmap
    } catch (err) {
      console.error('Error saving roadmap:', err instanceof Error ? err.message : err)
      return null
    }
  }, [queryClient])

  // Complete a step (with retry and session refresh)
  const completeStep = useCallback(async (
    stepId: string,
    options?: CompleteStepOptions
  ): Promise<boolean> => {
    const activeRoadmap = data?.activeRoadmap
    if (!activeRoadmap) {
      console.error('No active roadmap')
      return false
    }

    try {
      const response = await fetchWithRetry('/api/roadmap/step/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapId: activeRoadmap.id,
          stepId,
          ...options,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.')
        }
        throw new Error(responseData.error || 'Failed to complete step')
      }

      // Refetch the query to get fresh data (wait for refetch to complete)
      await queryClient.refetchQueries({ queryKey: ROADMAP_QUERY_KEY })

      return true
    } catch (err) {
      console.error('Error completing step:', err)
      return false
    }
  }, [data?.activeRoadmap, queryClient])

  // Delete the active roadmap (with retry and session refresh)
  const deleteRoadmap = useCallback(async (): Promise<boolean> => {
    const activeRoadmap = data?.activeRoadmap
    if (!activeRoadmap) {
      console.error('No active roadmap to delete')
      return false
    }

    try {
      // Use fetchWithRetry to handle session expiration after idle
      const response = await fetchWithRetry('/api/roadmap/active', {
        method: 'DELETE',
      })

      const responseData = await response.json()

      if (!response.ok) {
        // If still unauthorized after retry, provide helpful message
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.')
        }
        throw new Error(responseData.error || 'Failed to delete roadmap')
      }

      // Clear the cache immediately with null data
      queryClient.setQueryData(ROADMAP_QUERY_KEY, {
        activeRoadmap: null,
        currentStep: null,
        todaysMission: null,
        stats: null,
      })

      return true
    } catch (err) {
      console.error('Error deleting roadmap:', err)
      return false
    }
  }, [data?.activeRoadmap, queryClient])

  // Refresh function that wraps refetch
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    activeRoadmap: data?.activeRoadmap ?? null,
    currentStep: data?.currentStep ?? null,
    todaysMission: data?.todaysMission ?? null,
    stats: data?.stats ?? null,
    isLoading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load roadmap') : null,
    refresh,
    saveRoadmap,
    completeStep,
    deleteRoadmap,
  }
}
