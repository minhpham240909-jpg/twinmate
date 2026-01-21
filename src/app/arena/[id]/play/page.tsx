'use client'

/**
 * Arena Play Page
 *
 * Main game interface showing:
 * - Current question with timer
 * - Answer options
 * - Live leaderboard
 * - Score animations
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  Flame,
  Users,
  Clock,
  Check,
  X,
  Trophy,
  ChevronRight,
  Eye,
  Home,
  LogOut,
  MoreVertical,
} from 'lucide-react'
import { useArenaRealtime } from '@/hooks/useArenaRealtime'
import MathRenderer from '@/components/MathRenderer'
import type {
  ArenaSession,
  ArenaParticipant,
  ArenaQuestion,
  QuestionStartEvent,
  QuestionEndEvent,
  LeaderboardUpdateEvent,
  GameEndEvent,
  TeacherAnswerEvent,
} from '@/lib/arena/types'

interface ArenaData {
  arena: ArenaSession
  participants: ArenaParticipant[]
  questions: ArenaQuestion[]
  isHost: boolean
  currentParticipant: ArenaParticipant | null
}

type GamePhase = 'loading' | 'question' | 'results' | 'waiting' | 'finished'

export default function ArenaPlayPage() {
  const router = useRouter()
  const params = useParams()
  const arenaId = params.id as string

  // Game state
  const [data, setData] = useState<ArenaData | null>(null)
  const [phase, setPhase] = useState<GamePhase>('loading')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean
    points: number
    correctAnswer: number
    explanation?: string
  } | null>(null)
  const [streak, setStreak] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [rankings, setRankings] = useState<LeaderboardUpdateEvent['rankings']>([])
  const [error, setError] = useState<string | null>(null)
  const [answerSubmitting, setAnswerSubmitting] = useState(false)
  const [showExitMenu, setShowExitMenu] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  // Handle leaving the session permanently (removes participant)
  const handleLeaveSession = async () => {
    setIsLeaving(true)
    try {
      await fetch(`/api/arena/${arenaId}/leave`, {
        method: 'POST',
      })
      router.push('/arena')
    } catch (err) {
      console.error('Failed to leave session:', err)
      setIsLeaving(false)
    }
  }

  // Handle going back to dashboard (keeps session alive)
  const handleGoToDashboard = () => {
    // Just navigate away - user can return later and their progress is saved
    router.push('/dashboard')
  }

  // Teacher dashboard state (for spectators)
  const [teacherStats, setTeacherStats] = useState<{
    answeredCount: number
    correctCount: number
    answerDistribution: [number, number, number, number]
  }>({ answeredCount: 0, correctCount: 0, answerDistribution: [0, 0, 0, 0] })

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const questionStartTime = useRef<number>(0)

  // Fetch initial arena data
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
        questions: result.questions,
        isHost: result.isHost,
        currentParticipant: result.currentParticipant,
      })

      // Set initial state based on arena status
      if (result.arena.status === 'COMPLETED') {
        router.push(`/arena/${arenaId}/results`)
        return
      }

      if (result.arena.status === 'LOBBY') {
        router.push(`/arena/${arenaId}/lobby`)
        return
      }

      setCurrentQuestionIndex(result.arena.currentQuestion)
      setTotalScore(result.currentParticipant?.totalScore || 0)
      setStreak(result.currentParticipant?.currentStreak || 0)

      // If question is active, show it
      if (result.arena.currentQuestion < result.questions.length) {
        setPhase('question')
        setTimeLeft(result.arena.timePerQuestion)
        questionStartTime.current = Date.now()
      } else {
        setPhase('waiting')
      }
    } catch (err) {
      setError('Something went wrong')
    }
  }, [arenaId, router])

  useEffect(() => {
    fetchArena()
  }, [fetchArena])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'question' || timeLeft <= 0) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          // Auto-submit if not answered
          if (!isAnswered) {
            setIsAnswered(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, timeLeft, isAnswered])

  // Real-time event handlers
  const handleQuestionStart = useCallback((event: QuestionStartEvent) => {
    setCurrentQuestionIndex(event.questionNumber - 1)
    setTimeLeft(event.timeLimit)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setLastResult(null)
    setPhase('question')
    questionStartTime.current = Date.now()
    // Reset teacher stats
    setTeacherStats({
      answeredCount: 0,
      correctCount: 0,
      answerDistribution: [0, 0, 0, 0],
    })
  }, [])

  const handleQuestionEnd = useCallback((event: QuestionEndEvent) => {
    setPhase('results')
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const handleLeaderboardUpdate = useCallback((event: LeaderboardUpdateEvent) => {
    setRankings(event.rankings)
  }, [])

  const handleGameEnd = useCallback((event: GameEndEvent) => {
    setPhase('finished')
    // Redirect to results after a short delay
    setTimeout(() => {
      router.push(`/arena/${arenaId}/results`)
    }, 2000)
  }, [arenaId, router])

  const handleTeacherAnswer = useCallback((event: TeacherAnswerEvent) => {
    setTeacherStats((prev) => {
      const newDistribution = [...prev.answerDistribution] as [number, number, number, number]
      newDistribution[event.selectedAnswer]++
      return {
        answeredCount: prev.answeredCount + 1,
        correctCount: event.isCorrect ? prev.correctCount + 1 : prev.correctCount,
        answerDistribution: newDistribution,
      }
    })
  }, [])

  // Subscribe to real-time events
  useArenaRealtime({
    arenaId,
    onQuestionStart: handleQuestionStart,
    onQuestionEnd: handleQuestionEnd,
    onLeaderboardUpdate: handleLeaderboardUpdate,
    onGameEnd: handleGameEnd,
    onTeacherAnswer: handleTeacherAnswer,
    enabled: !!data,
  })

  // Submit answer
  const submitAnswer = async (answerIndex: number) => {
    if (isAnswered || !data || answerSubmitting) return

    setSelectedAnswer(answerIndex)
    setIsAnswered(true)
    setAnswerSubmitting(true)

    const responseTimeMs = Date.now() - questionStartTime.current
    const question = data.questions[currentQuestionIndex]

    try {
      const response = await fetch(`/api/arena/${arenaId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          selectedAnswer: answerIndex,
          responseTimeMs,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setLastResult({
          isCorrect: result.isCorrect,
          points: result.totalPoints,
          correctAnswer: result.correctAnswer,
          explanation: result.explanation,
        })
        setStreak(result.newStreak)
        setTotalScore(result.newTotalScore)
      }
    } catch (err) {
      console.error('Failed to submit answer:', err)
    } finally {
      setAnswerSubmitting(false)
    }
  }

  if (!data || phase === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/arena')}
            className="px-6 py-3 bg-purple-600 rounded-xl text-white font-semibold"
          >
            Back to Arena
          </button>
        </div>
      </div>
    )
  }

  const { arena, questions, isHost } = data
  const currentQuestion = questions[currentQuestionIndex]
  const isSpectator = arena.hostIsSpectator && isHost
  const totalParticipants = data.participants.length

  // Spectator view
  if (isSpectator) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white">
        {/* Header */}
        <header className="border-b border-neutral-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-rose-400" />
              <span className="font-semibold">Teacher Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Users className="w-4 h-4" />
                {totalParticipants} players
              </div>
              <div className="text-sm">
                Q{currentQuestionIndex + 1}/{questions.length}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          {phase === 'question' && currentQuestion && (
            <div className="space-y-6">
              {/* Timer */}
              <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(timeLeft / arena.timePerQuestion) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>

              {/* Question */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <div className="text-xl font-semibold mb-4">
                  <MathRenderer content={currentQuestion.question} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(currentQuestion.options as string[]).map((option, index) => (
                    <div
                      key={index}
                      className="p-4 bg-neutral-800 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-neutral-700 flex items-center justify-center font-medium">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span><MathRenderer content={option} /></span>
                      </div>
                      <span className="text-lg font-bold text-purple-400">
                        {teacherStats.answerDistribution[index]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-purple-400">
                    {teacherStats.answeredCount}
                  </p>
                  <p className="text-sm text-neutral-400">
                    of {totalParticipants} answered
                  </p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">
                    {teacherStats.answeredCount > 0
                      ? Math.round((teacherStats.correctCount / teacherStats.answeredCount) * 100)
                      : 0}%
                  </p>
                  <p className="text-sm text-neutral-400">correct so far</p>
                </div>
              </div>
            </div>
          )}

          {phase === 'results' && (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Round Complete</h2>
              <p className="text-neutral-400">
                {teacherStats.correctCount} of {teacherStats.answeredCount} got it right
              </p>
            </div>
          )}

          {phase === 'finished' && (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Game Over!</h2>
              <p className="text-neutral-400 mt-2">Redirecting to results...</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  // Player view
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Top Stats Bar */}
      <header className="border-b border-neutral-800 px-4 py-2">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-orange-400">
              <Flame className="w-4 h-4" />
              <span className="font-bold">{streak}</span>
            </div>
            <div className="w-px h-4 bg-neutral-700" />
            <span className="text-neutral-400 text-sm">
              Q{currentQuestionIndex + 1}/{questions.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-bold text-lg">
              {totalScore.toLocaleString()} pts
            </div>

            {/* Exit Menu Button */}
            <div className="relative">
              <button
                onClick={() => setShowExitMenu(!showExitMenu)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Dropdown Menu */}
              {showExitMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowExitMenu(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowExitMenu(false)
                        handleGoToDashboard()
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-800 transition-colors text-left"
                    >
                      <Home className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="font-medium text-white">Go to Dashboard</p>
                        <p className="text-xs text-neutral-500">You can return and continue</p>
                      </div>
                    </button>
                    <div className="border-t border-neutral-800" />
                    <button
                      onClick={() => {
                        setShowExitMenu(false)
                        handleLeaveSession()
                      }}
                      disabled={isLeaving}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="font-medium text-red-400">Leave Game</p>
                        <p className="text-xs text-neutral-500">Exit and lose progress</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-4">
        {phase === 'question' && currentQuestion && (
          <>
            {/* Timer Bar */}
            <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden mb-4">
              <motion.div
                className={`absolute inset-y-0 left-0 ${
                  timeLeft > 10
                    ? 'bg-green-500'
                    : timeLeft > 5
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / arena.timePerQuestion) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>

            {/* Time Display */}
            <div className="text-center mb-4">
              <span
                className={`text-2xl font-bold ${
                  timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-neutral-400'
                }`}
              >
                <Clock className="w-5 h-5 inline mr-1" />
                {timeLeft}s
              </span>
            </div>

            {/* Question */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-4">
              <div className="text-lg sm:text-xl font-semibold text-center">
                <MathRenderer content={currentQuestion.question} />
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-3 flex-1">
              {(currentQuestion.options as string[]).map((option, index) => {
                const isSelected = selectedAnswer === index
                const showResult = isAnswered && lastResult
                const isCorrect = showResult && lastResult.correctAnswer === index
                const isWrong = showResult && isSelected && !lastResult.isCorrect

                return (
                  <motion.button
                    key={index}
                    onClick={() => submitAnswer(index)}
                    disabled={isAnswered}
                    whileTap={{ scale: isAnswered ? 1 : 0.98 }}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                      isCorrect
                        ? 'bg-green-500/20 border-green-500'
                        : isWrong
                        ? 'bg-red-500/20 border-red-500'
                        : isSelected
                        ? 'bg-purple-500/20 border-purple-500'
                        : 'bg-neutral-900 border-neutral-700 hover:border-neutral-600'
                    } ${isAnswered ? 'cursor-default' : ''}`}
                  >
                    <span
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                        isCorrect
                          ? 'bg-green-500 text-white'
                          : isWrong
                          ? 'bg-red-500 text-white'
                          : isSelected
                          ? 'bg-purple-500 text-white'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {isCorrect ? (
                        <Check className="w-5 h-5" />
                      ) : isWrong ? (
                        <X className="w-5 h-5" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </span>
                    <span className="flex-1"><MathRenderer content={option} /></span>
                  </motion.button>
                )
              })}
            </div>

            {/* Points Animation */}
            <AnimatePresence>
              {lastResult && lastResult.isCorrect && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <div className="text-4xl font-black text-green-400 text-center">
                    +{lastResult.points}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {phase === 'results' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6"
              >
                {lastResult.isCorrect ? (
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-10 h-10" />
                  </div>
                )}
                <h2 className="text-2xl font-bold">
                  {lastResult.isCorrect ? 'Correct!' : 'Wrong!'}
                </h2>
                {lastResult.isCorrect && (
                  <p className="text-3xl font-black text-green-400 mt-2">
                    +{lastResult.points} points
                  </p>
                )}
                {lastResult.explanation && (
                  <div className="text-neutral-400 mt-4 max-w-md">
                    <MathRenderer content={lastResult.explanation} />
                  </div>
                )}
              </motion.div>
            )}

            <p className="text-neutral-400">Next question coming up...</p>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
            <p className="text-neutral-400">Waiting for next question...</p>
          </div>
        )}

        {phase === 'finished' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mb-6"
            >
              <Trophy className="w-20 h-20 text-yellow-500 mx-auto" />
            </motion.div>
            <h2 className="text-3xl font-black mb-2">Game Over!</h2>
            <p className="text-xl text-purple-400 font-bold mb-4">
              {totalScore.toLocaleString()} points
            </p>
            <p className="text-neutral-400">Calculating final rankings...</p>
          </div>
        )}
      </main>

      {/* Mini Leaderboard */}
      {rankings.length > 0 && phase === 'results' && (
        <div className="border-t border-neutral-800 p-4">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-400">
                Leaderboard
              </span>
              <button
                onClick={() => router.push(`/arena/${arenaId}/results`)}
                className="text-sm text-purple-400 flex items-center gap-1"
              >
                Full standings
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {rankings.slice(0, 3).map((rank) => (
                <div
                  key={rank.participantId}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="w-5 font-bold text-neutral-500">
                    #{rank.rank}
                  </span>
                  <span className="flex-1 truncate">{rank.userName}</span>
                  <span className="font-bold">{rank.score}</span>
                  {rank.change !== 0 && (
                    <span
                      className={`text-xs ${
                        rank.change > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {rank.change > 0 ? `+${rank.change}` : rank.change}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
