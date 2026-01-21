'use client'

/**
 * Arena Lobby Page
 *
 * Waiting room before the game starts.
 * Shows:
 * - Invite code for sharing
 * - Live player list (real-time updates)
 * - Start button (host only)
 * - Game settings
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Copy,
  Check,
  Users,
  Clock,
  HelpCircle,
  Play,
  Crown,
  Loader2,
  Eye,
  ArrowLeft,
  Share2,
} from 'lucide-react'
import { useArenaRealtime } from '@/hooks/useArenaRealtime'
import type {
  ArenaSession,
  ArenaParticipant,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  GameStartingEvent,
} from '@/lib/arena/types'

interface ArenaData {
  arena: ArenaSession
  participants: ArenaParticipant[]
  isHost: boolean
  currentParticipant: ArenaParticipant | null
}

export default function ArenaLobbyPage() {
  const router = useRouter()
  const params = useParams()
  const arenaId = params.id as string

  const [data, setData] = useState<ArenaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Fetch arena data
  const fetchArena = useCallback(async () => {
    try {
      const response = await fetch(`/api/arena/${arenaId}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to load arena')
        return
      }

      setData({
        arena: result.arena,
        participants: result.participants,
        isHost: result.isHost,
        currentParticipant: result.currentParticipant,
      })

      // If game already started, redirect to play
      if (result.arena.status === 'IN_PROGRESS' || result.arena.status === 'STARTING') {
        router.push(`/arena/${arenaId}/play`)
      }
      if (result.arena.status === 'COMPLETED') {
        router.push(`/arena/${arenaId}/results`)
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [arenaId, router])

  useEffect(() => {
    fetchArena()
  }, [fetchArena])

  // Real-time event handlers
  const handlePlayerJoined = useCallback((event: PlayerJoinedEvent) => {
    setData((prev) => {
      if (!prev) return prev
      const exists = prev.participants.some((p) => p.id === event.participantId)
      if (exists) return prev

      return {
        ...prev,
        participants: [
          ...prev.participants,
          {
            id: event.participantId,
            arenaId,
            userId: event.participantId,
            userName: event.userName,
            userAvatarUrl: event.avatarUrl ?? null,
            totalScore: 0,
            correctAnswers: 0,
            currentStreak: 0,
            bestStreak: 0,
            joinedAt: new Date(),
            finalRank: null,
            xpEarned: 0,
            isConnected: true,
          },
        ],
      }
    })
  }, [arenaId])

  const handlePlayerLeft = useCallback((event: PlayerLeftEvent) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        participants: prev.participants.filter(
          (p) => p.id !== event.participantId
        ),
      }
    })
  }, [])

  const handleGameStarting = useCallback((event: GameStartingEvent) => {
    setCountdown(event.countdownSeconds)
    // Start countdown
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          router.push(`/arena/${arenaId}/play`)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [arenaId, router])

  // Subscribe to real-time events
  const { isConnected } = useArenaRealtime({
    arenaId,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onGameStarting: handleGameStarting,
    enabled: !!data,
  })

  // Copy invite code
  const copyInviteCode = async () => {
    if (!data?.arena.inviteCode) return

    try {
      await navigator.clipboard.writeText(data.arena.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = data.arena.inviteCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Share invite
  const shareInvite = async () => {
    if (!data?.arena) return

    const shareData = {
      title: `Join ${data.arena.title}`,
      text: `Join my quiz arena! Code: ${data.arena.inviteCode}`,
      url: window.location.origin + `/arena/join?code=${data.arena.inviteCode}`,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        copyInviteCode()
      }
    } else {
      copyInviteCode()
    }
  }

  // Start game (host only)
  const startGame = async () => {
    if (!data?.isHost || starting) return

    setStarting(true)
    try {
      const response = await fetch(`/api/arena/${arenaId}/start`, {
        method: 'POST',
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to start game')
        setStarting(false)
      }
      // Real-time event will handle redirect
    } catch (err) {
      setError('Failed to start game')
      setStarting(false)
    }
  }

  // Leave arena
  const leaveArena = async () => {
    try {
      await fetch(`/api/arena/${arenaId}/leave`, { method: 'POST' })
    } catch (err) {
      // Ignore errors
    }
    router.push('/arena')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            {error || 'Arena not found'}
          </h1>
          <p className="text-neutral-400 mb-6">
            The arena may have been cancelled or doesn&apos;t exist.
          </p>
          <button
            onClick={() => router.push('/arena')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold text-white transition-colors"
          >
            Back to Arena
          </button>
        </div>
      </div>
    )
  }

  const { arena, participants, isHost } = data
  const isSpectator = arena.hostIsSpectator && isHost

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="text-center animate-in fade-in zoom-in duration-200">
            <p className="text-2xl text-purple-400 font-semibold mb-4">
              Game Starting
            </p>
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <span className="text-6xl font-black">{countdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={leaveArena}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <div className="text-center">
            <h1 className="font-semibold text-lg">{arena.title}</h1>
            {isSpectator && (
              <div className="flex items-center gap-1 justify-center text-xs text-rose-400">
                <Eye className="w-3 h-3" />
                Spectator Mode
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              }`}
            />
            <span className="text-xs text-neutral-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Invite Code Card */}
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-6">
          <p className="text-sm text-purple-300 text-center mb-3">
            Share this code with friends
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="text-4xl sm:text-5xl font-black tracking-[0.3em] font-mono">
              {arena.inviteCode}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Code
                </>
              )}
            </button>
            <button
              onClick={shareInvite}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-medium transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Game Settings */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <HelpCircle className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{arena.questionCount}</p>
            <p className="text-xs text-neutral-500">Questions</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <Clock className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
            <p className="text-lg font-bold">{arena.timePerQuestion}s</p>
            <p className="text-xs text-neutral-500">Per Question</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
            <Users className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
            <p className="text-lg font-bold">
              {participants.length}/{arena.maxPlayers}
            </p>
            <p className="text-xs text-neutral-500">Players</p>
          </div>
        </div>

        {/* Players List */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-neutral-400" />
              Players ({participants.length})
            </h2>
          </div>

          <div className="divide-y divide-neutral-800 max-h-64 overflow-y-auto">
            {participants.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500">
                Waiting for players to join...
              </div>
            ) : (
              participants.map((participant) => {
                const participantIsHost = participant.userId === arena.hostId

                return (
                  <div
                    key={participant.id}
                    className="px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">
                      {participant.userAvatarUrl ? (
                        <img
                          src={participant.userAvatarUrl}
                          alt={participant.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500 font-medium">
                          {participant.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">
                        {participant.userName}
                        {participantIsHost && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {participant.isConnected ? 'Online' : 'Connecting...'}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Start Button (Host Only) */}
        {isHost && (
          <button
            onClick={startGame}
            disabled={starting || participants.length < 1}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-neutral-600 disabled:to-neutral-600 disabled:cursor-not-allowed rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-green-500/25 transition-all"
          >
            {starting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Game
                {participants.length < 2 && (
                  <span className="text-sm font-normal opacity-80">
                    (waiting for players)
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {!isHost && (
          <div className="text-center py-4 text-neutral-400">
            Waiting for host to start the game...
          </div>
        )}
      </main>
    </div>
  )
}
