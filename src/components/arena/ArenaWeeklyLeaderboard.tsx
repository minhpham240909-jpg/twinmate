'use client'

/**
 * Arena Weekly Leaderboard Component
 *
 * Displays top 5 arena players for the current week.
 * Shows user's own rank if not in top 5.
 */

import { useState, useEffect } from 'react'
import { Trophy, Medal, Clock, Flame, Target, Loader2 } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/arena/types'

interface LeaderboardData {
  weekStart: string
  weekEnd: string
  leaderboard: LeaderboardEntry[]
  currentUser: LeaderboardEntry | null
}

export function ArenaWeeklyLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeUntilReset, setTimeUntilReset] = useState('')

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/arena/leaderboard')
        if (!response.ok) throw new Error('Failed to fetch leaderboard')
        const result = await response.json()
        if (result.success) {
          setData(result)
        } else {
          setError(result.error || 'Failed to load leaderboard')
        }
      } catch (err) {
        setError('Leaderboard temporarily unavailable')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
    // Refresh every minute
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => clearInterval(interval)
  }, [])

  // Calculate time until weekly reset
  useEffect(() => {
    if (!data?.weekEnd) return

    const updateCountdown = () => {
      const now = new Date()
      const reset = new Date(data.weekEnd)
      const diff = reset.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeUntilReset('Resetting...')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

      if (days > 0) {
        setTimeUntilReset(`${days}d ${hours}h`)
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        setTimeUntilReset(`${hours}h ${minutes}m`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000)
    return () => clearInterval(interval)
  }, [data?.weekEnd])

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
          {error || 'No leaderboard data'}
        </div>
      </div>
    )
  }

  const { leaderboard, currentUser } = data
  const isUserInTop5 = currentUser && leaderboard.some(e => e.userId === currentUser.userId)

  // Medal colors for top 3
  const getMedalStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-400 text-yellow-900'
      case 2:
        return 'bg-neutral-300 text-neutral-700'
      case 3:
        return 'bg-amber-600 text-amber-100'
      default:
        return 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Resets in {timeUntilReset}
          </span>
        </div>
      </div>

      {/* Leaderboard List */}
      {leaderboard.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Trophy className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-500 dark:text-neutral-400 font-medium">
            No champions yet this week
          </p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
            Be the first to compete!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {leaderboard.map((entry) => (
            <div
              key={entry.userId}
              className={`px-6 py-4 flex items-center gap-4 ${
                currentUser?.userId === entry.userId
                  ? 'bg-purple-50 dark:bg-purple-900/20'
                  : ''
              }`}
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getMedalStyle(
                  entry.rank
                )}`}
              >
                {entry.rank <= 3 ? (
                  <Medal className="w-4 h-4" />
                ) : (
                  entry.rank
                )}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden flex-shrink-0">
                {entry.avatarUrl ? (
                  <img
                    src={entry.avatarUrl}
                    alt={entry.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500 font-medium">
                    {entry.userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900 dark:text-white truncate">
                  {entry.userName}
                  {currentUser?.userId === entry.userId && (
                    <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">
                      (You)
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {entry.correctAnswers} correct
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {entry.bestStreak} streak
                  </span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right">
                <p className="font-bold text-lg text-neutral-900 dark:text-white">
                  {Math.round(entry.combinedScore).toLocaleString()}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {entry.gamesPlayed} games
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current user (if not in top 5) */}
      {currentUser && !isUserInTop5 && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="px-6 py-4 flex items-center gap-4 bg-purple-50 dark:bg-purple-900/20">
            {/* Rank */}
            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold text-neutral-600 dark:text-neutral-300">
              {currentUser.rank}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden flex-shrink-0">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500 font-medium">
                  {currentUser.userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral-900 dark:text-white truncate">
                {currentUser.userName}
                <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">
                  (You)
                </span>
              </p>
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {currentUser.correctAnswers} correct
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {currentUser.bestStreak} streak
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
              <p className="font-bold text-lg text-neutral-900 dark:text-white">
                {Math.round(currentUser.combinedScore).toLocaleString()}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {currentUser.gamesPlayed} games
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
