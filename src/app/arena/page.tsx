'use client'

/**
 * Arcade - Main Page
 *
 * Entry point for Arcade feature.
 * Shows:
 * - Weekly leaderboard (top 5)
 * - Quick actions: Create game, Join with code
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy,
  Plus,
  Users,
  ArrowRight,
  Gamepad2,
  Zap,
  Target,
  Play,
  Clock,
  LogOut,
  Loader2,
} from 'lucide-react'
import { ArenaWeeklyLeaderboard } from '@/components/arena/ArenaWeeklyLeaderboard'
import { JoinArenaModal } from '@/components/arena/JoinArenaModal'

interface ActiveSession {
  id: string
  title: string
  status: 'LOBBY' | 'IN_PROGRESS' | 'STARTING'
  inviteCode: string
  currentQuestion: number
  questionCount: number
  participantCount: number
  myScore: number
  myStreak: number
  createdAt: string
}

export default function ArenaPage() {
  const router = useRouter()
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [leavingSessionId, setLeavingSessionId] = useState<string | null>(null)

  // Fetch active sessions on mount
  useEffect(() => {
    fetchActiveSessions()
  }, [])

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/arena/my-sessions')
      if (response.ok) {
        const data = await response.json()
        setActiveSessions(data.sessions || [])
      }
    } catch (err) {
      console.error('Failed to fetch active sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleLeaveSession = async (sessionId: string) => {
    setLeavingSessionId(sessionId)
    try {
      await fetch(`/api/arena/${sessionId}/leave`, { method: 'POST' })
      setActiveSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      console.error('Failed to leave session:', err)
    } finally {
      setLeavingSessionId(null)
    }
  }

  const handleRejoinSession = (session: ActiveSession) => {
    if (session.status === 'LOBBY') {
      router.push(`/arena/${session.id}/lobby`)
    } else {
      router.push(`/arena/${session.id}/play`)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Gamepad2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">
                Arcade
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                Challenge friends to quiz battles
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Active Sessions */}
        {!loadingSessions && activeSessions.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-950 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-black dark:text-white">
                Active Games
              </h2>
            </div>

            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex items-center gap-4"
                >
                  {/* Status indicator */}
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      session.status === 'IN_PROGRESS'
                        ? 'bg-green-500 animate-pulse'
                        : session.status === 'LOBBY'
                        ? 'bg-blue-500'
                        : 'bg-yellow-500'
                    }`}
                  />

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-black dark:text-white truncate">
                      {session.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {session.participantCount}
                      </span>
                      {session.status === 'IN_PROGRESS' && (
                        <>
                          <span>•</span>
                          <span>
                            Q{session.currentQuestion + 1}/{session.questionCount}
                          </span>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {session.myScore} pts
                          </span>
                        </>
                      )}
                      {session.status === 'LOBBY' && (
                        <>
                          <span>•</span>
                          <span className="text-blue-500">Waiting to start</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRejoinSession(session)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      {session.status === 'LOBBY' ? 'Join' : 'Rejoin'}
                    </button>
                    <button
                      onClick={() => handleLeaveSession(session.id)}
                      disabled={leavingSessionId === session.id}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                      title="Leave game"
                    >
                      {leavingSessionId === session.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <LogOut className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Loading state for sessions */}
        {loadingSessions && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create Game */}
          <button
            onClick={() => router.push('/arena/create')}
            className="group relative overflow-hidden bg-blue-600 rounded-2xl p-6 text-left transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/20 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/50 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                Create Game
              </h2>
              <p className="text-blue-100 text-sm mb-4">
                Host a quiz and invite friends
              </p>
              <div className="flex items-center gap-2 text-white text-sm font-medium">
                <span>Get started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Join Game */}
          <button
            onClick={() => setShowJoinModal(true)}
            className="group relative overflow-hidden bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-left transition-all hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-black dark:text-white mb-1">
                Join Game
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
                Enter an invite code to join
              </p>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
                <span>Enter code</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>

        {/* Weekly Leaderboard */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-black dark:text-white">
              This Week&apos;s Champions
            </h2>
          </div>
          <ArenaWeeklyLeaderboard />
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-black dark:text-white mb-1">
                  Multiplayer
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Up to 20 players can compete in real-time quiz battles
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white dark:text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-black dark:text-white mb-1">
                  Speed Bonus
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Answer faster to earn more points and climb the ranks
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-black dark:text-white mb-1">
                  Streak Rewards
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Build answer streaks to multiply your score
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-white dark:text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-black dark:text-white mb-1">
                  Weekly Rankings
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Compete for the top spot on the weekly leaderboard
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Join Modal */}
      <JoinArenaModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
    </div>
  )
}
