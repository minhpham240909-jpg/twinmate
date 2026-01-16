'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ShopItem {
  id: string
  itemId: string
  name: string
  description: string | null
  category: 'THEME' | 'SOUND' | 'STREAK_SHIELD' | 'FEATURE'
  pointsCost: number
  icon: string | null
  isOwned: boolean
  isActive: boolean
  quantity: number
  canAfford: boolean
}

interface ShopData {
  success: boolean
  items: {
    THEME: ShopItem[]
    SOUND: ShopItem[]
    STREAK_SHIELD: ShopItem[]
    FEATURE: ShopItem[]
  }
  userPoints: number
  streakShields: number
  totalCompletedSessions: number
}

/**
 * React Query hook for shop data
 * - Caches data for 5 minutes
 * - Invalidates on purchase/activate
 */
export function useShopData() {
  return useQuery<ShopData>({
    queryKey: ['shopData'],
    queryFn: async () => {
      const response = await fetch('/api/shop/items')
      if (!response.ok) {
        throw new Error('Failed to fetch shop data')
      }
      return response.json()
    },
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })
}

/**
 * Mutation hook for purchasing items
 * Automatically invalidates shop data cache on success
 */
export function usePurchaseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Purchase failed')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate shop data to refresh
      queryClient.invalidateQueries({ queryKey: ['shopData'] })
      // Also invalidate user stats (points changed)
      queryClient.invalidateQueries({ queryKey: ['userStats'] })
    },
  })
}

/**
 * Mutation hook for activating items
 * Automatically invalidates shop data cache on success
 */
export function useActivateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch('/api/shop/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Activation failed')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate shop data to refresh
      queryClient.invalidateQueries({ queryKey: ['shopData'] })
    },
  })
}
