'use client'

/**
 * STRUGGLE DETECTION CONTEXT
 *
 * Provides real-time struggle detection for the current learning step.
 * Wraps the struggle-detector logic in a React context for easy access
 * throughout the dashboard and roadmap components.
 *
 * Features:
 * - Tracks time spent on current step
 * - Detects struggle signals (time exceeded, multiple views, etc.)
 * - Manages nudge display with cooldown
 * - Provides actions for nudge interactions
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  detectStruggle,
  getStepActivity,
  saveStepActivity,
  updateActivityTimeSpent,
  recordAttempt,
  clearStepActivity,
  canShowNudge,
  getNudge,
  type StruggleState,
  type StruggleLevel,
  type NudgeType,
  type Nudge,
  type StepActivity,
} from '@/lib/progress-feedback/struggle-detector'

// ============================================
// TYPES
// ============================================

interface StruggleContextValue {
  // Current state
  struggleState: StruggleState | null
  currentNudge: Nudge | null
  isNudgeVisible: boolean
  activity: StepActivity | null

  // Actions
  startTrackingStep: (stepId: string, estimatedMinutes: number) => void
  stopTrackingStep: () => void
  recordStepAttempt: (success: boolean) => void
  completeStep: () => void
  dismissNudge: () => void
  executeNudgeAction: (actionHandler: string) => void

  // State accessors
  getStruggleLevel: () => StruggleLevel
  isStruggling: () => boolean
}

const StruggleContext = createContext<StruggleContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

interface StruggleProviderProps {
  children: ReactNode
  onShowHint?: () => void
  onSimplifyStep?: () => void
  onShowResources?: () => void
  onOpenChat?: () => void
}

export function StruggleProvider({
  children,
  onShowHint,
  onSimplifyStep,
  onShowResources,
  onOpenChat,
}: StruggleProviderProps) {
  // Current step being tracked
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [activity, setActivity] = useState<StepActivity | null>(null)
  const [struggleState, setStruggleState] = useState<StruggleState | null>(null)
  const [currentNudge, setCurrentNudge] = useState<Nudge | null>(null)
  const [isNudgeVisible, setIsNudgeVisible] = useState(false)
  const [lastNudgeAt, setLastNudgeAt] = useState<number | null>(null)

  // Interval for periodic struggle detection
  const detectionInterval = useRef<NodeJS.Timeout | null>(null)

  // ============================================
  // STRUGGLE DETECTION LOOP
  // ============================================

  const runDetection = useCallback(() => {
    if (!activity) return

    const state = detectStruggle(activity)
    setStruggleState(state)

    // Check if we should show a nudge
    if (state.shouldShowNudge && state.nudgeType && canShowNudge(lastNudgeAt)) {
      const nudge = getNudge(state.nudgeType)
      setCurrentNudge(nudge)
      setIsNudgeVisible(true)
      setLastNudgeAt(Date.now())
    }
  }, [activity, lastNudgeAt])

  // Run detection every 30 seconds while tracking
  useEffect(() => {
    if (currentStepId && activity) {
      // Run immediately
      runDetection()

      // Then run every 30 seconds
      detectionInterval.current = setInterval(runDetection, 30000)

      return () => {
        if (detectionInterval.current) {
          clearInterval(detectionInterval.current)
        }
      }
    }
  }, [currentStepId, activity, runDetection])

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Start tracking a step
   */
  const startTrackingStep = useCallback((stepId: string, estimatedMinutes: number) => {
    // Save time spent on previous step
    if (currentStepId) {
      updateActivityTimeSpent(currentStepId)
    }

    // Start tracking new step
    setCurrentStepId(stepId)
    const stepActivity = getStepActivity(stepId, estimatedMinutes)
    setActivity(stepActivity)
    setStruggleState(null)
    setCurrentNudge(null)
    setIsNudgeVisible(false)
  }, [currentStepId])

  /**
   * Stop tracking current step
   */
  const stopTrackingStep = useCallback(() => {
    if (currentStepId) {
      updateActivityTimeSpent(currentStepId)
    }

    setCurrentStepId(null)
    setActivity(null)
    setStruggleState(null)
    setCurrentNudge(null)
    setIsNudgeVisible(false)

    if (detectionInterval.current) {
      clearInterval(detectionInterval.current)
    }
  }, [currentStepId])

  /**
   * Record an attempt on the step
   */
  const recordStepAttempt = useCallback((success: boolean) => {
    if (!currentStepId) return

    recordAttempt(currentStepId, success)

    // Update local activity state
    setActivity(prev => {
      if (!prev) return prev
      return {
        ...prev,
        attempts: prev.attempts + 1,
        lastAttemptSuccess: success,
      }
    })

    // Run detection after attempt
    setTimeout(runDetection, 100)
  }, [currentStepId, runDetection])

  /**
   * Complete the current step
   */
  const completeStep = useCallback(() => {
    if (!currentStepId) return

    clearStepActivity(currentStepId)
    setCurrentStepId(null)
    setActivity(null)
    setStruggleState(null)
    setCurrentNudge(null)
    setIsNudgeVisible(false)

    if (detectionInterval.current) {
      clearInterval(detectionInterval.current)
    }
  }, [currentStepId])

  /**
   * Dismiss the current nudge
   */
  const dismissNudge = useCallback(() => {
    setIsNudgeVisible(false)
    setCurrentNudge(null)
  }, [])

  /**
   * Execute a nudge action
   */
  const executeNudgeAction = useCallback((actionHandler: string) => {
    switch (actionHandler) {
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
      default:
        console.warn('[StruggleContext] Unknown action handler:', actionHandler)
    }

    // Dismiss nudge after action
    dismissNudge()
  }, [onShowHint, onSimplifyStep, onShowResources, onOpenChat, dismissNudge])

  // ============================================
  // STATE ACCESSORS
  // ============================================

  const getStruggleLevel = useCallback((): StruggleLevel => {
    return struggleState?.level || 'none'
  }, [struggleState])

  const isStruggling = useCallback((): boolean => {
    return struggleState?.level !== 'none' && struggleState?.level !== undefined
  }, [struggleState])

  // ============================================
  // CLEANUP
  // ============================================

  // Save activity when component unmounts or page unloads
  useEffect(() => {
    const handleUnload = () => {
      if (currentStepId) {
        updateActivityTimeSpent(currentStepId)
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      handleUnload()
    }
  }, [currentStepId])

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: StruggleContextValue = {
    struggleState,
    currentNudge,
    isNudgeVisible,
    activity,
    startTrackingStep,
    stopTrackingStep,
    recordStepAttempt,
    completeStep,
    dismissNudge,
    executeNudgeAction,
    getStruggleLevel,
    isStruggling,
  }

  return (
    <StruggleContext.Provider value={value}>
      {children}
    </StruggleContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function useStruggle(): StruggleContextValue {
  const context = useContext(StruggleContext)
  if (!context) {
    throw new Error('useStruggle must be used within a StruggleProvider')
  }
  return context
}

// ============================================
// OPTIONAL HOOK (doesn't throw if outside provider)
// ============================================

export function useStruggleOptional(): StruggleContextValue | null {
  return useContext(StruggleContext)
}
