/**
 * ROADMAP LIST HOOK
 *
 * React hook for managing multiple roadmaps:
 * - Fetch all user's roadmaps
 * - Switch active roadmap
 * - Archive/pause roadmaps
 * - Delete roadmaps
 * - Filter and search
 */

'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Types
export interface RoadmapSummary {
  id: string
  title: string
  goal: string
  subject: string | null
  overview?: string
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  isActive: boolean
  progress: {
    completed: number
    total: number
    percentage: number
    currentStepIndex?: number
  }
  time: {
    estimated: number
    spent: number
  }
  steps?: {
    id: string
    order: number
    title: string
    description: string
    status: string
    duration: number
  }[]
  createdAt: string
  lastActivityAt: string
  completedAt: string | null
}

export interface RoadmapListFilters {
  status?: 'active' | 'paused' | 'completed' | 'all'
  search?: string
  sortBy?: 'recent' | 'oldest' | 'progress' | 'name'
}

export interface RoadmapListState {
  roadmaps: RoadmapSummary[]
  total: number
  hasMore: boolean
  loading: boolean
  error: string | null
  filters: RoadmapListFilters
}

// Helper for fetch with retry and session refresh
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  const supabase = createClient()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options)

    if (response.status === 401 && attempt < maxRetries - 1) {
      // Try to refresh session
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session) {
        // Session refreshed, retry the request
        continue
      }
    }

    return response
  }

  // Final attempt
  return fetch(url, options)
}

export function useRoadmapList() {
  const [state, setState] = useState<RoadmapListState>({
    roadmaps: [],
    total: 0,
    hasMore: false,
    loading: false,
    error: null,
    filters: {
      status: 'all',
      sortBy: 'recent',
    },
  })

  /**
   * Fetch roadmaps with optional filters
   */
  const fetchRoadmaps = useCallback(async (filters?: RoadmapListFilters, append = false) => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      filters: filters || prev.filters,
    }))

    try {
      const params = new URLSearchParams()
      const activeFilters = filters || state.filters

      if (activeFilters.status) params.set('status', activeFilters.status)
      if (activeFilters.search) params.set('search', activeFilters.search)
      if (activeFilters.sortBy) params.set('sortBy', activeFilters.sortBy)

      if (append) {
        params.set('offset', String(state.roadmaps.length))
      }

      const response = await fetchWithRetry(`/api/roadmap/list?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch roadmaps')
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        roadmaps: append ? [...prev.roadmaps, ...data.roadmaps] : data.roadmaps,
        total: data.total,
        hasMore: data.hasMore,
        loading: false,
      }))

      return data.roadmaps
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch roadmaps'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw error
    }
  }, [state.filters, state.roadmaps.length])

  /**
   * Load more roadmaps (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loading) return
    await fetchRoadmaps(undefined, true)
  }, [state.hasMore, state.loading, fetchRoadmaps])

  /**
   * Set a roadmap as active
   */
  const activateRoadmap = useCallback(async (roadmapId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetchWithRetry(`/api/roadmap/${roadmapId}/activate`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to activate roadmap')
      }

      const data = await response.json()

      // Update local state - mark this one as active, others as not
      setState(prev => ({
        ...prev,
        loading: false,
        roadmaps: prev.roadmaps.map(r => ({
          ...r,
          isActive: r.id === roadmapId,
          status: r.id === roadmapId
            ? (r.status === 'completed' ? 'completed' : 'active')
            : (r.isActive ? 'paused' : r.status),
        })),
      }))

      return data.roadmap
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to activate roadmap'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  /**
   * Archive (pause) a roadmap
   */
  const archiveRoadmap = useCallback(async (roadmapId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetchWithRetry(`/api/roadmap/${roadmapId}/archive`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to archive roadmap')
      }

      const data = await response.json()

      // Update local state
      setState(prev => ({
        ...prev,
        loading: false,
        roadmaps: prev.roadmaps.map(r =>
          r.id === roadmapId
            ? { ...r, status: 'paused' as const, isActive: false }
            : r
        ),
      }))

      return data.roadmap
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to archive roadmap'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  /**
   * Delete a roadmap
   */
  const deleteRoadmap = useCallback(async (roadmapId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetchWithRetry(`/api/roadmap/${roadmapId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete roadmap')
      }

      // Remove from local state
      setState(prev => ({
        ...prev,
        loading: false,
        roadmaps: prev.roadmaps.filter(r => r.id !== roadmapId),
        total: prev.total - 1,
      }))

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete roadmap'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  /**
   * Get a specific roadmap by ID
   */
  const getRoadmap = useCallback(async (roadmapId: string) => {
    try {
      const response = await fetchWithRetry(`/api/roadmap/${roadmapId}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch roadmap')
      }

      const data = await response.json()
      return data.roadmap
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch roadmap'
      setState(prev => ({ ...prev, error: message }))
      throw error
    }
  }, [])

  /**
   * Update filters
   */
  const setFilters = useCallback((newFilters: Partial<RoadmapListFilters>) => {
    const updatedFilters = { ...state.filters, ...newFilters }
    fetchRoadmaps(updatedFilters)
  }, [state.filters, fetchRoadmaps])

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  /**
   * Get counts by status (useful for tabs)
   */
  const getStatusCounts = useCallback(() => {
    const counts = {
      all: state.roadmaps.length,
      active: 0,
      paused: 0,
      completed: 0,
    }

    state.roadmaps.forEach(r => {
      if (r.status === 'active' || r.isActive) counts.active++
      else if (r.status === 'paused') counts.paused++
      else if (r.status === 'completed') counts.completed++
    })

    return counts
  }, [state.roadmaps])

  return {
    // State
    roadmaps: state.roadmaps,
    total: state.total,
    hasMore: state.hasMore,
    loading: state.loading,
    error: state.error,
    filters: state.filters,

    // Actions
    fetchRoadmaps,
    loadMore,
    activateRoadmap,
    archiveRoadmap,
    deleteRoadmap,
    getRoadmap,
    setFilters,
    clearError,

    // Helpers
    getStatusCounts,
  }
}
