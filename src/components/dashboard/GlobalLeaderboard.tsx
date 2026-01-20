'use client'

/**
 * Global Leaderboard Component
 *
 * Displays the top 5 users with the most total study minutes.
 * Uses progressive disclosure - locked until user completes enough sessions.
 *
 * Features:
 * - Rank badges (gold, silver, bronze)
 * - Total study time display
 * - Session count
 * - 24h refresh indicator
 * - Locked state for new users
 */

import { useState, useEffect } from 'react'
import { Trophy, Lock, Clock, RefreshCw, User, Flame } from 'lucide-react'
import Image from 'next/image'

interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatarUrl: string | null
  totalMinutes: number
  sessionCount: number
}

interface UserRankInfo {
  rank: number | null
  totalMinutes: number
  sessionCount: number
  isInTop5: boolean
}

interface GlobalLeaderboardProps {
  isLocked?: boolean
  className?: string
}

export default function GlobalLeaderboard({
  isLocked = false,
  className = '',
}: GlobalLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentUser, setCurrentUser] = useState<UserRankInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Fetch leaderboard data
  useEffect(() => {
    if (isLocked) {
      setIsLoading(false)
      return
    }

    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/leaderboard')
        if (response.ok) {
          const data = await response.json()
          setLeaderboard(data.leaderboard || [])
          setCurrentUser(data.currentUser || null)
          setLastUpdated(data.lastUpdated)
        } else {
          setError('Failed to load leaderboard')
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
        setError('Failed to load leaderboard')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [isLocked])

  // Format minutes to readable string
  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours}h`
    }
    return `${hours}h ${mins}m`
  }

  // Get time since last update
  const getTimeSinceUpdate = (): string => {
    if (!lastUpdated) return ''
    const now = new Date()
    const updated = new Date(lastUpdated)
    const diffMs = now.getTime() - updated.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 1) return 'Updated recently'
    if (diffHours === 1) return 'Updated 1 hour ago'
    if (diffHours < 24) return `Updated ${diffHours} hours ago`
    return 'Updated today'
  }

  // Get rank badge color
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30">
            <Trophy className="w-4 h-4 text-white" />
          </div>
        )
      case 2:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-lg shadow-gray-400/30">
            <span className="text-sm font-bold text-white">2</span>
          </div>
        )
      case 3:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg shadow-amber-600/30">
            <span className="text-sm font-bold text-white">3</span>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">{rank}</span>
          </div>
        )
    }
  }

  // Get avatar or initials
  const getAvatar = (entry: LeaderboardEntry) => {
    if (entry.avatarUrl) {
      return (
        <Image
          src={entry.avatarUrl}
          alt={entry.name}
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover"
        />
      )
    }

    const initials = entry.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    return (
      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          {initials || <User className="w-4 h-4" />}
        </span>
      </div>
    )
  }

  // Locked state
  if (isLocked) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-neutral-900 dark:text-white">Leaderboard</h3>
          </div>
          <Lock className="w-4 h-4 text-neutral-400" />
        </div>

        {/* Locked content */}
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-neutral-400" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            Complete more sessions to unlock
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            See how you rank among top students
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">Leaderboard</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
              <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-1" />
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">Leaderboard</h3>
        </div>
        <div className="text-center py-6 text-neutral-500 dark:text-neutral-400">
          {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (leaderboard.length === 0) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">Leaderboard</h3>
        </div>
        <div className="text-center py-6 text-neutral-500 dark:text-neutral-400">
          No leaderboard data yet. Be the first!
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">Top Studiers</h3>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            <RefreshCw className="w-3 h-3" />
            <span>{getTimeSinceUpdate()}</span>
          </div>
        )}
      </div>

      {/* Leaderboard list */}
      <div className="space-y-3">
        {leaderboard.map((entry) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
              entry.rank === 1
                ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border border-yellow-200/50 dark:border-yellow-800/30'
                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
            }`}
          >
            {/* Rank badge */}
            {getRankBadge(entry.rank)}

            {/* Avatar */}
            {getAvatar(entry)}

            {/* Name and stats */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 dark:text-white truncate">
                {entry.name}
              </p>
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatMinutes(entry.totalMinutes)}
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {entry.sessionCount} sessions
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Your Rank Section - Shows if user is not in top 5 */}
      {currentUser && !currentUser.isInTop5 && currentUser.rank && (
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {currentUser.rank}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">Your Rank</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatMinutes(currentUser.totalMinutes)} · {currentUser.sessionCount} sessions
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {currentUser.rank <= 10 ? 'Almost there!' : 'Keep studying!'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
          Rankings update every 24 hours
        </p>
      </div>
    </div>
  )
}
