'use client'

/**
 * Celebration Modal
 *
 * Displays when user earns a new milestone.
 * Clean, simple animation without being overwhelming.
 */

import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { type MilestoneDefinition, RARITY_COLORS } from '@/lib/milestones'

interface CelebrationModalProps {
  milestone: MilestoneDefinition | null
  xpAwarded: number
  onClose: () => void
}

export default function CelebrationModal({
  milestone,
  xpAwarded,
  onClose,
}: CelebrationModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (milestone) {
      // Small delay before showing for smooth entrance
      const showTimer = setTimeout(() => {
        setIsVisible(true)
        setIsAnimating(true)
      }, 100)

      // Auto-close after 4 seconds
      const closeTimer = setTimeout(() => {
        handleClose()
      }, 4000)

      return () => {
        clearTimeout(showTimer)
        clearTimeout(closeTimer)
      }
    }
  }, [milestone])

  const handleClose = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 300)
  }

  if (!milestone || !isVisible) return null

  const rarityColors = RARITY_COLORS[milestone.rarity]

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transition-all duration-300 ${
          isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Sparkle decoration */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-yellow-100/50 to-transparent dark:from-yellow-900/20 pointer-events-none" />

        {/* Content */}
        <div className="relative pt-8 pb-6 px-6 text-center">
          {/* Floating sparkles animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <Sparkles
                key={i}
                className={`absolute w-4 h-4 text-yellow-400 opacity-60 animate-pulse`}
                style={{
                  top: `${20 + Math.random() * 40}%`,
                  left: `${10 + Math.random() * 80}%`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          {/* Achievement unlocked text */}
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-4 uppercase tracking-wide">
            Milestone Unlocked!
          </p>

          {/* Icon */}
          <div
            className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center text-4xl shadow-lg border-2 ${rarityColors.bg} ${rarityColors.border}`}
          >
            {milestone.icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
            {milestone.name}
          </h2>

          {/* Description */}
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
            {milestone.description}
          </p>

          {/* XP Bonus */}
          {xpAwarded > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              <span>+{xpAwarded} XP Bonus!</span>
            </div>
          )}

          {/* Rarity badge */}
          <div className="mt-4">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${rarityColors.text} ${rarityColors.bg}`}
            >
              {milestone.rarity}
            </span>
          </div>
        </div>

        {/* Bottom action */}
        <div className="px-6 pb-6">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-orange-500/25"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  )
}
