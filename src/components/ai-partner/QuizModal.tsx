'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Brain, X, Minus, Plus, Sparkles } from 'lucide-react'

export type QuestionType = 'multiple_choice' | 'open_ended' | 'both'
export type Difficulty = 'easy' | 'medium' | 'hard'

interface QuizModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (config: {
    count: number
    questionType: QuestionType
    difficulty: Difficulty
  }) => Promise<void>
  isGenerating?: boolean
}

export default function QuizModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
}: QuizModalProps) {
  const t = useTranslations('aiPartner')
  const [count, setCount] = useState(5)
  const [questionType, setQuestionType] = useState<QuestionType>('both')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const handleGenerate = async () => {
    await onGenerate({ count, questionType, difficulty })
  }

  const incrementCount = () => {
    if (count < 10) setCount(count + 1)
  }

  const decrementCount = () => {
    if (count > 1) setCount(count - 1)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Generate Quiz
              </h3>
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Count */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Number of Questions
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={decrementCount}
                  disabled={count <= 1 || isGenerating}
                  className="w-10 h-10 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="w-20 text-center">
                  <span className="text-3xl font-bold text-white">{count}</span>
                </div>
                <button
                  onClick={incrementCount}
                  disabled={count >= 10 || isGenerating}
                  className="w-10 h-10 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center mt-2">
                1-10 questions
              </p>
            </div>

            {/* Question Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Question Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'multiple_choice', label: 'Multiple Choice' },
                  { value: 'open_ended', label: 'Open Ended' },
                  { value: 'both', label: 'Both' },
                ] as const).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setQuestionType(type.value)}
                    disabled={isGenerating}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      questionType === type.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } disabled:opacity-50`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'easy', label: 'Easy', color: 'green' },
                  { value: 'medium', label: 'Medium', color: 'yellow' },
                  { value: 'hard', label: 'Hard', color: 'red' },
                ] as const).map((diff) => (
                  <button
                    key={diff.value}
                    onClick={() => setDifficulty(diff.value)}
                    disabled={isGenerating}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      difficulty === diff.value
                        ? diff.color === 'green'
                          ? 'bg-green-600 text-white'
                          : diff.color === 'yellow'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-red-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } disabled:opacity-50`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Quiz
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
