/**
 * Practice Arena - Real-time Hook
 *
 * Subscribes to Supabase Realtime channel for arena events.
 * Handles player joins/leaves, game state changes, and answer submissions.
 */

'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  PlayerJoinedEvent,
  PlayerLeftEvent,
  GameStartingEvent,
  QuestionStartEvent,
  AnswerSubmittedEvent,
  QuestionEndEvent,
  LeaderboardUpdateEvent,
  GameEndEvent,
  TeacherAnswerEvent,
} from '@/lib/arena/types'

// SCALE: Increase heartbeat interval for 2000-3000 users
// 30s heartbeat with 3000 users = 6000 heartbeats/min = 100/sec
// 60s heartbeat with 3000 users = 3000 heartbeats/min = 50/sec
const HEARTBEAT_INTERVAL = 60000 // 60 seconds

// SCALE: Maximum processed messages to track for deduplication
const MAX_PROCESSED_MESSAGES = 1000
const PROCESSED_MESSAGES_CLEANUP_THRESHOLD = 800

interface UseArenaRealtimeOptions {
  arenaId: string
  onPlayerJoined?: (event: PlayerJoinedEvent) => void
  onPlayerLeft?: (event: PlayerLeftEvent) => void
  onGameStarting?: (event: GameStartingEvent) => void
  onQuestionStart?: (event: QuestionStartEvent) => void
  onAnswerSubmitted?: (event: AnswerSubmittedEvent) => void
  onQuestionEnd?: (event: QuestionEndEvent) => void
  onLeaderboardUpdate?: (event: LeaderboardUpdateEvent) => void
  onGameEnd?: (event: GameEndEvent) => void
  onTeacherAnswer?: (event: TeacherAnswerEvent) => void
  enabled?: boolean
}

interface UseArenaRealtimeReturn {
  isConnected: boolean
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  reconnect: () => void
}

export function useArenaRealtime({
  arenaId,
  onPlayerJoined,
  onPlayerLeft,
  onGameStarting,
  onQuestionStart,
  onAnswerSubmitted,
  onQuestionEnd,
  onLeaderboardUpdate,
  onGameEnd,
  onTeacherAnswer,
  enabled = true,
}: UseArenaRealtimeOptions): UseArenaRealtimeReturn {
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  // SCALE: Track processed message IDs to prevent duplicate handling
  const processedMessages = useRef<Set<string>>(new Set())
  // Track if cleanup is in progress to prevent race conditions
  const isCleaningUp = useRef(false)

  // Use refs for callbacks to avoid re-subscribing on callback changes
  const callbacksRef = useRef({
    onPlayerJoined,
    onPlayerLeft,
    onGameStarting,
    onQuestionStart,
    onAnswerSubmitted,
    onQuestionEnd,
    onLeaderboardUpdate,
    onGameEnd,
    onTeacherAnswer,
  })

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onPlayerJoined,
      onPlayerLeft,
      onGameStarting,
      onQuestionStart,
      onAnswerSubmitted,
      onQuestionEnd,
      onLeaderboardUpdate,
      onGameEnd,
      onTeacherAnswer,
    }
  }, [onPlayerJoined, onPlayerLeft, onGameStarting, onQuestionStart, onAnswerSubmitted, onQuestionEnd, onLeaderboardUpdate, onGameEnd, onTeacherAnswer])

  const handleMessage = useCallback((payload: { type: string; event: string; payload: unknown }) => {
    const { event, payload: eventPayload } = payload

    // SCALE: Deduplicate messages to prevent duplicate handling
    // Generate a unique message ID from event type and key payload fields
    const eventData = eventPayload as Record<string, unknown>
    const messageId = `${event}:${eventData?.timestamp || eventData?.questionNumber || Date.now()}`

    if (processedMessages.current.has(messageId)) {
      return // Already processed this message
    }

    processedMessages.current.add(messageId)

    // SCALE: Prevent unbounded memory growth - cleanup old messages
    if (processedMessages.current.size > MAX_PROCESSED_MESSAGES) {
      const entries = [...processedMessages.current]
      const toRemove = entries.slice(0, entries.length - PROCESSED_MESSAGES_CLEANUP_THRESHOLD)
      toRemove.forEach(id => processedMessages.current.delete(id))
    }

    switch (event) {
      case 'player_joined':
        callbacksRef.current.onPlayerJoined?.(eventPayload as PlayerJoinedEvent)
        break
      case 'player_left':
        callbacksRef.current.onPlayerLeft?.(eventPayload as PlayerLeftEvent)
        break
      case 'game_starting':
        callbacksRef.current.onGameStarting?.(eventPayload as GameStartingEvent)
        break
      case 'question_start':
        callbacksRef.current.onQuestionStart?.(eventPayload as QuestionStartEvent)
        break
      case 'answer_submitted':
        callbacksRef.current.onAnswerSubmitted?.(eventPayload as AnswerSubmittedEvent)
        break
      case 'question_end':
        callbacksRef.current.onQuestionEnd?.(eventPayload as QuestionEndEvent)
        break
      case 'leaderboard_update':
        callbacksRef.current.onLeaderboardUpdate?.(eventPayload as LeaderboardUpdateEvent)
        break
      case 'game_end':
        callbacksRef.current.onGameEnd?.(eventPayload as GameEndEvent)
        break
      case 'teacher_answer':
        callbacksRef.current.onTeacherAnswer?.(eventPayload as TeacherAnswerEvent)
        break
    }
  }, [])

  const subscribe = useCallback(() => {
    if (!arenaId || !enabled) return

    const supabase = createClient()
    const channelName = `arena:${arenaId}`

    setConnectionState('connecting')

    const channel = supabase.channel(channelName)
      .on('broadcast', { event: '*' }, handleMessage)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected')
          reconnectAttempts.current = 0
        } else if (status === 'CLOSED') {
          setConnectionState('disconnected')
          // Attempt reconnection with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            reconnectTimeout.current = setTimeout(() => {
              reconnectAttempts.current++
              subscribe()
            }, delay)
          }
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionState('error')
        }
      })

    channelRef.current = channel
  }, [arenaId, enabled, handleMessage])

  const reconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    reconnectAttempts.current = 0
    subscribe()
  }, [subscribe])

  useEffect(() => {
    subscribe()

    // SCALE: Proper cleanup with race condition prevention
    return () => {
      isCleaningUp.current = true

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
        reconnectTimeout.current = null
      }

      if (channelRef.current) {
        const channel = channelRef.current
        channelRef.current = null

        // SCALE: Use removeChannel for proper cleanup (not just unsubscribe)
        // This ensures the channel is fully removed from Supabase client
        const supabase = createClient()
        supabase.removeChannel(channel).catch((err) => {
          console.warn('[Arena Realtime] Channel cleanup error:', err)
        })
      }

      // Clear processed messages to free memory
      processedMessages.current.clear()
    }
  }, [subscribe])

  // Heartbeat to check connection status
  // SCALE: Increased interval from 30s to 60s for 2000-3000 users
  useEffect(() => {
    if (!enabled) return

    const heartbeat = setInterval(() => {
      // Don't attempt reconnect if cleanup is in progress
      if (isCleaningUp.current) return

      if (connectionState === 'disconnected' && reconnectAttempts.current < maxReconnectAttempts) {
        reconnect()
      }
    }, HEARTBEAT_INTERVAL)

    return () => clearInterval(heartbeat)
  }, [enabled, connectionState, reconnect])

  return {
    isConnected: connectionState === 'connected',
    connectionState,
    reconnect,
  }
}
