'use client'

import { useState, ReactNode } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, ChevronUp, Lock, Star, ShoppingBag } from 'lucide-react'
import { useCustomizations, type CustomizationItem } from '@/hooks/useCustomizations'
import toast from 'react-hot-toast'
import { usePurchaseItem, useActivateItem } from '@/hooks/useShopData'
import { useQueryClient } from '@tanstack/react-query'

// Virtual backgrounds for Solo Study
// These are the default/hardcoded backgrounds that map to shop items
export const SOLO_STUDY_BACKGROUNDS = [
  {
    id: 'library',
    itemId: 'theme_library',
    name: 'Library',
    bgClass: 'bg-gradient-to-br from-amber-900/90 via-neutral-900 to-neutral-950',
    previewColor: '#78350f',
    icon: '📚',
    imageUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&q=80',
  },
  {
    id: 'cafe',
    itemId: 'theme_cafe',
    name: 'Cafe',
    bgClass: 'bg-gradient-to-br from-orange-900/80 via-stone-900 to-neutral-950',
    previewColor: '#7c2d12',
    icon: '☕',
    imageUrl: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1920&q=80',
  },
  {
    id: 'nature',
    itemId: 'theme_nature',
    name: 'Nature',
    bgClass: 'bg-gradient-to-br from-green-900/80 via-emerald-950 to-neutral-950',
    previewColor: '#14532d',
    icon: '🌲',
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80',
  },
  {
    id: 'ocean',
    itemId: 'theme_ocean',
    name: 'Ocean',
    bgClass: 'bg-gradient-to-br from-blue-900/80 via-cyan-950 to-neutral-950',
    previewColor: '#1e3a5f',
    icon: '🌊',
    imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80',
  },
  {
    id: 'night',
    itemId: 'theme_night',
    name: 'Night Sky',
    bgClass: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-neutral-950',
    previewColor: '#1e1b4b',
    icon: '🌙',
    imageUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80',
  },
  {
    id: 'minimal',
    itemId: 'theme_minimal',
    name: 'Minimal',
    bgClass: 'bg-neutral-950',
    previewColor: '#0a0a0a',
    icon: '⬛',
    // No image - pure CSS for minimal distraction (FREE default)
  },
]

// Default free theme
const DEFAULT_FREE_THEME = 'minimal'

interface SoloStudyBackgroundProps {
  backgroundId: string
  children?: ReactNode
  onChangeBackground?: (bgId: string) => void
  showSelector?: boolean
}

