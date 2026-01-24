'use client'

/**
 * useMilestones Hook
 *
 * Manages milestone state, checking, and celebrations.
 * Efficient: only fetches when needed, caches locally.
 */

import { useState, useCallback, useEffect } from 'react'
import { type MilestoneDefinition } from '@/lib/milestones'

interface XpProgress {
  currentLevel: number
  xpForCurrentLevel: number
  xpForNextLevel: number
  progressPercent: number
  xpNeeded: number
  totalXp: number
}

interface MilestoneData {
  earnedMilestones: {
    id: string
    definitionId: string
    earnedAt: string
    definition: MilestoneDefinition
  }[]
  xpProgress: XpProgress
  nextMilestones: {
    streak: MilestoneDefinition | null
    xp: MilestoneDefinition | null
    sessions: MilestoneDefinition | null
  }
  stats: {
    streak: number
    totalXp: number
    totalSessions: number
  }
  streakShields: number
}

interface UseMilestonesReturn {
  // Data
  milestoneData: MilestoneData | null
  isLoading: boolean
  error: string | null

  // Celebration state
  celebrationMilestone: MilestoneDefinition | null
  celebrationXp: number
  dismissCelebration: () => void

  // Actions
  checkMilestones: (actionType?: 'explain' | 'flashcard' | 'guide') => Promise<void>
  refreshMilestones: () => Promise<void>
}

export function useMilestones(): UseMilestonesReturn {
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Celebration queue (show one at a time)
  const [celebrationQueue, setCelebrationQueue] = useState<MilestoneDefinition[]>([])
  const [celebrationXp, setCelebrationXp] = useState(0)

  // Current celebration being shown
  const celebrationMilestone = celebrationQueue[0] || null

  // Dismiss current celebration and show next
  const dismissCelebration = useCallback(() => {
    setCelebrationQueue(prev => prev.slice(1))
    if (celebrationQueue.length <= 1) {
      setCelebrationXp(0)
    }
  }, [celebrationQueue.length])

  // Fetch milestones data
  const refreshMilestones = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user/milestones')

      if (!response.ok) {
        throw new Error('Failed to fetch milestones')
      }

      const data = await response.json()
      setMilestoneData(data)
    } catch (err) {
      console.error('Error fetching milestones:', err)
      setError(err instanceof Error ? err.message : 'Failed to load milestones')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check for new milestones after an action
  const checkMilestones = useCallback(async (actionType?: 'explain' | 'flashcard' | 'guide') => {
    try {
      const response = await fetch('/api/user/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType }),
      })

      if (!response.ok) {
        throw new Error('Failed to check milestones')
      }

      const data = await response.json()

      if (data.newMilestones && data.newMilestones.length > 0) {
        // Queue celebrations
        setCelebrationQueue(data.newMilestones)
        setCelebrationXp(data.xpAwarded || 0)

        // Refresh milestone data to update UI
        await refreshMilestones()
      }
    } catch (err) {
      console.error('Error checking milestones:', err)
      // Don't show error to user - milestone check is not critical
    }
  }, [refreshMilestones])

  // Initial fetch
  useEffect(() => {
    refreshMilestones()
  }, [refreshMilestones])

  return {
    milestoneData,
    isLoading,
    error,
    celebrationMilestone,
    celebrationXp,
    dismissCelebration,
    checkMilestones,
    refreshMilestones,
  }
}
