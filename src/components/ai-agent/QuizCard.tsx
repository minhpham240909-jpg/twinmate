'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronRight, ChevronLeft, Trophy } from 'lucide-react'

interface QuizItem {
  q: string
  choices: [string, string, string, string]
  answer: string
  explanation?: string
  source?: string
}

interface QuizCardProps {
  quizId: string
  title: string
  items: QuizItem[]
  onComplete?: (score: number, answers: any[]) => void
}

export default function QuizCard({ quizId, title, items, onComplete }: QuizCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>(
    Array(items.length).fill(null)
  )
  const [showResults, setShowResults] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const currentItem = items[currentIndex]
  const currentAnswer = selectedAnswers[currentIndex]
  const totalQuestions = items.length

  const handleSelectAnswer = (choice: string) => {
    if (submitted) return

    const newAnswers = [...selectedAnswers]
    newAnswers[currentIndex] = choice
    setSelectedAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setShowResults(true)

    // Calculate score
    const correctCount = items.filter(
      (item, idx) => selectedAnswers[idx] === item.answer
    ).length
    const score = (correctCount / totalQuestions) * 100

    // Prepare answers for API
    const answers = items.map((item, idx) => ({
      itemIndex: idx,
      selectedAnswer: selectedAnswers[idx],
      isCorrect: selectedAnswers[idx] === item.answer,
    }))

    onComplete?.(score, answers)
  }

  const calculateScore = () => {
    const correctCount = items.filter(
      (item, idx) => selectedAnswers[idx] === item.answer
    ).length
    return (correctCount / totalQuestions) * 100
  }

  const isCorrect = (itemIndex: number) => {
    return selectedAnswers[itemIndex] === items[itemIndex].answer
  }

  const allAnswered = selectedAnswers.every(answer => answer !== null)

  if (showResults) {
    const score = calculateScore()
    const correctCount = items.filter((item, idx) => isCorrect(idx)).length

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-2xl mx-auto"
      >
        {/* Results Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
          >
            <Trophy className="w-10 h-10 text-white" />
          </motion.div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">Quiz Complete!</h2>
          <p className="text-slate-600">
            You scored <span className="font-bold text-blue-600">{score.toFixed(0)}%</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {correctCount} out of {totalQuestions} correct
          </p>
        </div>

        {/* Answer Review */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border-2 ${
                isCorrect(idx)
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-full ${
                  isCorrect(idx) ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {isCorrect(idx) ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-semibold text-slate-900 mb-2">{item.q}</p>

                  <div className="space-y-1 text-sm">
                    <p className={isCorrect(idx) ? 'text-green-700' : 'text-red-700'}>
                      Your answer: <span className="font-semibold">{selectedAnswers[idx]}</span>
                    </p>
                    {!isCorrect(idx) && (
                      <p className="text-green-700">
                        Correct answer: <span className="font-semibold">{item.answer}</span>
                      </p>
                    )}
                  </div>

                  {item.explanation && (
                    <p className="text-xs text-slate-600 mt-2 italic">
                      {item.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setShowResults(false)
            setSubmitted(false)
            setSelectedAnswers(Array(items.length).fill(null))
            setCurrentIndex(0)
          }}
          className="mt-6 w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Retake Quiz
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{Math.round(((currentIndex + 1) / totalQuestions) * 100)}% complete</span>
        </div>
        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-xl font-semibold text-slate-900 mb-6">
            {currentItem.q}
          </h3>

          {/* Choices */}
          <div className="space-y-3 mb-8">
            {currentItem.choices.map((choice, idx) => {
              const isSelected = currentAnswer === choice
              const letter = String.fromCharCode(65 + idx) // A, B, C, D

              return (
                <motion.button
                  key={idx}
                  onClick={() => handleSelectAnswer(choice)}
                  whileHover={{ scale: submitted ? 1 : 1.02 }}
                  whileTap={{ scale: submitted ? 1 : 0.98 }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  } ${submitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {letter}
                    </div>
                    <span className="text-slate-900">{choice}</span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        {currentIndex === totalQuestions - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitted}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
