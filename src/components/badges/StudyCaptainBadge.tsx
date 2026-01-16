'use client'

import { Trophy, Crown, Star } from 'lucide-react'

interface StudyCaptainBadgeProps {
  userName?: string
  circleName?: string
  achievementMessage?: string
  totalMinutes?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'compact' | 'full'
  showTooltip?: boolean
  className?: string
}

/**
 * Study Captain Badge - Displays the weekly recognition badge
 * 
 * Designed to:
 * ✅ Inspire action - Shows achievement in a celebratory way
 * ✅ Strengthen class-level identity - Associates badge with the circle
 * ❌ Never shames - Only shows positive achievements
 */
export function StudyCaptainBadge({
  userName,
  circleName,
  achievementMessage,
  totalMinutes,
  size = 'md',
  variant = 'compact',
  showTooltip = true,
  className = '',
}: StudyCaptainBadgeProps) {
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 gap-1',
      icon: 'w-3 h-3',
      text: 'text-xs',
    },
    md: {
      container: 'px-3 py-1.5 gap-1.5',
      icon: 'w-4 h-4',
      text: 'text-sm',
    },
    lg: {
      container: 'px-4 py-2 gap-2',
      icon: 'w-5 h-5',
      text: 'text-base',
    },
  }

  const s = sizeClasses[size]

  // Compact variant - just the badge icon/label
  if (variant === 'compact') {
    return (
      <div
        className={`
          inline-flex items-center ${s.container}
          bg-gradient-to-r from-amber-100 to-yellow-100 
          dark:from-amber-900/30 dark:to-yellow-900/30
          border border-amber-300 dark:border-amber-700
          rounded-full
          ${className}
        `}
        title={showTooltip ? (achievementMessage || `Study Captain${circleName ? ` of ${circleName}` : ''}`) : undefined}
      >
        <Crown className={`${s.icon} text-amber-600 dark:text-amber-400`} />
        <span className={`${s.text} font-semibold text-amber-700 dark:text-amber-300`}>
          Captain
        </span>
      </div>
    )
  }

  // Full variant - with details
  return (
    <div
      className={`
        bg-gradient-to-br from-amber-50 to-yellow-50 
        dark:from-amber-900/20 dark:to-yellow-900/20
        border border-amber-200 dark:border-amber-800
        rounded-xl p-4
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-amber-800 dark:text-amber-200">
              Study Captain
            </h4>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          {userName && (
            <p className="text-sm text-amber-700 dark:text-amber-300 truncate">
              {userName}
            </p>
          )}
        </div>
      </div>

      {achievementMessage && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 leading-relaxed">
          {achievementMessage}
        </p>
      )}

      {(totalMinutes !== undefined || circleName) && (
        <div className="mt-3 flex items-center gap-4 text-xs text-amber-500 dark:text-amber-500">
          {totalMinutes !== undefined && (
            <span className="flex items-center gap-1">
              <span className="font-medium">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
              <span>studied</span>
            </span>
          )}
          {circleName && (
            <span className="truncate">in {circleName}</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * StudyCaptainIndicator - Small indicator for avatars/cards
 * Shows a small crown icon to indicate Study Captain status
 */
export function StudyCaptainIndicator({
  className = '',
}: {
  className?: string
}) {
  return (
    <div
      className={`
        absolute -top-1 -right-1
        w-5 h-5 
        bg-gradient-to-br from-amber-400 to-yellow-500 
        rounded-full 
        flex items-center justify-center
        shadow-md
        border-2 border-white dark:border-neutral-900
        ${className}
      `}
      title="Study Captain"
    >
      <Crown className="w-3 h-3 text-white" />
    </div>
  )
}

export default StudyCaptainBadge
