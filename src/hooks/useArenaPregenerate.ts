/**
 * Arena Pre-generation Hook
 *
 * Provides background question generation for faster arena creation.
 *
 * Features:
 * - Starts generating when user types topic (debounced)
 * - Shows streaming progress as questions are generated
 * - Caches results for instant arena creation
 * - Handles errors gracefully
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { GeneratedQuestion } from '@/lib/arena/types'

export interface PregenerateState {
  status: 'idle' | 'generating' | 'complete' | 'error'
  questions: GeneratedQuestion[]
  progress: number // 0-100
  cached: boolean
  error: string | null
}

export interface UsePregenerateOptions {
  debounceMs?: number
  minTopicLength?: number
}

export function useArenaPregenerate(options: UsePregenerateOptions = {}) {
  const { debounceMs = 800, minTopicLength = 3 } = options

  const [state, setState] = useState<PregenerateState>({
    status: 'idle',
    questions: [],
    progress: 0,
    cached: false,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentTopicRef = useRef<string>('')

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  /**
   * Start background generation for a topic
   */
  const startGeneration = useCallback(async (
    topic: string,
    count: number = 10,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) => {
    // Abort any existing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Reset state
    setState({
      status: 'generating',
      questions: [],
      progress: 0,
      cached: false,
      error: null,
    })

    currentTopicRef.current = topic
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/arena/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'AI_GENERATED', topic, count, difficulty }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to start generation')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      const questions: GeneratedQuestion[] = []
      let isCached = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'question') {
              questions.push(data.question)
              isCached = data.cached || isCached

              // Update state with new question
              setState(prev => ({
                ...prev,
                questions: [...questions],
                progress: Math.round((questions.length / count) * 100),
                cached: isCached,
              }))
            } else if (data.type === 'complete') {
              setState(prev => ({
                ...prev,
                status: 'complete',
                progress: 100,
                cached: data.cached,
              }))
            } else if (data.type === 'error') {
              console.error('[Pregenerate] Stream error:', data.message)
            }
          } catch (parseError) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Generation was cancelled, ignore
        return
      }

      console.error('[Pregenerate] Error:', error)
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Generation failed',
      }))
    }
  }, [])

  /**
   * Debounced topic change handler
   * Call this when the user types in the topic field
   */
  const onTopicChange = useCallback((
    topic: string,
    count: number = 10,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Don't generate for short topics
    if (topic.trim().length < minTopicLength) {
      setState({
        status: 'idle',
        questions: [],
        progress: 0,
        cached: false,
        error: null,
      })
      return
    }

    // Debounce the generation
    debounceTimerRef.current = setTimeout(() => {
      startGeneration(topic, count, difficulty)
    }, debounceMs)
  }, [debounceMs, minTopicLength, startGeneration])

  /**
   * Cancel any ongoing generation
   */
  const cancel = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState({
      status: 'idle',
      questions: [],
      progress: 0,
      cached: false,
      error: null,
    })
  }, [])

  /**
   * Get the pre-generated questions (if ready)
   */
  const getQuestions = useCallback((): GeneratedQuestion[] | null => {
    if (state.status === 'complete' && state.questions.length > 0) {
      return state.questions
    }
    return null
  }, [state])

  /**
   * Check if generation is ready for a specific topic
   */
  const isReady = useCallback((topic: string): boolean => {
    return (
      state.status === 'complete' &&
      state.questions.length > 0 &&
      currentTopicRef.current === topic
    )
  }, [state])

  return {
    state,
    onTopicChange,
    startGeneration,
    cancel,
    getQuestions,
    isReady,
  }
}
