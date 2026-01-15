'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, Shield, Palette, Volume2, Check, Lock, X, HelpCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

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

interface RewardsShopProps {
  isOpen: boolean
  onClose: () => void
}

// Minimum completed sessions before showing the shop (prevent early distraction)
const MIN_SESSIONS_TO_SHOW = 3

export default function RewardsShop({ isOpen, onClose }: RewardsShopProps) {
  const [data, setData] = useState<ShopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'THEME' | 'SOUND' | 'STREAK_SHIELD'>('THEME')
  const [showGuide, setShowGuide] = useState(false)

  const fetchShopData = useCallback(async () => {
    try {
      const response = await fetch('/api/shop/items')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch shop data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchShopData()
    }
  }, [isOpen, fetchShopData])

  const handlePurchase = async (itemId: string) => {
    setPurchasing(itemId)
    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message)
        fetchShopData() // Refresh data
      } else {
        toast.error(result.error || 'Purchase failed')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setPurchasing(null)
    }
  }

  const handleActivate = async (itemId: string) => {
    try {
      const response = await fetch('/api/shop/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message)
        fetchShopData()
      } else {
        toast.error(result.error || 'Activation failed')
      }
    } catch (error) {
      toast.error('Something went wrong')
    }
  }

  if (!isOpen) return null

  const tabs = [
    { key: 'THEME' as const, label: 'Themes', icon: Palette },
    { key: 'SOUND' as const, label: 'Sounds', icon: Volume2 },
    { key: 'STREAK_SHIELD' as const, label: 'Shields', icon: Shield },
  ]

  const currentItems = data?.items[activeTab] || []
  const totalSessions = data?.totalCompletedSessions || 0
  const isLocked = totalSessions < MIN_SESSIONS_TO_SHOW

  // If user hasn't completed enough sessions, show a locked state
  if (isLocked && !loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6 text-center shadow-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <Lock className="w-8 h-8 text-neutral-400" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            Progress Perks
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Complete {MIN_SESSIONS_TO_SHOW - totalSessions} more session{MIN_SESSIONS_TO_SHOW - totalSessions !== 1 ? 's' : ''} to unlock perks.
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-4">
            Focus on building your habit first — perks will be here when you&apos;re ready.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Progress Perks
            </h2>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {data?.userPoints || 0} Focus Points
              </span>
              {(data?.streakShields || 0) > 0 && (
                <>
                  <span className="mx-1.5 text-neutral-300 dark:text-neutral-700">•</span>
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {data?.streakShields} shield{data?.streakShields !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`p-2 rounded-lg transition-colors ${
                showGuide
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500'
              }`}
              title="How it works"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* How It Works Guide */}
        {showGuide && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              How Perks Work
            </h3>
            <div className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p><strong>Earn Focus Points</strong> by completing sessions. One more session = closer to your next perk.</p>
              </div>
              <div className="flex items-start gap-2">
                <Palette className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p><strong>Themes & Sounds</strong> customize your space. Your room improves as you improve.</p>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p><strong>Streak Shields</strong> protect your streak if you miss a day. Used automatically when needed.</p>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-3 italic">
              No purchases. Just progress.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              No items available
            </div>
          ) : (
            <div className="space-y-2">
              {currentItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    item.isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 flex items-center justify-center text-xl bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                    {item.icon || '🎁'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 dark:text-white">
                        {item.name}
                      </span>
                      {item.isActive && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {item.description}
                      </p>
                    )}
                    {item.category === 'STREAK_SHIELD' && item.isOwned && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        You have {item.quantity} shield{item.quantity !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0">
                    {item.isOwned && item.category !== 'STREAK_SHIELD' ? (
                      item.isActive ? (
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleActivate(item.itemId)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          Use
                        </button>
                      )
                    ) : item.pointsCost === 0 ? (
                      <button
                        onClick={() => handleActivate(item.itemId)}
                        className="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-lg"
                      >
                        Free
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePurchase(item.itemId)}
                        disabled={!item.canAfford || purchasing === item.itemId}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          item.canAfford
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        {purchasing === item.itemId ? (
                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        ) : !item.canAfford ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Star className="w-3.5 h-3.5" />
                        )}
                        {item.pointsCost}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 italic">
            Your space improves as you improve.
          </p>
        </div>
      </div>
    </div>
  )
}
