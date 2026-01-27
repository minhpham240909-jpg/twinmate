'use client'

/**
 * GOAL CLARIFICATION DIALOG
 *
 * When a user enters a vague or ambitious goal, this component helps
 * clarify what they want to learn by presenting options.
 *
 * Features:
 * - Shows the AI's understanding of the goal
 * - Presents clarification options
 * - Allows custom input
 * - Shows estimated timeline
 */

import { useState } from 'react'
import {
  Lightbulb,
  Clock,
  ChevronRight,
  Sparkles,
  X,
  ArrowRight,
  Check,
  BookOpen,
  Rocket,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface ClarificationOption {
  id: string
  label: string
  description: string
  estimatedDuration?: string
  skills?: string[]
}

// Non-educational domain types
export type NonEducationalDomain =
  | 'fitness'       // Workout tracking, calorie counting, etc.
  | 'productivity'  // Task management, timers, scheduling
  | 'finance'       // Budget tracking, expense logging
  | 'lifestyle'     // Meal planning, habit tracking
  | 'social'        // Chat, entertainment requests
  | 'utility'       // Calculations, conversions, bookings

export interface GoalAnalysis {
  originalGoal: string
  goalType: string
  timelineType: string
  estimatedDuration: string
  isDirectlyLearnable: boolean
  needsClarification: boolean
  clarificationOptions?: ClarificationOption[]
  suggestedFocus?: string
  convertedGoal?: string
  phases?: string[]
  confidence: number
  // Non-educational request handling
  isNonEducational?: boolean
  nonEducationalDomain?: NonEducationalDomain
  featureComingSoon?: string
  educationalAlternatives?: ClarificationOption[]
}

interface GoalClarificationDialogProps {
  analysis: GoalAnalysis
  onSelectOption: (option: ClarificationOption) => void
  onCustomGoal: (goal: string) => void
  onCancel: () => void
  isLoading?: boolean
}

// ============================================
// OPTION CARD COMPONENT
// ============================================

function OptionCard({
  option,
  isSelected,
  onSelect,
}: {
  option: ClarificationOption
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full p-4 rounded-xl border-2 text-left transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/10'
          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-300 dark:hover:border-blue-700'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5
            ${isSelected
              ? 'border-blue-500 bg-blue-500'
              : 'border-neutral-300 dark:border-neutral-600'
            }
          `}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
            {option.label}
          </h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
            {option.description}
          </p>

          {/* Skills preview */}
          {option.skills && option.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {option.skills.slice(0, 3).map((skill, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-700 rounded-full text-neutral-600 dark:text-neutral-400"
                >
                  {skill}
                </span>
              ))}
              {option.skills.length > 3 && (
                <span className="px-2 py-0.5 text-xs text-neutral-500">
                  +{option.skills.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Duration estimate */}
          {option.estimatedDuration && (
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              <span>{option.estimatedDuration}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GoalClarificationDialog({
  analysis,
  onSelectOption,
  onCustomGoal,
  onCancel,
  isLoading = false,
}: GoalClarificationDialogProps) {
  const [selectedOption, setSelectedOption] = useState<ClarificationOption | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customGoal, setCustomGoal] = useState('')

  const handleContinue = () => {
    if (showCustomInput && customGoal.trim()) {
      onCustomGoal(customGoal.trim())
    } else if (selectedOption) {
      onSelectOption(selectedOption)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              analysis.isNonEducational
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                : 'bg-gradient-to-br from-blue-500 to-purple-500'
            }`}>
              {analysis.isNonEducational ? (
                <BookOpen className="w-5 h-5 text-white" />
              ) : (
                <Lightbulb className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                {analysis.isNonEducational
                  ? 'Learn about this topic instead'
                  : 'Let\'s clarify your goal'}
              </h2>
              <p className="text-sm text-neutral-500">
                {analysis.isNonEducational
                  ? 'Clerva focuses on learning and education'
                  : 'Help me understand what you want to learn'}
              </p>
            </div>
          </div>

          {/* Original goal display */}
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <div className="text-xs text-neutral-500 mb-1">Your goal:</div>
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              &ldquo;{analysis.originalGoal}&rdquo;
            </div>
          </div>

          {/* AI understanding */}
          {analysis.convertedGoal && (
            <div className="mt-3 flex items-start gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-neutral-600 dark:text-neutral-400">
                I can help you with: <span className="font-medium text-neutral-800 dark:text-neutral-200">{analysis.convertedGoal}</span>
              </p>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {!showCustomInput ? (
            <>
              {/* Non-educational request - show coming soon message and educational alternatives */}
              {analysis.isNonEducational && analysis.featureComingSoon && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
                      <Rocket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                        Coming Soon
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {analysis.featureComingSoon}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show educational alternatives for non-educational requests */}
              {analysis.isNonEducational && analysis.educationalAlternatives && analysis.educationalAlternatives.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    <BookOpen className="w-4 h-4" />
                    <span>In the meantime, you can learn about this topic:</span>
                  </div>

                  <div className="space-y-3">
                    {analysis.educationalAlternatives.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        isSelected={selectedOption?.id === option.id}
                        onSelect={() => setSelectedOption(option)}
                      />
                    ))}

                    {/* Custom option */}
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-left hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-sm font-medium">Something else...</span>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Which aspect would you like to focus on?
                  </div>

                  <div className="space-y-3">
                    {analysis.clarificationOptions?.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        isSelected={selectedOption?.id === option.id}
                        onSelect={() => setSelectedOption(option)}
                      />
                    ))}

                    {/* Custom option */}
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-left hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-sm font-medium">Something else...</span>
                      </div>
                    </button>
                  </div>

                  {/* Suggested focus */}
                  {analysis.suggestedFocus && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                          <span className="font-medium">Suggestion:</span> {analysis.suggestedFocus}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                What specifically would you like to learn?
              </div>

              <textarea
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="E.g., I want to learn how to build mobile apps using React Native..."
                className="w-full p-4 h-32 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                autoFocus
              />

              <button
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomGoal('')
                }}
                className="mt-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                ← Back to options
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            {/* Timeline estimate */}
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Clock className="w-4 h-4" />
              <span>Est. {analysis.estimatedDuration}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={(!selectedOption && !customGoal.trim()) || isLoading}
                className={`
                  flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
                  ${(selectedOption || customGoal.trim()) && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>Create Roadmap</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoalClarificationDialog
