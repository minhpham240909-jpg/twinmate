'use client'

/**
 * useGuestTrial Hook
 *
 * React hook for managing guest trial state.
 * Provides reactive access to trial status and actions.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  GuestTrialState,
  getGuestTrialState,
  useOneTrial,
  hasTrialsRemaining,
  getTrialsRemaining,
  clearGuestTrialState,
  GUEST_TRIAL_LIMIT,
} from '@/lib/guest-trial'

interface UseGuestTrialReturn {
  // State
  trialState: GuestTrialState | null
  trialsRemaining: number
  totalTrials: number
  hasTrials: boolean
  isLoading: boolean

  // Actions
  consumeTrial: (question: string, type: 'explanation' | 'flashcards' | 'roadmap') => void
  clearTrial: () => void
  refreshState: () => void
}

export function useGuestTrial(): UseGuestTrialReturn {
  const [trialState, setTrialState] = useState<GuestTrialState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load state on mount
  useEffect(() => {
    const state = getGuestTrialState()
    setTrialState(state)
    setIsLoading(false)
  }, [])

  // Consume one trial
  const consumeTrial = useCallback((
    question: string,
    type: 'explanation' | 'flashcards' | 'roadmap'
  ) => {
    const newState = useOneTrial(question, type)
    setTrialState(newState)
  }, [])

  // Clear trial state (after signup)
  const clearTrial = useCallback(() => {
    clearGuestTrialState()
    setTrialState({
      usesRemaining: 0,
      firstUseAt: null,
      lastUseAt: null,
      responses: [],
    })
  }, [])

  // Refresh state from localStorage
  const refreshState = useCallback(() => {
    const state = getGuestTrialState()
    setTrialState(state)
  }, [])

  return {
    trialState,
    trialsRemaining: trialState?.usesRemaining ?? GUEST_TRIAL_LIMIT,
    totalTrials: GUEST_TRIAL_LIMIT,
    hasTrials: trialState ? trialState.usesRemaining > 0 : true,
    isLoading,
    consumeTrial,
    clearTrial,
    refreshState,
  }
}
