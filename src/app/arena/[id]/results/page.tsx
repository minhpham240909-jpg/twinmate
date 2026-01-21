'use client'

/**
 * Arena Results Page
 *
 * Final leaderboard and game summary after arena ends.
 * Shows:
 * - Podium (top 3)
 * - Full rankings
 * - Personal stats
 * - XP earned
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Trophy,
  Medal,
  Flame,
  Target,
  Star,
  ArrowLeft,
  Share2,
  RotateCcw,
  Loader2,
  Crown,
} from 'lucide-react'

interface FinalRanking {
  rank: number
  participantId: string
  userId: string
  userName: string
  avatarUrl?: string | null
  score: number
  correctAnswers: number
  bestStreak: number
  xpEarned: number
}

interface ArenaResultsData {
  arena: {
    id: string
    title: string
    questionCount: number
    hostId: string
  }
  rankings: FinalRanking[]
  currentUser: FinalRanking | null
  stats: {
    totalQuestions: number
    avgAccuracy: number
    totalXPAwarded: number
  }
}

export default function ArenaResultsPage() {
  const router = useRouter()
  const params = useParams()
  const arenaId = params.id as string

  const [data, setData] = useState<ArenaResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch results
  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/arena/${arenaId}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to load results')
        return
      }

      // Transform participant data to rankings
      const rankings: FinalRanking[] = result.participants
        .sort((a: { totalScore: number }, b: { totalScore: number }) => b.totalScore - a.totalScore)
        .map((p: {
          id: string
          userId: string
          userName: string
          userAvatarUrl?: string | null
          totalScore: number
          correctAnswers: number
          bestStreak: number
          xpEarned: number
        }, index: number) => ({
          rank: index + 1,
          participantId: p.id,
          userId: p.userId,
          userName: p.userName,
          avatarUrl: p.userAvatarUrl,
          score: p.totalScore,
          correctAnswers: p.correctAnswers,
          bestStreak: p.bestStreak,
          xpEarned: p.xpEarned,
        }))

      const currentUserId = result.currentParticipant?.userId
      const currentUser = rankings.find((r: FinalRanking) => r.userId === currentUserId) || null

      const totalCorrect = rankings.reduce((sum: number, r: FinalRanking) => sum + r.correctAnswers, 0)
      const totalAnswers = rankings.length * result.arena.questionCount
      const avgAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0

      setData({
        arena: {
          id: result.arena.id,
          title: result.arena.title,
          questionCount: result.arena.questionCount,
          hostId: result.arena.hostId,
        },
        rankings,
        currentUser,
        stats: {
          totalQuestions: result.arena.questionCount,
          avgAccuracy,
          totalXPAwarded: rankings.reduce((sum: number, r: FinalRanking) => sum + r.xpEarned, 0),
        },
      })
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [arenaId])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])


  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Results not found'}</p>
          <button
            onClick={() => router.push('/arena')}
            className="px-6 py-3 bg-purple-600 rounded-xl font-semibold"
          >
            Back to Arena
          </button>
        </div>
      </div>
    )
  }

  const { arena, rankings, currentUser, stats } = data
  const top3 = rankings.slice(0, 3)

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean)

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-400'
      case 2:
        return 'text-neutral-300'
      case 3:
        return 'text-amber-600'
      default:
        return 'text-neutral-500'
    }
  }

  const getPodiumHeight = (rank: number) => {
    switch (rank) {
      case 1:
        return 'h-32'
      case 2:
        return 'h-24'
      case 3:
        return 'h-16'
      default:
        return 'h-12'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="border-b border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <h1 className="font-semibold">{arena.title}</h1>

          <button
            onClick={() => router.push('/arena/create')}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Play Again</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Podium */}
        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-4 mb-8">
            {podiumOrder.map((player, index) => {
              if (!player) return null
              const actualIndex = player.rank

              return (
                <motion.div
                  key={player.participantId}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="flex flex-col items-center"
                >
                  {/* Avatar */}
                  <div className="relative mb-2">
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 ${
                        actualIndex === 1
                          ? 'border-yellow-400'
                          : actualIndex === 2
                          ? 'border-neutral-300'
                          : 'border-amber-600'
                      }`}
                    >
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt={player.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-xl font-bold">
                          {player.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {actualIndex === 1 && (
                      <Crown className="w-6 h-6 text-yellow-400 absolute -top-3 left-1/2 -translate-x-1/2" />
                    )}
                  </div>

                  {/* Name */}
                  <p className="font-semibold text-sm truncate max-w-[80px] sm:max-w-[100px]">
                    {player.userName}
                  </p>

                  {/* Score */}
                  <p className="text-xs text-neutral-400">
                    {player.score.toLocaleString()}
                  </p>

                  {/* Podium */}
                  <div
                    className={`${getPodiumHeight(actualIndex)} w-20 sm:w-24 mt-2 rounded-t-lg flex items-center justify-center font-black text-2xl ${
                      actualIndex === 1
                        ? 'bg-gradient-to-t from-yellow-600 to-yellow-400'
                        : actualIndex === 2
                        ? 'bg-gradient-to-t from-neutral-500 to-neutral-300'
                        : 'bg-gradient-to-t from-amber-800 to-amber-600'
                    }`}
                  >
                    <Medal className={`w-8 h-8 ${getMedalColor(actualIndex)}`} />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Personal Stats (if participated) */}
        {currentUser && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Results</h2>
              <div className="flex items-center gap-2">
                <Trophy className={getMedalColor(currentUser.rank)} />
                <span className="font-bold text-xl">#{currentUser.rank}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-black text-purple-400">
                  {currentUser.score.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-400">Points</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-green-400">
                  {currentUser.correctAnswers}/{stats.totalQuestions}
                </p>
                <p className="text-xs text-neutral-400">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-orange-400">
                  {currentUser.bestStreak}
                </p>
                <p className="text-xs text-neutral-400">Best Streak</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-yellow-400">
                  +{currentUser.xpEarned}
                </p>
                <p className="text-xs text-neutral-400">XP Earned</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Full Rankings */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="font-semibold">Final Rankings</h2>
          </div>

          <div className="divide-y divide-neutral-800 max-h-96 overflow-y-auto">
            {rankings.map((player, index) => {
              const isCurrentUser = currentUser?.participantId === player.participantId

              return (
                <motion.div
                  key={player.participantId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.05 }}
                  className={`px-4 py-3 flex items-center gap-3 ${
                    isCurrentUser ? 'bg-purple-500/10' : ''
                  }`}
                >
                  {/* Rank */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      player.rank <= 3
                        ? player.rank === 1
                          ? 'bg-yellow-400 text-yellow-900'
                          : player.rank === 2
                          ? 'bg-neutral-300 text-neutral-700'
                          : 'bg-amber-600 text-amber-100'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {player.rank <= 3 ? (
                      <Medal className="w-4 h-4" />
                    ) : (
                      player.rank
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">
                    {player.avatarUrl ? (
                      <img
                        src={player.avatarUrl}
                        alt={player.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500 font-medium">
                        {player.userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name & Stats */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {player.userName}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-purple-400">(You)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {player.correctAnswers}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {player.bestStreak}
                      </span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <p className="font-bold">{player.score.toLocaleString()}</p>
                    <p className="text-xs text-yellow-500">+{player.xpEarned} XP</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <Target className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{stats.totalQuestions}</p>
            <p className="text-xs text-neutral-500">Questions</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <Star className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{Math.round(stats.avgAccuracy)}%</p>
            <p className="text-xs text-neutral-500">Avg Accuracy</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <Trophy className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{stats.totalXPAwarded}</p>
            <p className="text-xs text-neutral-500">Total XP</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/arena/create')}
            className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Create New Arena
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `I played ${arena.title}!`,
                  text: `I got #${currentUser?.rank || rankings.length} with ${
                    currentUser?.score || 0
                  } points!`,
                  url: window.location.href,
                })
              }
            }}
            className="px-6 py-4 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-semibold"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  )
}
