/**
 * PROGRESS FEEDBACK HOOK
 *
 * Manages micro-celebrations and struggle detection for the learning experience.
 *
 * Features:
 * - Tracks step activity and time spent
 * - Detects struggles and shows nudges
 * - Shows celebration toasts on achievements
 * - Manages feedback queue to avoid overwhelming users
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Celebration,
  ProgressStats,
  checkStepCompletionCelebrations,
  checkComebackCelebration,
  hasShownCelebration,
  markCelebrationShown,
} from '@/lib/progress-feedback/progress-celebrations'
import {
  StruggleState,
  Nudge,
  StepActivity,
  detectStruggle,
  getNudge,
  getStepActivity,
  saveStepActivity,
  updateActivityTimeSpent,
  recordAttempt,
  clearStepActivity,
  canShowNudge,
} from '@/lib/progress-feedback/struggle-detector'

// ============================================
// TYPES
// ============================================

export type FeedbackType = 'celebration' | 'nudge'

export interface FeedbackItem {
  id: string
  type: FeedbackType
  celebration?: Celebration
  nudge?: Nudge
  shownAt: number
}

interface UseProgressFeedbackProps {
  // Current step info
  currentStepId: string | null
  estimatedMinutes: number
  
  // Roadmap progress
  roadmapProgress: number
  completedSteps: number
  totalSteps: number
  
  // User stats
  currentStreak: number
  totalMinutesLearned: number
  lastActiveDate?: Date
  
  // Callbacks
  onShowHint?: () => void
  onSimplifyStep?: () => void
  onShowResources?: () => void
  onOpenChat?: () => void
}

interface UseProgressFeedbackReturn {
  // Current feedback to show
  activeFeedback: FeedbackItem | null
  
  // Struggle state
  struggleState: StruggleState | null
  
  // Actions
  dismissFeedback: () => void
  triggerStepComplete: (minutesSpent: number) => void
  triggerAttempt: (success: boolean) => void
  handleNudgeAction: (handler: string) => void
  
  // Stats
  feedbackHistory: FeedbackItem[]
}

// ============================================
// HOOK
// ============================================

export function useProgressFeedback({
  currentStepId,
  estimatedMinutes,
  roadmapProgress,
  completedSteps,
  totalSteps,
  currentStreak,
  totalMinutesLearned,
  lastActiveDate,
  onShowHint,
  onSimplifyStep,
  onShowResources,
  onOpenChat,
}: UseProgressFeedbackProps): UseProgressFeedbackReturn {
  // State
  const [activeFeedback, setActiveFeedback] = useState<FeedbackItem | null>(null)
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([])
  const [struggleState, setStruggleState] = useState<StruggleState | null>(null)
  
  // Refs
  const previousStatsRef = useRef<Partial<ProgressStats>>({})
  const activityRef = useRef<StepActivity | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const feedbackQueueRef = useRef<FeedbackItem[]>([])
  const lastNudgeAtRef = useRef<number | null>(null)

  // ============================================
  // FEEDBACK QUEUE MANAGEMENT (moved up to avoid hoisting issues)
  // ============================================

  const showNextFeedback = useCallback(() => {
    const next = feedbackQueueRef.current.shift()
    if (next) {
      setActiveFeedback(next)
      setFeedbackHistory(prev => [...prev.slice(-9), next]) // Keep last 10
    } else {
      setActiveFeedback(null)
    }
  }, [])

  const queueFeedback = useCallback((feedback: FeedbackItem) => {
    feedbackQueueRef.current.push(feedback)

    // If nothing is showing, show immediately
    if (!activeFeedback) {
      showNextFeedback()
    }
  }, [activeFeedback, showNextFeedback])

  const dismissFeedback = useCallback(() => {
    setActiveFeedback(null)
    // Small delay before showing next
    setTimeout(showNextFeedback, 500)
  }, [showNextFeedback])

  // ============================================
  // STEP ACTIVITY TRACKING
  // ============================================

  // Initialize/update step activity when step changes
  useEffect(() => {
    if (!currentStepId) {
      // Save time spent on previous step before switching
      if (activityRef.current) {
        updateActivityTimeSpent(activityRef.current.stepId)
      }
      activityRef.current = null
      return
    }

    // Get or create activity for this step
    activityRef.current = getStepActivity(currentStepId, estimatedMinutes)
  }, [currentStepId, estimatedMinutes])

  // ============================================
  // STRUGGLE DETECTION
  // ============================================

  // Periodic struggle check (every 30 seconds)
  useEffect(() => {
    if (!currentStepId || !activityRef.current) return

    const checkStruggle = () => {
      if (!activityRef.current) return

      const struggle = detectStruggle(activityRef.current)
      setStruggleState(struggle)

      // Show nudge if needed and cooldown passed (use ref to avoid effect re-runs)
      if (struggle.shouldShowNudge && struggle.nudgeType && canShowNudge(lastNudgeAtRef.current)) {
        const nudge = getNudge(struggle.nudgeType)
        queueFeedback({
          id: `nudge-${Date.now()}`,
          type: 'nudge',
          nudge,
          shownAt: Date.now(),
        })
        lastNudgeAtRef.current = Date.now()
      }
    }

    // Initial check after 30 seconds
    const initialTimeout = setTimeout(checkStruggle, 30 * 1000)

    // Then check every 60 seconds
    checkIntervalRef.current = setInterval(checkStruggle, 60 * 1000)

    return () => {
      clearTimeout(initialTimeout)
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [currentStepId, queueFeedback])

  // ============================================
  // COMEBACK DETECTION
  // ============================================

  useEffect(() => {
    if (!lastActiveDate) return

    const comebackCelebration = checkComebackCelebration(lastActiveDate, currentStreak)
    if (comebackCelebration && !hasShownCelebration(comebackCelebration.id)) {
      queueFeedback({
        id: comebackCelebration.id,
        type: 'celebration',
        celebration: comebackCelebration,
        shownAt: Date.now(),
      })
      markCelebrationShown(comebackCelebration.id)
    }
  }, [lastActiveDate, currentStreak, queueFeedback])

  // ============================================
  // STEP COMPLETION
  // ============================================

  const triggerStepComplete = useCallback((minutesSpent: number) => {
    if (!currentStepId || !activityRef.current) return

    // Build current stats
    const currentStats: ProgressStats = {
      roadmapProgress,
      completedSteps,
      totalSteps,
      minutesSpentOnCurrentStep: minutesSpent,
      estimatedMinutesForStep: estimatedMinutes,
      totalMinutesLearned,
      averageMinutesPerStep: totalMinutesLearned / Math.max(1, completedSteps),
      currentStreak,
      longestStreak: currentStreak, // Would need to track this separately
      stepsCompletedToday: 1, // Would need to track this separately
      stepsCompletedThisWeek: completedSteps, // Simplified
      daysActiveThisWeek: Math.min(7, currentStreak),
      averageStepCompletionTime: totalMinutesLearned / Math.max(1, completedSteps),
    }

    // Check for celebrations
    const celebrations = checkStepCompletionCelebrations(currentStats, previousStatsRef.current)
    
    // Queue celebrations that haven't been shown
    for (const celebration of celebrations) {
      if (!hasShownCelebration(celebration.id)) {
        queueFeedback({
          id: celebration.id,
          type: 'celebration',
          celebration,
          shownAt: Date.now(),
        })
        markCelebrationShown(celebration.id)
      }
    }

    // Update previous stats
    previousStatsRef.current = currentStats

    // Clear step activity
    clearStepActivity(currentStepId)
    activityRef.current = null
  }, [
    currentStepId,
    roadmapProgress,
    completedSteps,
    totalSteps,
    estimatedMinutes,
    totalMinutesLearned,
    currentStreak,
    queueFeedback,
  ])

  // ============================================
  // ATTEMPT TRACKING
  // ============================================

  const triggerAttempt = useCallback((success: boolean) => {
    if (!currentStepId) return
    recordAttempt(currentStepId, success)
    
    // Update local activity ref
    if (activityRef.current) {
      activityRef.current.attempts += 1
      activityRef.current.lastAttemptSuccess = success
    }
  }, [currentStepId])

  // ============================================
  // NUDGE ACTION HANDLERS
  // ============================================

  const handleNudgeAction = useCallback((handler: string) => {
    switch (handler) {
      case 'showHint':
        onShowHint?.()
        break
      case 'simplifyStep':
        onSimplifyStep?.()
        break
      case 'showResources':
        onShowResources?.()
        break
      case 'openChat':
        onOpenChat?.()
        break
    }
    dismissFeedback()
  }, [onShowHint, onSimplifyStep, onShowResources, onOpenChat, dismissFeedback])

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      // Save time spent when unmounting
      if (activityRef.current) {
        updateActivityTimeSpent(activityRef.current.stepId)
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [])

  return {
    activeFeedback,
    struggleState,
    dismissFeedback,
    triggerStepComplete,
    triggerAttempt,
    handleNudgeAction,
    feedbackHistory,
  }
}
