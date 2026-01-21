/**
 * Practice Arena - TypeScript Types
 *
 * Type definitions for the competitive learning feature.
 * Matches Prisma schema definitions.
 */

// ==========================================
// ENUMS
// ==========================================

export type ArenaStatus =
  | 'LOBBY'           // Waiting for players
  | 'STARTING'        // Countdown before first question
  | 'IN_PROGRESS'     // Game is active
  | 'BETWEEN_ROUNDS'  // Showing results between questions
  | 'COMPLETED'       // Game finished
  | 'CANCELLED'       // Host cancelled

export type ArenaContentSource =
  | 'UPLOAD'          // Host uploaded notes/PDF
  | 'AI_GENERATED'    // AI generated from topic
  | 'STUDY_HISTORY'   // From user's flashcards/sessions
  | 'DECK'            // From existing FlashcardDeck
  | 'CUSTOM'          // Host manually creates questions (host becomes spectator)

// ==========================================
// DATABASE MODELS (match Prisma)
// ==========================================

export interface ArenaSession {
  id: string
  hostId: string
  title: string
  inviteCode: string
  contentSource: ArenaContentSource
  sourceTopic?: string | null
  sourceFileUrl?: string | null
  sourceDeckId?: string | null
  questionCount: number
  timePerQuestion: number
  maxPlayers: number
  hostIsSpectator: boolean  // True for CUSTOM mode - host watches but doesn't play
  status: ArenaStatus
  currentQuestion: number
  startedAt?: Date | null
  endedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ArenaParticipant {
  id: string
  arenaId: string
  userId: string
  userName: string
  userAvatarUrl?: string | null
  totalScore: number
  correctAnswers: number
  currentStreak: number
  bestStreak: number
  joinedAt: Date
  finalRank?: number | null
  xpEarned: number
  isConnected: boolean
}

export interface ArenaQuestion {
  id: string
  arenaId: string
  questionNumber: number
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string | null
  basePoints: number
  sourceCardId?: string | null
  createdAt: Date
}

export interface ArenaAnswer {
  id: string
  questionId: string
  participantId: string
  selectedAnswer: number
  isCorrect: boolean
  responseTimeMs: number
  basePoints: number
  timeBonus: number
  streakBonus: number
  totalPoints: number
  answeredAt: Date
}

export interface ArenaWeeklyStats {
  id: string
  userId: string
  weekStart: Date
  totalXP: number
  correctAnswers: number
  bestStreak: number
  gamesPlayed: number
  gamesWon: number
  combinedScore: number
  updatedAt: Date
}

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

// Create Arena
export interface CreateArenaRequest {
  title: string
  contentSource: ArenaContentSource
  topic?: string           // For AI_GENERATED
  fileContent?: string     // For UPLOAD (extracted text)
  deckId?: string          // For DECK
  questionCount?: number   // default 10
  timePerQuestion?: number // default 20
  maxPlayers?: number      // default 20
}

export interface CreateArenaResponse {
  success: boolean
  arena: ArenaSession
  inviteCode: string
  error?: string
}

// Join Arena
export interface JoinArenaRequest {
  inviteCode: string
}

export interface JoinArenaResponse {
  success: boolean
  arena?: ArenaSession
  participant?: ArenaParticipant
  participants?: ArenaParticipant[]
  error?: string
}

// Submit Answer
export interface SubmitAnswerRequest {
  questionId: string
  selectedAnswer: number
  responseTimeMs: number
}

export interface SubmitAnswerResponse {
  success: boolean
  isCorrect: boolean
  totalPoints: number
  breakdown: {
    base: number
    timeBonus: number
    streakBonus: number
  }
  newStreak: number
  correctAnswer: number
  explanation?: string
  newTotalScore: number
  currentRank: number
  error?: string
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  avatarUrl?: string | null
  totalXP: number
  correctAnswers: number
  bestStreak: number
  combinedScore: number
  gamesPlayed: number
}

export interface ArenaLeaderboardResponse {
  success: boolean
  weekStart: string
  weekEnd: string
  leaderboard: LeaderboardEntry[]
  currentUser?: LeaderboardEntry & { rank: number }
  error?: string
}

// ==========================================
// REAL-TIME EVENT TYPES
// ==========================================

export interface PlayerJoinedEvent {
  participantId: string
  userName: string
  avatarUrl?: string | null
  playerCount: number
}

export interface PlayerLeftEvent {
  participantId: string
  userName: string
  playerCount: number
}

export interface GameStartingEvent {
  countdownSeconds: number
  totalQuestions: number
}

export interface QuestionStartEvent {
  questionNumber: number
  question: string
  options: string[]
  timeLimit: number
  basePoints: number
}

export interface AnswerSubmittedEvent {
  participantId: string
  answeredCount: number
  totalParticipants: number
}

export interface QuestionEndEvent {
  questionNumber: number
  correctAnswer: number
  explanation?: string
  stats: {
    correctCount: number
    totalAnswered: number
    avgResponseTime: number
  }
}

export interface LeaderboardUpdateEvent {
  rankings: Array<{
    rank: number
    participantId: string
    userName: string
    avatarUrl?: string | null
    score: number
    change: number // Position change (+2 = moved up 2 places)
    streak: number
  }>
  questionNumber: number
}

export interface GameEndEvent {
  finalRankings: Array<{
    rank: number
    participantId: string
    userName: string
    avatarUrl?: string | null
    score: number
    correctAnswers: number
    bestStreak: number
    xpEarned: number
  }>
  stats: {
    totalQuestions: number
    avgAccuracy: number
    totalXPAwarded: number
  }
}

// Union type for all events
export type ArenaEvent =
  | { type: 'player_joined'; payload: PlayerJoinedEvent }
  | { type: 'player_left'; payload: PlayerLeftEvent }
  | { type: 'game_starting'; payload: GameStartingEvent }
  | { type: 'question_start'; payload: QuestionStartEvent }
  | { type: 'answer_submitted'; payload: AnswerSubmittedEvent }
  | { type: 'question_end'; payload: QuestionEndEvent }
  | { type: 'leaderboard_update'; payload: LeaderboardUpdateEvent }
  | { type: 'game_end'; payload: GameEndEvent }

// ==========================================
// SCORING TYPES
// ==========================================

export interface PointsBreakdown {
  base: number
  timeBonus: number
  streakBonus: number
  total: number
}

// ==========================================
// QUESTION GENERATION TYPES
// ==========================================

export interface GeneratedQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export interface QuestionGenerationRequest {
  source: ArenaContentSource
  topic?: string
  content?: string
  deckId?: string
  userId?: string
  count: number
}

// ==========================================
// CUSTOM QUESTION CREATION TYPES
// ==========================================

export interface CustomQuestion {
  question: string
  options: [string, string, string, string]  // Exactly 4 options
  correctAnswer: number  // Index 0-3
  explanation?: string
}

export interface CreateCustomArenaRequest {
  title: string
  questions: CustomQuestion[]  // At least 3, max 50
  timePerQuestion?: number     // 10-60 seconds, default 20
  maxPlayers?: number          // 2-50, default 20
}

// ==========================================
// TEACHER DASHBOARD TYPES (Spectator Mode)
// ==========================================

// Real-time answer tracking for teacher view
export interface TeacherAnswerEvent {
  participantId: string
  userName: string
  avatarUrl?: string | null
  questionNumber: number
  selectedAnswer: number
  isCorrect: boolean
  responseTimeMs: number
  points: number
}

// Question stats for teacher dashboard
export interface TeacherQuestionStats {
  questionNumber: number
  answeredCount: number
  totalParticipants: number
  correctCount: number
  wrongCount: number
  answerDistribution: [number, number, number, number]  // Count per option
  avgResponseTime: number
  fastestAnswer?: {
    participantId: string
    userName: string
    responseTimeMs: number
  }
}

// ==========================================
// STREAMING & CACHING TYPES
// ==========================================

// Streaming generation event types
export interface StreamQuestionEvent {
  type: 'question'
  index: number
  question: GeneratedQuestion
  cached: boolean
}

export interface StreamCompleteEvent {
  type: 'complete'
  total: number
  cached: boolean
}

export interface StreamErrorEvent {
  type: 'error'
  message: string
}

export type StreamEvent = StreamQuestionEvent | StreamCompleteEvent | StreamErrorEvent

// Pre-generation state for UI
export interface PregenerateState {
  status: 'idle' | 'generating' | 'complete' | 'error'
  questions: GeneratedQuestion[]
  progress: number  // 0-100
  cached: boolean
  error: string | null
}

// Cache metadata
export interface CachedQuestions {
  questions: GeneratedQuestion[]
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  count: number
  cachedAt: number  // timestamp
  expiresAt: number // timestamp
}
