'use client'

import { useQuery } from '@tanstack/react-query'

export interface CustomizationItem {
  id: string
  itemId: string
  name: string
  description: string | null
  icon: string | null
  pointsCost: number
  previewUrl: string | null
  isOwned: boolean
  isActive: boolean
  canAfford: boolean
}

export interface CustomizationsData {
  success: boolean
  userPoints: number
  themes: CustomizationItem[]
  sounds: CustomizationItem[]
  ownedThemeIds: string[]
  ownedSoundIds: string[]
  activeThemeId: string | null
  activeSoundId: string | null
}

/**
 * React Query hook to fetch user's customizations (themes and sounds)
 * Used by Solo Study Room to show locked/unlocked items
 */
export function useCustomizations() {
  return useQuery<CustomizationsData>({
    queryKey: ['userCustomizations'],
    queryFn: async () => {
      const response = await fetch('/api/user/customizations')
      if (!response.ok) {
        throw new Error('Failed to fetch customizations')
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
 * Helper to check if a theme/sound ID is owned
 */
export function isItemOwned(
  itemId: string,
  ownedIds: string[] | undefined
): boolean {
  if (!ownedIds) return false
  return ownedIds.includes(itemId)
}

/**
 * Helper to check if a default item should be free
 * First item of each type is free by default
 */
export function isDefaultFreeItem(itemId: string): boolean {
  // The first/default items are always free
  const defaultFreeItems = [
    'theme_minimal',   // Default theme
    'sound_white_noise', // Default sound (procedural)
  ]
  return defaultFreeItems.includes(itemId)
}