export default function SoloStudyBackground({
  backgroundId,
  children,
  onChangeBackground,
  showSelector = false,
}: SoloStudyBackgroundProps) {
  const [showPanel, setShowPanel] = useState(false)
  const currentBg = SOLO_STUDY_BACKGROUNDS.find((b) => b.id === backgroundId) || SOLO_STUDY_BACKGROUNDS.find(b => b.id === DEFAULT_FREE_THEME) || SOLO_STUDY_BACKGROUNDS[0]

  // Fetch user's customizations
  const { data: customizations, isLoading } = useCustomizations()
  const purchaseMutation = usePurchaseItem()
  const activateMutation = useActivateItem()
  const queryClient = useQueryClient()

  // Check if a theme is owned
  const isThemeOwned = (themeItemId: string): boolean => {
    // Minimal theme is always free
    if (themeItemId === 'theme_minimal') return true
    if (!customizations?.ownedThemeIds) return false
    return customizations.ownedThemeIds.includes(themeItemId)
  }

  // Get theme info from shop data
  const getThemeInfo = (themeItemId: string): CustomizationItem | undefined => {
    return customizations?.themes.find(t => t.itemId === themeItemId)
  }

  // Handle purchase
  const handlePurchase = async (itemId: string) => {
    try {
      const result = await purchaseMutation.mutateAsync(itemId)
      toast.success(result.message || 'Theme purchased!')
      // Invalidate customizations cache
      queryClient.invalidateQueries({ queryKey: ['userCustomizations'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Purchase failed')
    }
  }

  // Handle activation (and selection)
  const handleSelectTheme = async (bgId: string, itemId: string) => {
    // Check if owned
    if (!isThemeOwned(itemId)) {
      const themeInfo = getThemeInfo(itemId)
      if (themeInfo && themeInfo.canAfford) {
        // Show purchase option
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span>Purchase this theme for {themeInfo.pointsCost} points?</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handlePurchase(itemId)
                  toast.dismiss(t.id)
                }}
                className="px-3 py-1 bg-amber-500 text-white rounded-lg text-sm font-medium"
              >
                Buy Now
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-neutral-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 5000 })
      } else {
        toast.error(`You need ${getThemeInfo(itemId)?.pointsCost || 'more'} Focus Points to unlock this theme`)
      }
      return
    }

    // Theme is owned - activate it
    try {
      await activateMutation.mutateAsync(itemId)
      // Invalidate customizations cache
      queryClient.invalidateQueries({ queryKey: ['userCustomizations'] })
      onChangeBackground?.(bgId)
      setShowPanel(false)
    } catch {
      // Still change locally even if activation fails
      onChangeBackground?.(bgId)
      setShowPanel(false)
    }
  }

  // If just rendering background without selector
  if (!showSelector) {
    return (
      <div className={`min-h-screen ${currentBg.bgClass} transition-colors duration-700 relative`}>
        {/* Background Image (if available) */}
        {currentBg.imageUrl && (
          <div className="fixed inset-0 z-0">
            <Image
              src={currentBg.imageUrl}
              alt={currentBg.name}
              fill
              className="object-cover"
              priority
              unoptimized // Use Unsplash's CDN directly
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        {/* Subtle animated overlay for depth */}
        <div className="fixed inset-0 pointer-events-none z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          </div>
        </div>
        <div className="relative z-20">
          {children}
        </div>
      </div>
    )
  }

  // Render selector button
  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
          showPanel
            ? 'bg-white/20 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
        }`}
        title="Change Background"
      >
        <ImageIcon className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">{currentBg.name}</span>
        <ChevronUp className={`w-4 h-4 transition-transform ${showPanel ? '' : 'rotate-180'}`} />
      </button>

      {/* Background Panel */}
      {showPanel && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white">Virtual Background</h4>
            {customizations && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <Star className="w-3 h-3" />
                <span>{customizations.userPoints}</span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {SOLO_STUDY_BACKGROUNDS.map((bg) => {
                const owned = isThemeOwned(bg.itemId)
                const themeInfo = getThemeInfo(bg.itemId)
                const canAfford = themeInfo?.canAfford ?? false
                const isPurchasing = purchaseMutation.isPending && purchaseMutation.variables === bg.itemId

                return (
                  <button
                    key={bg.id}
                    onClick={() => handleSelectTheme(bg.id, bg.itemId)}
                    disabled={isPurchasing}
                    className={`relative aspect-square rounded-xl overflow-hidden transition-all group ${
                      backgroundId === bg.id && owned
                        ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900'
                        : owned
                        ? 'hover:ring-2 hover:ring-neutral-600'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`absolute inset-0 ${bg.bgClass}`}
                      style={{ backgroundColor: bg.previewColor }}
                    />

                    {/* Locked overlay */}
                    {!owned && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center">
                        <Lock className="w-4 h-4 text-white/60 mb-0.5" />
                        <div className="flex items-center gap-0.5 text-amber-400">
                          <Star className="w-3 h-3" />
                          <span className="text-xs font-medium">{themeInfo?.pointsCost || '?'}</span>
                        </div>
                        {!canAfford && (
                          <span className="text-[10px] text-red-400 mt-0.5">Need more</span>
                        )}
                      </div>
                    )}

                    {/* Normal content */}
                    {owned && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl mb-1">{bg.icon}</span>
                        <span className="text-xs text-white font-medium">{bg.name}</span>
                      </div>
                    )}

                    {/* Selected indicator */}
                    {backgroundId === bg.id && owned && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Purchasing spinner */}
                    {isPurchasing && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">
              <Lock className="w-3 h-3 inline mr-1" />
              Unlock with Focus Points
            </p>
            <button
              onClick={() => {
                setShowPanel(false)
                // Navigate to shop or open shop modal
                window.dispatchEvent(new CustomEvent('openShop'))
              }}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <ShoppingBag className="w-3 h-3" />
              Shop
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
