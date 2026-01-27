'use client'

/**
 * SHARING HOOK
 *
 * Manages roadmap sharing functionality.
 * Provides:
 * - List user's shared roadmaps
 * - Share a roadmap
 * - Update visibility
 * - Unshare
 * - Copy shared roadmap
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ============================================
// TYPES
// ============================================

export interface SharedRoadmap {
  id: string
  shareCode: string
  title: string
  goal: string
  subject: string | null
  totalSteps: number
  estimatedMinutes: number
  completedAt: string | null
  viewCount: number
  copyCount: number
  isPublic: boolean
  createdAt: string
  shareUrl: string
}

export interface PublicSharedRoadmap {
  id: string
  shareCode: string
  title: string
  goal: string
  overview: string | null
  subject: string | null
  totalSteps: number
  estimatedMinutes: number
  completedAt: string | null
  viewCount: number
  copyCount: number
  allowCopy: boolean
  createdAt: string
  roadmap: {
    pitfalls: string[]
    successLooksLike: string | null
    steps: {
      order: number
      title: string
      description: string
      timeframe: string | null
      method: string | null
      avoid: string | null
      doneWhen: string | null
      duration: number | null
    }[]
  }
}

// Query keys
const SHARED_KEY = ['shared']

// ============================================
// USER'S SHARED ROADMAPS HOOK
// ============================================

interface UseMySharedReturn {
  shared: SharedRoadmap[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  shareRoadmap: (roadmapId: string, userName?: string) => Promise<SharedRoadmap | null>
  updateVisibility: (shareId: string, isPublic: boolean) => Promise<boolean>
  unshare: (shareId: string) => Promise<boolean>
}

export function useMyShared(): UseMySharedReturn {
  const queryClient = useQueryClient()

  // Fetch user's shared roadmaps
  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: SHARED_KEY,
    queryFn: async () => {
      const response = await fetch('/api/share')
      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return []
        }
        throw new Error(responseData.error || 'Failed to fetch shared roadmaps')
      }

      return responseData.shared as SharedRoadmap[]
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  })

  // Share roadmap mutation
  const shareMutation = useMutation({
    mutationFn: async ({ roadmapId, userName }: { roadmapId: string; userName?: string }) => {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmapId, userName }),
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to share roadmap')
      }
      return responseData.shared as SharedRoadmap
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHARED_KEY })
    },
  })

  // Update visibility mutation
  const updateMutation = useMutation({
    mutationFn: async ({ shareId, isPublic }: { shareId: string; isPublic: boolean }) => {
      const response = await fetch(`/api/share/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update share')
      }
      return responseData.shared
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHARED_KEY })
    },
  })

  // Unshare mutation
  const unshareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const response = await fetch(`/api/share/${shareId}`, {
        method: 'DELETE',
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to unshare')
      }
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHARED_KEY })
    },
  })

  // Action functions
  const shareRoadmap = useCallback(async (
    roadmapId: string,
    userName?: string
  ): Promise<SharedRoadmap | null> => {
    try {
      return await shareMutation.mutateAsync({ roadmapId, userName })
    } catch {
      return null
    }
  }, [shareMutation])

  const updateVisibility = useCallback(async (
    shareId: string,
    isPublic: boolean
  ): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({ shareId, isPublic })
      return true
    } catch {
      return false
    }
  }, [updateMutation])

  const unshare = useCallback(async (shareId: string): Promise<boolean> => {
    try {
      await unshareMutation.mutateAsync(shareId)
      return true
    } catch {
      return false
    }
  }, [unshareMutation])

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    shared: data ?? [],
    isLoading,
    error: queryError
      ? (queryError instanceof Error ? queryError.message : 'Failed to load shared roadmaps')
      : null,
    refresh,
    shareRoadmap,
    updateVisibility,
    unshare,
  }
}

// ============================================
// VIEW SHARED ROADMAP HOOK
// ============================================

interface UseSharedRoadmapReturn {
  shared: PublicSharedRoadmap | null
  isLoading: boolean
  error: string | null
  copyToAccount: () => Promise<string | null>
  isCopying: boolean
}

export function useSharedRoadmap(shareCode: string): UseSharedRoadmapReturn {
  const queryClient = useQueryClient()

  // Fetch shared roadmap
  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['shared', shareCode],
    queryFn: async () => {
      const response = await fetch(`/api/shared/${shareCode}`)
      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(responseData.error || 'Failed to fetch shared roadmap')
      }

      return responseData.shared as PublicSharedRoadmap
    },
    enabled: !!shareCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })

  // Copy mutation
  const copyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/shared/${shareCode}/copy`, {
        method: 'POST',
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to copy roadmap')
      }
      return responseData.roadmapId as string
    },
    onSuccess: () => {
      // Invalidate active roadmap query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['activeRoadmap'] })
    },
  })

  const copyToAccount = useCallback(async (): Promise<string | null> => {
    try {
      return await copyMutation.mutateAsync()
    } catch {
      return null
    }
  }, [copyMutation])

  return {
    shared: data ?? null,
    isLoading,
    error: queryError
      ? (queryError instanceof Error ? queryError.message : 'Failed to load shared roadmap')
      : null,
    copyToAccount,
    isCopying: copyMutation.isPending,
  }
}
