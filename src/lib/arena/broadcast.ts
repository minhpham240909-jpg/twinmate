/**
 * Practice Arena - Real-time Broadcasting
 *
 * Handles Supabase Realtime channel broadcasting for arena events.
 * All arena events are broadcast through a single channel per arena.
 *
 * SCALE: Added rate limiting for 2000-3000 concurrent users
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client for server-side broadcasting
// We need the service role key for server-side channel operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// SCALE: Broadcast rate limiting to prevent overwhelming Supabase Realtime
// Max 10 broadcasts per second per event type per arena
const broadcastRateLimit = new Map<string, number>()
const BROADCAST_MIN_INTERVAL_MS = 100 // 100ms = max 10/second per event type

// SCALE: Cleanup old rate limit entries periodically
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60000 // Clean every minute
let lastCleanup = Date.now()

function cleanupRateLimitEntries() {
  const now = Date.now()
  if (now - lastCleanup > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    // Remove entries older than 1 minute
    for (const [key, timestamp] of broadcastRateLimit.entries()) {
      if (now - timestamp > 60000) {
        broadcastRateLimit.delete(key)
      }
    }
    lastCleanup = now
  }
}

let supabaseAdmin: ReturnType<typeof createClient> | null = null

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseAdmin
}

/**
 * Get the channel name for an arena
 */
export function getArenaChannelName(arenaId: string): string {
  return `arena:${arenaId}`
}

/**
 * Broadcast an event to all participants in an arena
 *
 * Uses Supabase Realtime broadcast to send events to all subscribed clients.
 * SCALE: Includes rate limiting to prevent overwhelming Supabase at 2000-3000 users
 *
 * @param arenaId - The arena ID
 * @param event - The event type (e.g., 'player_joined', 'question_start')
 * @param payload - The event payload data
 */
export async function broadcastArenaEvent(
  arenaId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // SCALE: Rate limit broadcasts per arena per event type
    const rateLimitKey = `${arenaId}:${event}`
    const lastBroadcast = broadcastRateLimit.get(rateLimitKey) || 0
    const now = Date.now()

    if (now - lastBroadcast < BROADCAST_MIN_INTERVAL_MS) {
      // Skip this broadcast - too frequent
      // This is OK for events like answer_submitted where we can miss some
      // Critical events like question_start/game_end are spaced naturally
      return
    }

    broadcastRateLimit.set(rateLimitKey, now)

    // SCALE: Periodically cleanup old rate limit entries
    cleanupRateLimitEntries()

    const supabase = getSupabaseAdmin()
    const channelName = getArenaChannelName(arenaId)

    // Create a channel and broadcast
    const channel = supabase.channel(channelName)

    await channel.send({
      type: 'broadcast',
      event,
      payload,
    })

    // Unsubscribe after sending (server-side, we don't maintain connections)
    await supabase.removeChannel(channel)
  } catch (error) {
    console.error('[Arena Broadcast] Failed to broadcast event:', {
      arenaId,
      event,
      error: error instanceof Error ? error.message : error,
    })
    // Don't throw - broadcasting failures shouldn't break game flow
  }
}

/**
 * Broadcast player joined event
 */
export async function broadcastPlayerJoined(
  arenaId: string,
  participantId: string,
  userName: string,
  avatarUrl: string | null,
  playerCount: number
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'player_joined', {
    participantId,
    userName,
    avatarUrl,
    playerCount,
  })
}

/**
 * Broadcast player left event
 */
export async function broadcastPlayerLeft(
  arenaId: string,
  participantId: string,
  userName: string,
  playerCount: number
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'player_left', {
    participantId,
    userName,
    playerCount,
  })
}

/**
 * Broadcast game starting event
 */
export async function broadcastGameStarting(
  arenaId: string,
  countdownSeconds: number,
  totalQuestions: number
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'game_starting', {
    countdownSeconds,
    totalQuestions,
  })
}

/**
 * Broadcast question start event
 */
export async function broadcastQuestionStart(
  arenaId: string,
  questionNumber: number,
  question: string,
  options: string[],
  timeLimit: number,
  basePoints: number
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'question_start', {
    questionNumber,
    question,
    options,
    timeLimit,
    basePoints,
  })
}

/**
 * Broadcast answer submitted event (anonymized)
 */
export async function broadcastAnswerSubmitted(
  arenaId: string,
  participantId: string,
  answeredCount: number,
  totalParticipants: number
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'answer_submitted', {
    participantId,
    answeredCount,
    totalParticipants,
  })
}

/**
 * Broadcast question end event with results
 */
export async function broadcastQuestionEnd(
  arenaId: string,
  questionNumber: number,
  correctAnswer: number,
  explanation: string | undefined,
  stats: {
    correctCount: number
    totalAnswered: number
    avgResponseTime: number
  }
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'question_end', {
    questionNumber,
    correctAnswer,
    explanation,
    stats,
  })
}

/**
 * Broadcast leaderboard update event
 */
export async function broadcastLeaderboardUpdate(
  arenaId: string,
  rankings: Array<{
    rank: number
    participantId: string
    userName: string
    avatarUrl: string | null
    score: number
    change: number
    streak: number
  }>,
  questionNumber: number
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'leaderboard_update', {
    rankings,
    questionNumber,
  })
}

/**
 * Broadcast game end event with final results
 */
export async function broadcastGameEnd(
  arenaId: string,
  finalRankings: Array<{
    rank: number
    participantId: string
    userName: string
    avatarUrl: string | null
    score: number
    correctAnswers: number
    bestStreak: number
    xpEarned: number
  }>,
  stats: {
    totalQuestions: number
    avgAccuracy: number
    totalXPAwarded: number
  }
): Promise<void> {
  await broadcastArenaEvent(arenaId, 'game_end', {
    finalRankings,
    stats,
  })
}
