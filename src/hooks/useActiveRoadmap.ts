/**
 * ACTIVE ROADMAP HOOK
 *
 * Manages the user's active roadmap state.
 * Provides:
 * - Load active roadmap on mount
 * - Save new roadmaps
 * - Complete steps
 * - Today's Mission
 */

import { useState, useEffect, useCallback } from 'react'

// ============================================
// TYPES
// ============================================

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
  status: 'locked' | 'current' | 'completed' | 'skipped'
  completedAt?: string
  minutesSpent?: number
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
  createdAt: string
  lastActivityAt: string
  steps: RoadmapStep[]
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
  steps: {
    order: number
    title: string
    description: string
    timeframe?: string
    method?: string
    avoid?: string
    doneWhen?: string
    duration?: number
  }[]
}

export interface CompleteStepOptions {
  userNotes?: string
  difficultyRating?: number
  minutesSpent?: number
}

// ============================================
// HOOK
// ============================================

export function useActiveRoadmap(): UseActiveRoadmapReturn {
  const [activeRoadmap, setActiveRoadmap] = useState<ActiveRoadmap | null>(null)
  const [currentStep, setCurrentStep] = useState<RoadmapStep | null>(null)
  const [todaysMission, setTodaysMission] = useState<TodaysMission | null>(null)
  const [stats, setStats] = useState<RoadmapStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch active roadmap
  const fetchActiveRoadmap = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/roadmap/active')
      const data = await response.json()

      if (!response.ok) {
        // 401 means user not logged in - don't show as error
        if (response.status === 401) {
          setActiveRoadmap(null)
          setCurrentStep(null)
          setTodaysMission(null)
          return
        }
        throw new Error(data.error || 'Failed to fetch active roadmap')
      }

      setActiveRoadmap(data.activeRoadmap)
      setCurrentStep(data.currentStep)
      setTodaysMission(data.todaysMission)
      setStats(data.stats)
    } catch (err) {
      console.error('Error fetching active roadmap:', err)
      setError(err instanceof Error ? err.message : 'Failed to load roadmap')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save a new roadmap
  const saveRoadmap = useCallback(async (roadmapData: SaveRoadmapInput): Promise<ActiveRoadmap | null> => {
    try {
      setError(null)

      const response = await fetch('/api/roadmap/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roadmapData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save roadmap')
      }

      // Refresh to get the full state
      await fetchActiveRoadmap()

      return data.roadmap
    } catch (err) {
      console.error('Error saving roadmap:', err)
      setError(err instanceof Error ? err.message : 'Failed to save roadmap')
      return null
    }
  }, [fetchActiveRoadmap])

  // Complete a step
  const completeStepAction = useCallback(async (
    stepId: string,
    options?: CompleteStepOptions
  ): Promise<boolean> => {
    if (!activeRoadmap) {
      setError('No active roadmap')
      return false
    }

    try {
      setError(null)

      const response = await fetch('/api/roadmap/step/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapId: activeRoadmap.id,
          stepId,
          ...options,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete step')
      }

      // Refresh to get the updated state
      await fetchActiveRoadmap()

      return true
    } catch (err) {
      console.error('Error completing step:', err)
      setError(err instanceof Error ? err.message : 'Failed to complete step')
      return false
    }
  }, [activeRoadmap, fetchActiveRoadmap])

  // Load on mount
  useEffect(() => {
    fetchActiveRoadmap()
  }, [fetchActiveRoadmap])

  return {
    activeRoadmap,
    currentStep,
    todaysMission,
    stats,
    isLoading,
    error,
    refresh: fetchActiveRoadmap,
    saveRoadmap,
    completeStep: completeStepAction,
  }
}
