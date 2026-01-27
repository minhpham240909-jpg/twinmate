'use client'

/**
 * CAPTURES HOOK
 *
 * Manages learning captures (notes, photos, links, highlights, voice).
 * Provides:
 * - List captures with filters
 * - Create new captures
 * - Get due reviews
 * - Record review responses
 *
 * Uses React Query for caching and optimistic updates.
 */

import { useCallback, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================
// TYPES
// ============================================

export type CaptureType = 'NOTE' | 'PHOTO' | 'LINK' | 'HIGHLIGHT' | 'VOICE'
export type ReviewResponse = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export interface Capture {
  id: string
  type: CaptureType
  content: string
  title: string | null
  mediaUrl: string | null
  roadmapId: string | null
  stepId: string | null
  subject: string | null
  tags: string[]
  isFavorite: boolean
  nextReviewAt: string | null
  reviewCount: number
  retentionScore: number | null
  createdAt: string
}

export interface CaptureStats {
  total: number
  dueForReview: number
  averageRetention: number
  bySubject: Record<string, number>
}

export interface CreateCaptureInput {
  type?: CaptureType
  content: string
  title?: string
  mediaUrl?: string
  mediaType?: string
  roadmapId?: string
  stepId?: string
  subject?: string
  tags?: string[]
}

export interface CaptureFilters {
  roadmapId?: string
  stepId?: string
  subject?: string
  type?: CaptureType
  isFavorite?: boolean
  isArchived?: boolean
}

interface UseCapturesOptions {
  filters?: CaptureFilters
  limit?: number
  orderBy?: 'newest' | 'oldest' | 'nextReview'
  includeStats?: boolean
}

interface UseCapturesReturn {
  // State
  captures: Capture[]
  total: number
  hasMore: boolean
  stats: CaptureStats | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null

  // Actions
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  createCapture: (input: CreateCaptureInput) => Promise<Capture | null>
  toggleFavorite: (captureId: string, isFavorite: boolean) => Promise<boolean>
  deleteCapture: (captureId: string) => Promise<boolean>
}

// Query keys
const CAPTURES_KEY = ['captures']

// ============================================
// HOOK
// ============================================

export function useCaptures(options: UseCapturesOptions = {}): UseCapturesReturn {
  const { filters, limit = 20, orderBy = 'newest', includeStats = false } = options
  const queryClient = useQueryClient()

  // Track pagination offset internally
  const [offset, setOffset] = useState(0)
  const [allCaptures, setAllCaptures] = useState<Capture[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Build query key with filters (without offset for initial load)
  const queryKey = [
    ...CAPTURES_KEY,
    { filters, limit, orderBy, includeStats },
  ]

  // Fetch captures
  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters?.roadmapId) params.set('roadmapId', filters.roadmapId)
      if (filters?.stepId) params.set('stepId', filters.stepId)
      if (filters?.subject) params.set('subject', filters.subject)
      if (filters?.type) params.set('type', filters.type)
      if (filters?.isFavorite) params.set('isFavorite', 'true')
      if (filters?.isArchived) params.set('isArchived', 'true')
      params.set('limit', limit.toString())
      params.set('offset', '0')
      params.set('orderBy', orderBy)
      if (includeStats) params.set('includeStats', 'true')

      const response = await fetch(`/api/captures?${params.toString()}`)
      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return { captures: [], total: 0, hasMore: false, stats: null }
        }
        throw new Error(responseData.error || 'Failed to fetch captures')
      }

      return {
        captures: responseData.captures as Capture[],
        total: responseData.total as number,
        hasMore: responseData.hasMore as boolean,
        stats: responseData.stats as CaptureStats | null,
      }
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
  })

  // Sync initial data to allCaptures
  useEffect(() => {
    if (data?.captures && offset === 0) {
      setAllCaptures(data.captures)
    }
  }, [data?.captures, offset])

  // Create capture mutation with optimistic update
  const createCaptureMutation = useMutation({
    mutationFn: async (input: CreateCaptureInput) => {
      const response = await fetch('/api/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create capture')
      }
      return responseData.capture as Capture
    },
    onSuccess: (newCapture) => {
      // Optimistically add to top of list
      setAllCaptures((prev: Capture[]) => [newCapture, ...prev])
      queryClient.invalidateQueries({ queryKey: CAPTURES_KEY })
    },
  })

  // Toggle favorite mutation with optimistic update
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ captureId, isFavorite }: { captureId: string; isFavorite: boolean }) => {
      const response = await fetch(`/api/captures/${captureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite }),
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update capture')
      }
      return responseData.capture as Capture
    },
    onMutate: async ({ captureId, isFavorite }) => {
      // Optimistic update
      setAllCaptures((prev: Capture[]) =>
        prev.map((c: Capture) => c.id === captureId ? { ...c, isFavorite } : c)
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAPTURES_KEY })
    },
  })

  // Delete capture mutation with optimistic update
  const deleteCaptureMutation = useMutation({
    mutationFn: async (captureId: string) => {
      const response = await fetch(`/api/captures/${captureId}`, {
        method: 'DELETE',
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete capture')
      }
      return captureId
    },
    onMutate: async (captureId) => {
      // Optimistic removal
      setAllCaptures((prev: Capture[]) => prev.filter((c: Capture) => c.id !== captureId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAPTURES_KEY })
    },
  })

  // Actions
  const createCapture = useCallback(async (input: CreateCaptureInput): Promise<Capture | null> => {
    try {
      return await createCaptureMutation.mutateAsync(input)
    } catch {
      return null
    }
  }, [createCaptureMutation])

  const toggleFavorite = useCallback(async (captureId: string, isFavorite: boolean): Promise<boolean> => {
    try {
      await toggleFavoriteMutation.mutateAsync({ captureId, isFavorite })
      return true
    } catch {
      return false
    }
  }, [toggleFavoriteMutation])

  const deleteCapture = useCallback(async (captureId: string): Promise<boolean> => {
    try {
      await deleteCaptureMutation.mutateAsync(captureId)
      return true
    } catch {
      return false
    }
  }, [deleteCaptureMutation])

  const refresh = useCallback(async () => {
    setOffset(0)
    await refetch()
  }, [refetch])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !data?.hasMore) return

    setIsLoadingMore(true)
    const newOffset = offset + limit

    try {
      const params = new URLSearchParams()
      if (filters?.roadmapId) params.set('roadmapId', filters.roadmapId)
      if (filters?.stepId) params.set('stepId', filters.stepId)
      if (filters?.subject) params.set('subject', filters.subject)
      if (filters?.type) params.set('type', filters.type)
      if (filters?.isFavorite) params.set('isFavorite', 'true')
      if (filters?.isArchived) params.set('isArchived', 'true')
      params.set('limit', limit.toString())
      params.set('offset', newOffset.toString())
      params.set('orderBy', orderBy)

      const response = await fetch(`/api/captures?${params.toString()}`)
      const responseData = await response.json()

      if (response.ok && responseData.captures) {
        setAllCaptures((prev: Capture[]) => [...prev, ...responseData.captures])
        setOffset(newOffset)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, data?.hasMore, offset, limit, filters, orderBy])

  // Determine hasMore based on current state
  const hasMore = data?.hasMore ?? false

  return {
    captures: allCaptures.length > 0 ? allCaptures : (data?.captures ?? []),
    total: data?.total ?? 0,
    hasMore,
    stats: data?.stats ?? null,
    isLoading,
    isLoadingMore,
    error: queryError
      ? (queryError instanceof Error ? queryError.message : 'Failed to load captures')
      : null,
    refresh,
    loadMore,
    createCapture,
    toggleFavorite,
    deleteCapture,
  }
}

// ============================================
// DUE REVIEWS HOOK
// ============================================

interface UseDueReviewsReturn {
  dueCaptures: Capture[]
  total: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  recordReview: (captureId: string, response: ReviewResponse) => Promise<Capture | null>
}

export function useDueReviews(): UseDueReviewsReturn {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['captures', 'due'],
    queryFn: async () => {
      const response = await fetch('/api/captures/review/due')
      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return { captures: [], total: 0 }
        }
        throw new Error(responseData.error || 'Failed to fetch due reviews')
      }

      return {
        captures: responseData.captures as Capture[],
        total: responseData.total as number,
      }
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  })

  // Record review mutation
  const recordReviewMutation = useMutation({
    mutationFn: async ({ captureId, response }: { captureId: string; response: ReviewResponse }) => {
      const apiResponse = await fetch(`/api/captures/${captureId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })

      const responseData = await apiResponse.json()
      if (!apiResponse.ok) {
        throw new Error(responseData.error || 'Failed to record review')
      }
      return responseData.capture as Capture
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAPTURES_KEY })
      queryClient.invalidateQueries({ queryKey: ['captures', 'due'] })
    },
  })

  const recordReview = useCallback(async (captureId: string, response: ReviewResponse): Promise<Capture | null> => {
    try {
      return await recordReviewMutation.mutateAsync({ captureId, response })
    } catch {
      return null
    }
  }, [recordReviewMutation])

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    dueCaptures: data?.captures ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: queryError
      ? (queryError instanceof Error ? queryError.message : 'Failed to load due reviews')
      : null,
    refresh,
    recordReview,
  }
}
