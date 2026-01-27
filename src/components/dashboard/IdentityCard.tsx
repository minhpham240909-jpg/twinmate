'use client'

/**
 * Identity Card Component
 * Shows user's learning identity (lock-in) with archetype and strengths
 */

import { memo } from 'react'
import { Trophy, TrendingUp } from 'lucide-react'
import type { UserIdentity } from './types'

interface IdentityCardProps {
  identity: UserIdentity
  stats: { streak: number; points: number } | null
}

export const IdentityCard = memo(function IdentityCard({
  identity,
  stats,
}: IdentityCardProps) {
  if (!identity.archetype && identity.strengths.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          {identity.archetype && (
            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {identity.archetype}
            </h3>
          )}
          <p className="text-sm text-indigo-600 dark:text-indigo-400">
            Your learning identity
          </p>
        </div>
        <Trophy className="w-8 h-8 text-indigo-400" />
      </div>

      {identity.strengths.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1.5">
            Your Strengths
          </p>
          <div className="flex flex-wrap gap-1.5">
            {identity.strengths.map((strength, i) => (
              <span
                key={i}
                className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full"
              >
                {strength}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats && stats.streak > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-800/50">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <span className="text-sm text-indigo-700 dark:text-indigo-300">
            {stats.streak} day streak. Consistency builds mastery.
          </span>
        </div>
      )}
    </div>
  )
})
