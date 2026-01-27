/**
 * GOAL ANALYZER HOOK
 *
 * React hook for analyzing user goals and determining if
 * clarification is needed before creating a roadmap.
 */

'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Types matching the goal analyzer
export interface ClarificationOption {
  id: string
  label: string
  description: string
  estimatedDuration?: string
  skills?: string[]
}

// Non-educational domain types
export type NonEducationalDomain =
  | 'fitness'       // Workout tracking, calorie counting, etc.
  | 'productivity'  // Task management, timers, scheduling
  | 'finance'       // Budget tracking, expense logging
  | 'lifestyle'     // Meal planning, habit tracking
  | 'social'        // Chat, entertainment requests
  | 'utility'       // Calculations, conversions, bookings

export interface GoalAnalysis {
  originalGoal: string
  goalType: string
  timelineType: string
  estimatedDuration: string
  isDirectlyLearnable: boolean
  needsClarification: boolean
  clarificationOptions?: ClarificationOption[]
  suggestedFocus?: string
  convertedGoal?: string
  phases?: string[]
  confidence: number
  // Non-educational request handling
  isNonEducational: boolean
  nonEducationalDomain?: NonEducationalDomain
  featureComingSoon?: string
  educationalAlternatives?: ClarificationOption[]
}

interface UseGoalAnalyzerState {
  loading: boolean
  error: string | null
  analysis: GoalAnalysis | null
}

// Helper for fetch with session refresh
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const supabase = createClient()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options)

    if (response.status === 401 && attempt < maxRetries - 1) {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session) {
        continue
      }
    }

    return response
  }

  return fetch(url, options)
}

export function useGoalAnalyzer() {
  const [state, setState] = useState<UseGoalAnalyzerState>({
    loading: false,
    error: null,
    analysis: null,
  })

  /**
   * Analyze a goal to determine if it needs clarification
   */
  const analyzeGoal = useCallback(async (goal: string): Promise<GoalAnalysis | null> => {
    if (!goal.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter a goal' }))
      return null
    }

    setState({ loading: true, error: null, analysis: null })

    try {
      const response = await fetchWithRetry('/api/goal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ goal: goal.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze goal')
      }

      const data = await response.json()

      if (!data.success || !data.analysis) {
        throw new Error('Invalid response from goal analyzer')
      }

      setState({
        loading: false,
        error: null,
        analysis: data.analysis,
      })

      return data.analysis
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze goal'
      setState({
        loading: false,
        error: message,
        analysis: null,
      })
      return null
    }
  }, [])

  /**
   * Clear the analysis and reset state
   */
  const clearAnalysis = useCallback(() => {
    setState({
      loading: false,
      error: null,
      analysis: null,
    })
  }, [])

  /**
   * Clear just the error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  /**
   * Check if a goal needs clarification (quick check without full analysis)
   */
  const quickCheck = useCallback((goal: string): {
    mightNeedClarification: boolean
    reason?: string
  } => {
    const g = goal.toLowerCase().trim()

    // Very short goals likely need clarification
    if (g.length < 20) {
      return { mightNeedClarification: true, reason: 'Goal is too brief' }
    }

    // Vague goal patterns
    const vaguePatterns = [
      /^(become|be)\s+(a|an|the|better)/i,
      /^(get|make)\s+(better|good|rich|successful)/i,
      /^(learn|study|master)\s+\w+$/i, // Single word after learn
      /^(improve|enhance)\s+(my|the)/i,
      /^(start|begin)\s+(a|my)/i,
    ]

    for (const pattern of vaguePatterns) {
      if (pattern.test(g)) {
        return { mightNeedClarification: true, reason: 'Goal may be too vague' }
      }
    }

    // Long-term ambitious goals
    const ambitiousPatterns = [
      /president|ceo|millionaire|billionaire|famous|celebrity/i,
      /change\s+the\s+world|world\s+domination/i,
      /retire\s+(early|young|rich)/i,
    ]

    for (const pattern of ambitiousPatterns) {
      if (pattern.test(g)) {
        return { mightNeedClarification: true, reason: 'Ambitious goal - needs breakdown' }
      }
    }

    return { mightNeedClarification: false }
  }, [])

  return {
    // State
    loading: state.loading,
    error: state.error,
    analysis: state.analysis,

    // Actions
    analyzeGoal,
    clearAnalysis,
    clearError,
    quickCheck,

    // Derived
    needsClarification: state.analysis?.needsClarification ?? false,
    isDirectlyLearnable: state.analysis?.isDirectlyLearnable ?? false,
    isNonEducational: state.analysis?.isNonEducational ?? false,
    nonEducationalDomain: state.analysis?.nonEducationalDomain,
    featureComingSoon: state.analysis?.featureComingSoon,
    educationalAlternatives: state.analysis?.educationalAlternatives,
  }
}
