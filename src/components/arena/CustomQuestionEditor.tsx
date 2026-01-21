'use client'

/**
 * Custom Question Editor Component
 *
 * Allows users to create their own questions for CUSTOM mode.
 * Supports:
 * - Adding/removing questions
 * - 4 options per question
 * - Correct answer selection
 * - Optional explanation
 */

import { useState } from 'react'
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import type { CustomQuestion } from '@/lib/arena/types'

interface CustomQuestionEditorProps {
  questions: CustomQuestion[]
  onChange: (questions: CustomQuestion[]) => void
}

export function CustomQuestionEditor({ questions, onChange }: CustomQuestionEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  const addQuestion = () => {
    const newQuestion: CustomQuestion = {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
    }
    onChange([...questions, newQuestion])
    setExpandedIndex(questions.length)
  }

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index)
    onChange(updated)
    if (expandedIndex === index) {
      setExpandedIndex(null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const updateQuestion = (index: number, updates: Partial<CustomQuestion>) => {
    const updated = questions.map((q, i) =>
      i === index ? { ...q, ...updates } : q
    )
    onChange(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = questions[questionIndex]
    const newOptions: [string, string, string, string] = [...question.options] as [string, string, string, string]
    newOptions[optionIndex] = value
    updateQuestion(questionIndex, { options: newOptions })
  }

  const isQuestionValid = (q: CustomQuestion) => {
    return (
      q.question.trim().length > 0 &&
      q.options.every((opt) => opt.trim().length > 0)
    )
  }

  const validCount = questions.filter(isQuestionValid).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            Questions
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {validCount} of {questions.length} complete (min 3 required)
          </p>
        </div>
        <button
          onClick={addQuestion}
          disabled={questions.length >= 50}
          className="px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="text-center py-12 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">
            No questions yet
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
            Add at least 3 questions to create an arena
          </p>
          <button
            onClick={addQuestion}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Add First Question
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => {
            const isValid = isQuestionValid(q)
            const isExpanded = expandedIndex === index

            return (
              <div
                key={index}
                className={`bg-white dark:bg-neutral-900 border rounded-xl overflow-hidden transition-all ${
                  isValid
                    ? 'border-neutral-200 dark:border-neutral-800'
                    : 'border-amber-300 dark:border-amber-700'
                }`}
              >
                {/* Question Header */}
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-sm font-medium text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-neutral-900 dark:text-white">
                    {q.question || 'Untitled question'}
                  </span>
                  {isValid ? (
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                {/* Question Editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-neutral-200 dark:border-neutral-800">
                    {/* Question Text */}
                    <div className="pt-4">
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Question
                      </label>
                      <textarea
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(index, { question: e.target.value })
                        }
                        placeholder="Enter your question..."
                        rows={2}
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Options */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Answer Options (click to set correct answer)
                      </label>
                      <div className="space-y-2">
                        {q.options.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuestion(index, { correctAnswer: optIndex })
                              }
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors flex-shrink-0 ${
                                q.correctAnswer === optIndex
                                  ? 'bg-green-500 text-white'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400'
                              }`}
                            >
                              {String.fromCharCode(65 + optIndex)}
                            </button>
                            <input
                              type="text"
                              value={option}
                              onChange={(e) =>
                                updateOption(index, optIndex, e.target.value)
                              }
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation (optional) */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Explanation{' '}
                        <span className="font-normal text-neutral-400">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        value={q.explanation || ''}
                        onChange={(e) =>
                          updateQuestion(index, { explanation: e.target.value })
                        }
                        placeholder="Explain why the correct answer is correct..."
                        rows={2}
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Delete Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => removeQuestion(index)}
                        className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {questions.length > 0 && validCount < 3 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          Complete at least {3 - validCount} more question{3 - validCount !== 1 ? 's' : ''} to create the arena
        </div>
      )}
    </div>
  )
}
