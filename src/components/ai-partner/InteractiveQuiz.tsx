'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trophy,
  RotateCcw,
  X,
  Lightbulb,
  Send,
  Loader2,
} from 'lucide-react'
import MathRenderer from '@/components/MathRenderer'

export interface QuizQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'open_ended'
  options?: string[]
  correctAnswer?: number // Index for multiple choice
  correctAnswerText?: string // Text for open ended
  explanation: string
}

export interface QuizResult {
  questionIndex: number
  isCorrect: boolean
  userAnswer: string | number
  correctAnswer: string | number
}

export interface WrongAnswerDetail {
  question: string
  userAnswer: string
  correctAnswer: string
  explanation: string
}

interface InteractiveQuizProps {
  questions: QuizQuestion[]
  onClose: () => void
  onComplete: (results: QuizResult[], score: number, wrongAnswers: WrongAnswerDetail[]) => void
  onTryAgain: () => Promise<void>
  subject?: string
  isRegenerating?: boolean
}

export default function InteractiveQuiz({
  questions,
  onClose,
  onComplete,
  onTryAgain,
  subject,
  isRegenerating = false,
}: InteractiveQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [openEndedAnswer, setOpenEndedAnswer] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [results, setResults] = useState<QuizResult[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false)
  const [showWrongAnswersReview, setShowWrongAnswersReview] = useState(false)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const totalScore = results.filter((r) => r.isCorrect).length
  const progress = ((currentIndex + 1) / questions.length) * 100

  const checkOpenEndedAnswer = useCallback(
    async (userAnswer: string, correctAnswer: string): Promise<boolean> => {
      // Simple comparison - normalize both answers and check similarity
      const normalizeText = (text: string) =>
        text.toLowerCase().trim().replace(/[^\w\s]/g, '')

      const normalizedUser = normalizeText(userAnswer)
      const normalizedCorrect = normalizeText(correctAnswer)

      // Direct match
      if (normalizedUser === normalizedCorrect) return true

      // Contains key terms (at least 60% of words match)
      const correctWords = normalizedCorrect.split(/\s+/)
      const userWords = normalizedUser.split(/\s+/)
      const matchingWords = correctWords.filter((word) =>
        userWords.some(
          (uw) =>
            uw.includes(word) ||
            word.includes(uw) ||
            levenshteinDistance(uw, word) <= 2
        )
      )

      return matchingWords.length >= correctWords.length * 0.6
    },
    []
  )

  // Levenshtein distance for fuzzy matching
  const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = []
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[b.length][a.length]
  }

  const handleSubmit = async () => {
    if (currentQuestion.type === 'multiple_choice') {
      if (selectedAnswer === null) return

      const correct = selectedAnswer === currentQuestion.correctAnswer
      setIsCorrect(correct)
      setIsSubmitted(true)

      setResults((prev) => [
        ...prev,
        {
          questionIndex: currentIndex,
          isCorrect: correct,
          userAnswer: selectedAnswer,
          correctAnswer: currentQuestion.correctAnswer!,
        },
      ])
    } else {
      // Open-ended question
      if (!openEndedAnswer.trim()) return

      setIsCheckingAnswer(true)
      const correct = await checkOpenEndedAnswer(
        openEndedAnswer,
        currentQuestion.correctAnswerText || ''
      )
      setIsCheckingAnswer(false)

      setIsCorrect(correct)
      setIsSubmitted(true)

      setResults((prev) => [
        ...prev,
        {
          questionIndex: currentIndex,
          isCorrect: correct,
          userAnswer: openEndedAnswer,
          correctAnswer: currentQuestion.correctAnswerText || '',
        },
      ])
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      // Build final results including current question
      const finalResults = [
        ...results,
        {
          questionIndex: currentIndex,
          isCorrect: isCorrect || false,
          userAnswer:
            currentQuestion.type === 'multiple_choice'
              ? selectedAnswer!
              : openEndedAnswer,
          correctAnswer:
            currentQuestion.type === 'multiple_choice'
              ? currentQuestion.correctAnswer!
              : currentQuestion.correctAnswerText || '',
        },
      ]

      const finalScore = finalResults.filter((r) => r.isCorrect).length

      // Build wrong answers with details
      const wrongAnswers: WrongAnswerDetail[] = finalResults
        .filter((r) => !r.isCorrect)
        .map((r) => {
          const q = questions[r.questionIndex]
          let userAnswerText = ''
          let correctAnswerText = ''

          if (q.type === 'multiple_choice') {
            userAnswerText = q.options?.[r.userAnswer as number] || String(r.userAnswer)
            correctAnswerText = q.options?.[r.correctAnswer as number] || String(r.correctAnswer)
          } else {
            userAnswerText = String(r.userAnswer)
            correctAnswerText = q.correctAnswerText || String(r.correctAnswer)
          }

          return {
            question: q.question,
            userAnswer: userAnswerText,
            correctAnswer: correctAnswerText,
            explanation: q.explanation,
          }
        })

      setShowSummary(true)
      onComplete(finalResults, finalScore, wrongAnswers)
    } else {
      setCurrentIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setOpenEndedAnswer('')
      setIsSubmitted(false)
      setIsCorrect(null)
    }
  }

  const handleTryAgain = async () => {
    await onTryAgain()
  }

  const handleDone = () => {
    onClose()
  }

  // Get wrong answers for review section
  const getWrongAnswersForReview = (): WrongAnswerDetail[] => {
    return results
      .filter((r) => !r.isCorrect)
      .map((r) => {
        const q = questions[r.questionIndex]
        let userAnswerText = ''
        let correctAnswerText = ''

        if (q.type === 'multiple_choice') {
          userAnswerText = q.options?.[r.userAnswer as number] || String(r.userAnswer)
          correctAnswerText = q.options?.[r.correctAnswer as number] || String(r.correctAnswer)
        } else {
          userAnswerText = String(r.userAnswer)
          correctAnswerText = q.correctAnswerText || String(r.correctAnswer)
        }

        return {
          question: q.question,
          userAnswer: userAnswerText,
          correctAnswer: correctAnswerText,
          explanation: q.explanation,
        }
      })
  }

  // Summary view
  if (showSummary) {
    const finalScore = results.filter((r) => r.isCorrect).length
    const percentage = Math.round((finalScore / questions.length) * 100)
    const wrongAnswers = getWrongAnswersForReview()
    const hasWrongAnswers = wrongAnswers.length > 0

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h2>
            <p className="text-slate-400">
              {subject ? `${subject} Quiz` : 'Quiz'} Results
            </p>
          </div>

          {/* Score */}
          <div className="bg-slate-900/50 rounded-xl p-6 mb-6 text-center">
            <div className="text-5xl font-bold mb-2">
              <span
                className={
                  percentage >= 80
                    ? 'text-green-400'
                    : percentage >= 60
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }
              >
                {percentage}%
              </span>
            </div>
            <p className="text-slate-400">
              {finalScore} out of {questions.length} correct
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {percentage >= 80
                ? 'Excellent work! You really know your stuff!'
                : percentage >= 60
                ? 'Good job! Keep studying to improve.'
                : 'Keep practicing, you\'ll get there!'}
            </p>
          </div>

          {/* Question Review Summary */}
          <div className="space-y-2 mb-4">
            {questions.map((q, i) => {
              const result = results[i]
              return (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    result?.isCorrect ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  {result?.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-300 truncate">
                    Q{i + 1}: {q.question}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Review Wrong Answers Section */}
          {hasWrongAnswers && (
            <div className="mb-6">
              <button
                onClick={() => setShowWrongAnswersReview(!showWrongAnswersReview)}
                className="w-full flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-left hover:bg-red-500/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-300 font-medium">
                    Review Wrong Answers ({wrongAnswers.length})
                  </span>
                </div>
                {showWrongAnswersReview ? (
                  <ChevronUp className="w-5 h-5 text-red-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-red-400" />
                )}
              </button>

              <AnimatePresence>
                {showWrongAnswersReview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-4 max-h-60 overflow-y-auto">
                      {wrongAnswers.map((wa, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/50 rounded-xl p-4 border border-slate-700"
                        >
                          <div className="text-white font-medium mb-3"><MathRenderer content={wa.question} /></div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-red-400">Your answer: </span>
                                <span className="text-slate-300"><MathRenderer content={wa.userAnswer} /></span>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-green-400">Correct answer: </span>
                                <span className="text-slate-300"><MathRenderer content={wa.correctAnswer} /></span>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-700">
                              <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                              <div className="text-slate-400"><MathRenderer content={wa.explanation} /></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleTryAgain}
              disabled={isRegenerating}
              className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </>
              )}
            </button>
            <button
              onClick={handleDone}
              disabled={isRegenerating}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-xl hover:from-blue-500 hover:to-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Done
            </button>
          </div>

          {hasWrongAnswers && (
            <p className="text-xs text-slate-500 text-center mt-3">
              Wrong answers will be added to chat when you click Done
            </p>
          )}
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Question {currentIndex + 1} of {questions.length}
              </h2>
              <p className="text-xs text-slate-400">
                {currentQuestion.type === 'multiple_choice'
                  ? 'Multiple Choice'
                  : 'Open Ended'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-700 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Score indicator */}
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-slate-400">
            Score: <span className="text-green-400 font-medium">{totalScore}</span>/
            {currentIndex}
          </span>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              currentQuestion.type === 'multiple_choice'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-blue-500/20 text-blue-300'
            }`}
          >
            {currentQuestion.type === 'multiple_choice' ? 'MC' : 'Open'}
          </span>
        </div>

        {/* Question */}
        <div className="mb-6">
          <div className="text-lg text-white leading-relaxed">
            <MathRenderer content={currentQuestion.question} />
          </div>
        </div>

        {/* Answer Options */}
        <AnimatePresence mode="wait">
          {currentQuestion.type === 'multiple_choice' ? (
            <motion.div
              key="multiple-choice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3 mb-6"
            >
              {currentQuestion.options?.map((option, index) => {
                const isSelected = selectedAnswer === index
                const isCorrectOption = index === currentQuestion.correctAnswer
                const showResult = isSubmitted

                let optionClass =
                  'w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 '

                if (showResult) {
                  if (isCorrectOption) {
                    optionClass +=
                      'bg-green-500/20 border-2 border-green-500 text-white'
                  } else if (isSelected && !isCorrectOption) {
                    optionClass += 'bg-red-500/20 border-2 border-red-500 text-white'
                  } else {
                    optionClass +=
                      'bg-slate-700/50 border-2 border-transparent text-slate-400'
                  }
                } else {
                  if (isSelected) {
                    optionClass +=
                      'bg-blue-600/20 border-2 border-blue-500 text-white'
                  } else {
                    optionClass +=
                      'bg-slate-700 border-2 border-transparent text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => !isSubmitted && setSelectedAnswer(index)}
                    disabled={isSubmitted}
                    className={optionClass}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                        showResult
                          ? isCorrectOption
                            ? 'bg-green-500 text-white'
                            : isSelected
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-600 text-slate-400'
                          : isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-600 text-slate-300'
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1"><MathRenderer content={option} /></span>
                    {showResult && isCorrectOption && (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                    {showResult && isSelected && !isCorrectOption && (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </button>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="open-ended"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              {!isSubmitted ? (
                <div className="relative">
                  <textarea
                    value={openEndedAnswer}
                    onChange={(e) => setOpenEndedAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    rows={4}
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-xl ${
                      isCorrect
                        ? 'bg-green-500/20 border-2 border-green-500'
                        : 'bg-red-500/20 border-2 border-red-500'
                    }`}
                  >
                    <p className="text-sm text-slate-400 mb-1">Your answer:</p>
                    <p className="text-white">{openEndedAnswer}</p>
                  </div>
                  {!isCorrect && (
                    <div className="p-4 rounded-xl bg-green-500/10 border-2 border-green-500/50">
                      <p className="text-sm text-slate-400 mb-1">Correct answer:</p>
                      <div className="text-green-300">
                        <MathRenderer content={currentQuestion.correctAnswerText || ''} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback */}
        <AnimatePresence>
          {isSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 p-4 rounded-xl ${
                isCorrect
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {isCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                )}
                <div>
                  <p
                    className={`font-semibold mb-1 ${
                      isCorrect ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </p>
                  <div className="flex items-start gap-2 text-sm text-slate-300">
                    <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div><MathRenderer content={currentQuestion.explanation} /></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3">
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={
                (currentQuestion.type === 'multiple_choice' &&
                  selectedAnswer === null) ||
                (currentQuestion.type === 'open_ended' && !openEndedAnswer.trim()) ||
                isCheckingAnswer
              }
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-xl hover:from-blue-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCheckingAnswer ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Answer
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-xl hover:from-blue-500 hover:to-blue-500 transition-all flex items-center justify-center gap-2"
            >
              {isLastQuestion ? (
                <>
                  <Trophy className="w-4 h-4" />
                  See Results
                </>
              ) : (
                <>
                  Next Question
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
