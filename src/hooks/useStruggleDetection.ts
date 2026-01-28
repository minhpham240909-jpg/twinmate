/**
 * STRUGGLE DETECTION HOOK
 *
 * Connects the struggle detector to React state.
 * Monitors step activity and provides struggle nudges.
 *
 * Usage:
 * const { struggleState, nudge, dismissNudge, recordAttempt } = useStruggleDetection(stepId, estimatedMinutes)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  detectStruggle,
  getStepActivity,
  saveStepActivity,
  updateActivityTimeSpent,
  recordAttempt as recordStepAttempt,
  clearStepActivity,
  canShowNudge,
  getNudge,
  type StruggleState,
  type Nudge,
  type StepActivity,
} from '@/lib/progress-feedback/struggle-detector'

// ============================================
// TYPES
// ============================================

export interface UseStruggleDetectionResult {
  // Current struggle state
  struggleState: StruggleState
  // The nudge to display (if any)
  nudge: Nudge | null
  // Activity tracking data
  activity: StepActivity | null
  // Dismiss the current nudge
  dismissNudge: () => void
  // Record an attempt (success/failure)
  recordAttempt: (success: boolean) => void
  // Clear activity when step is completed
  clearActivity: () => void
  // Force a refresh of the struggle state
  refresh: () => void
}

// ============================================
// CONSTANTS
// ============================================

// How often to check for struggle signals (ms)
const CHECK_INTERVAL = 30 * 1000 // 30 seconds

// Minimum time before first check (ms)
const INITIAL_DELAY = 60 * 1000 // 1 minute

// ============================================
// HOOK
// ============================================

export function useStruggleDetection(
  stepId: string | undefined,
  estimatedMinutes: number = 15
): UseStruggleDetectionResult {
  // State
  const [struggleState, setStruggleState] = useState<StruggleState>({
    level: 'none',
    indicators: [],
    shouldShowNudge: false,
    nudgeType: null,
    nudgeMessage: null,
    lastNudgeAt: null,
  })
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [activity, setActivity] = useState<StepActivity | null>(null)

  // Refs for tracking
  const lastNudgeAtRef = useRef<number | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize activity tracking when step changes
  useEffect(() => {
    if (!stepId) {
      setActivity(null)
      return
    }

    // Get or create activity for this step
    const stepActivity = getStepActivity(stepId, estimatedMinutes)
    setActivity(stepActivity)

    // Update time spent when leaving
    return () => {
      if (stepId) {
        updateActivityTimeSpent(stepId)
      }
    }
  }, [stepId, estimatedMinutes])

  // Check for struggle signals periodically
  const checkStruggle = useCallback(() => {
    if (!activity || !stepId) return

    // Update activity with current time
    const updatedActivity: StepActivity = {
      ...activity,
      lastViewedAt: Date.now(),
    }

    // Detect struggle
    const state = detectStruggle(updatedActivity)

    // Only show nudge if cooldown has passed
    if (state.shouldShowNudge && canShowNudge(lastNudgeAtRef.current)) {
      state.lastNudgeAt = lastNudgeAtRef.current
      setStruggleState(state)

      // Get the actual nudge content
      if (state.nudgeType) {
        const nudgeContent = getNudge(state.nudgeType)
        setNudge(nudgeContent)
      }
    } else {
      // Update state but don't show nudge
      setStruggleState(prev => ({
        ...state,
        shouldShowNudge: false,
        nudgeType: null,
        nudgeMessage: null,
        lastNudgeAt: prev.lastNudgeAt,
      }))
    }
  }, [activity, stepId])

  // Set up periodic checking
  useEffect(() => {
    if (!stepId || !activity) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
      return
    }

    // Initial delay before first check
    const initialTimeout = setTimeout(() => {
      checkStruggle()

      // Then check periodically
      checkIntervalRef.current = setInterval(checkStruggle, CHECK_INTERVAL)
    }, INITIAL_DELAY)

    return () => {
      clearTimeout(initialTimeout)
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
    }
  }, [stepId, activity, checkStruggle])

  // Dismiss nudge
  const dismissNudge = useCallback(() => {
    lastNudgeAtRef.current = Date.now()
    setNudge(null)
    setStruggleState(prev => ({
      ...prev,
      shouldShowNudge: false,
      nudgeType: null,
      nudgeMessage: null,
      lastNudgeAt: Date.now(),
    }))
  }, [])

  // Record attempt
  const recordAttempt = useCallback((success: boolean) => {
    if (!stepId) return

    recordStepAttempt(stepId, success)

    // Update local activity state
    setActivity(prev => {
      if (!prev) return prev
      const updated = {
        ...prev,
        attempts: prev.attempts + 1,
        lastAttemptSuccess: success,
      }
      saveStepActivity(updated)
      return updated
    })

    // Check for struggle immediately after attempt
    setTimeout(checkStruggle, 500)
  }, [stepId, checkStruggle])

  // Clear activity
  const clearActivity = useCallback(() => {
    if (stepId) {
      clearStepActivity(stepId)
    }
    setActivity(null)
    setNudge(null)
    setStruggleState({
      level: 'none',
      indicators: [],
      shouldShowNudge: false,
      nudgeType: null,
      nudgeMessage: null,
      lastNudgeAt: null,
    })
  }, [stepId])

  // Force refresh
  const refresh = useCallback(() => {
    checkStruggle()
  }, [checkStruggle])

  return {
    struggleState,
    nudge,
    activity,
    dismissNudge,
    recordAttempt,
    clearActivity,
    refresh,
  }
}

export default useStruggleDetection
