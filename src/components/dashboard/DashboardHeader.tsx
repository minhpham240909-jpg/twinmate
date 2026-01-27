'use client'

/**
 * Dashboard Header Component
 * Displays logo, user level, streak, and notifications
 */

import { memo } from 'react'
import Image from 'next/image'
import { Bell, Zap } from 'lucide-react'
import { calculateLevel } from './utils'

interface DashboardHeaderProps {
  isGuest: boolean
  stats: { streak: number; points: number } | null
  identity?: { archetype?: string; strengths: string[] }
  onNotificationClick: () => void
  unreadCount: number
}

export const DashboardHeader = memo(function DashboardHeader({
  isGuest,
  stats,
  identity,
  onNotificationClick,
  unreadCount,
}: DashboardHeaderProps) {
  // Calculate level data
  const levelData = stats ? calculateLevel(stats.points) : null

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-900">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Clerva"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            {identity?.archetype && !isGuest && (
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {identity.archetype}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isGuest && stats && levelData && (
              <>
                {/* Streak badge */}
                {stats.streak > 0 && (
                  <div
                    className="relative group flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg cursor-help"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {stats.streak}
                    </span>
                    {/* Tooltip */}
                    <div className="absolute top-full right-0 mt-1 px-3 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      Daily streak: {stats.streak} day{stats.streak > 1 ? 's' : ''} in a row
                      <div className="absolute -top-1 right-3 w-2 h-2 bg-neutral-900 dark:bg-white rotate-45" />
                    </div>
                  </div>
                )}

                {/* Level badge with progress bar */}
                <div
                  className="relative group flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg cursor-help border border-blue-100 dark:border-blue-900/50"
                >
                  {/* Level number with ring */}
                  <div className="relative">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {levelData.level}
                      </span>
                    </div>
                    {/* Progress ring (simplified) */}
                    <svg className="absolute -inset-0.5 w-6 h-6 -rotate-90">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-blue-200 dark:text-blue-900/50"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${levelData.progress * 0.628} 100`}
                        className="text-blue-500"
                      />
                    </svg>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 leading-tight">
                      Level {levelData.level}
                    </span>
                    <span className="text-[9px] text-blue-500 dark:text-blue-400 leading-tight">
                      {levelData.currentXP}/{levelData.xpForNextLevel} XP
                    </span>
                  </div>

                  {/* Detailed tooltip */}
                  <div className="absolute top-full right-0 mt-1 px-3 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 min-w-[160px]">
                    <div className="font-semibold mb-1">Level {levelData.level}</div>
                    <div className="text-neutral-400 dark:text-neutral-600 text-[11px] mb-2">
                      {stats.points} total XP earned
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1.5 bg-neutral-700 dark:bg-neutral-200 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${levelData.progress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-500">
                      {levelData.xpForNextLevel - levelData.currentXP} XP to Level {levelData.level + 1}
                    </div>
                    <div className="absolute -top-1 right-3 w-2 h-2 bg-neutral-900 dark:bg-white rotate-45" />
                  </div>
                </div>
              </>
            )}

            {!isGuest && (
              <button
                onClick={onNotificationClick}
                className="relative p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
})
