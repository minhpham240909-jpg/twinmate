'use client'

/**
 * IDENTITY DISCOVERY COMPONENT
 *
 * The first 2-minute moment that makes users feel:
 * "This app understands ME"
 *
 * Philosophy:
 * - 3 quick questions (not a survey)
 * - Each question reveals something about them
 * - Immediately creates "You're becoming X" narrative
 * - No wrong answers - everything maps to strengths
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  Brain,
  Target,
  Zap,
  Clock,
  BookOpen,
  Puzzle,
  Eye,
  Headphones,
  PenTool,
  CheckCircle2,
} from 'lucide-react'

// Types for the discovery flow
interface DiscoveryAnswer {
  id: string
  label: string
  icon: React.ReactNode
  strengths: string[]
  archetype: string
}

interface DiscoveryQuestion {
  id: string
  question: string
  subtext: string
  options: DiscoveryAnswer[]
}

interface IdentityResult {
  archetype: string
  strengths: string[]
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'night'
  learningStyle: string
}

interface IdentityDiscoveryProps {
  onComplete: (identity: IdentityResult) => void
  onSkip?: () => void
}

// The 3 questions that reveal identity
const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  {
    id: 'learning-style',
    question: "How do you learn best?",
    subtext: "Pick what feels most natural to you",
    options: [
      {
        id: 'visual',
        label: 'Seeing diagrams & examples',
        icon: <Eye className="w-5 h-5" />,
        strengths: ['Visual pattern recognition', 'Diagram comprehension'],
        archetype: 'The Visual Thinker',
      },
      {
        id: 'reading',
        label: 'Reading & taking notes',
        icon: <BookOpen className="w-5 h-5" />,
        strengths: ['Deep comprehension', 'Note synthesis'],
        archetype: 'The Scholar',
      },
      {
        id: 'doing',
        label: 'Hands-on practice',
        icon: <PenTool className="w-5 h-5" />,
        strengths: ['Practical application', 'Learning by doing'],
        archetype: 'The Builder',
      },
      {
        id: 'listening',
        label: 'Listening & discussing',
        icon: <Headphones className="w-5 h-5" />,
        strengths: ['Auditory processing', 'Conceptual discussion'],
        archetype: 'The Communicator',
      },
    ],
  },
  {
    id: 'challenge-response',
    question: "When something is hard, you usually...",
    subtext: "There's no wrong answer here",
    options: [
      {
        id: 'break-down',
        label: 'Break it into smaller pieces',
        icon: <Puzzle className="w-5 h-5" />,
        strengths: ['Problem decomposition', 'Systematic thinking'],
        archetype: 'The Methodical Master',
      },
      {
        id: 'find-pattern',
        label: 'Look for patterns or shortcuts',
        icon: <Brain className="w-5 h-5" />,
        strengths: ['Pattern recognition', 'Strategic thinking'],
        archetype: 'The Pattern Seeker',
      },
      {
        id: 'push-through',
        label: 'Push through until it clicks',
        icon: <Zap className="w-5 h-5" />,
        strengths: ['Persistence', 'Grit under pressure'],
        archetype: 'The Resilient Learner',
      },
      {
        id: 'get-help',
        label: 'Ask for help or find resources',
        icon: <Target className="w-5 h-5" />,
        strengths: ['Resourcefulness', 'Collaborative learning'],
        archetype: 'The Resource Hunter',
      },
    ],
  },
  {
    id: 'best-time',
    question: "When's your brain sharpest?",
    subtext: "We'll remind you at the right time",
    options: [
      {
        id: 'morning',
        label: 'Morning (6am - 12pm)',
        icon: <Clock className="w-5 h-5" />,
        strengths: ['Morning focus', 'Fresh-mind clarity'],
        archetype: 'Early Riser',
      },
      {
        id: 'afternoon',
        label: 'Afternoon (12pm - 6pm)',
        icon: <Clock className="w-5 h-5" />,
        strengths: ['Sustained focus', 'Post-warmup productivity'],
        archetype: 'Steady Performer',
      },
      {
        id: 'evening',
        label: 'Evening (6pm - 10pm)',
        icon: <Clock className="w-5 h-5" />,
        strengths: ['Evening clarity', 'Day-end reflection'],
        archetype: 'Night Owl',
      },
      {
        id: 'night',
        label: 'Late night (10pm+)',
        icon: <Clock className="w-5 h-5" />,
        strengths: ['Deep night focus', 'Uninterrupted thinking'],
        archetype: 'Midnight Scholar',
      },
    ],
  },
]

export default function IdentityDiscovery({ onComplete, onSkip }: IdentityDiscoveryProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, DiscoveryAnswer>>({})
  const [isProcessing, setIsProcessing] = useState(false)

  const currentQuestion = DISCOVERY_QUESTIONS[currentStep]
  const isLastQuestion = currentStep === DISCOVERY_QUESTIONS.length - 1

  const handleSelect = useCallback((option: DiscoveryAnswer) => {
    const questionId = currentQuestion.id
    setAnswers(prev => ({ ...prev, [questionId]: option }))

    if (isLastQuestion) {
      // Process all answers and create identity
      setIsProcessing(true)

      const allAnswers = { ...answers, [questionId]: option }

      // Combine all strengths (unique)
      const allStrengths = new Set<string>()
      Object.values(allAnswers).forEach(ans => {
        ans.strengths.forEach(s => allStrengths.add(s))
      })

      // Determine primary archetype from challenge response (most defining)
      const challengeAnswer = allAnswers['challenge-response']
      const learningAnswer = allAnswers['learning-style']
      const timeAnswer = allAnswers['best-time']

      // Create composite archetype
      const archetype = challengeAnswer?.archetype || learningAnswer?.archetype || 'The Learner'

      const result: IdentityResult = {
        archetype,
        strengths: Array.from(allStrengths).slice(0, 4), // Top 4 strengths
        preferredTime: (timeAnswer?.id as IdentityResult['preferredTime']) || 'morning',
        learningStyle: learningAnswer?.id || 'visual',
      }

      // Small delay for dramatic effect
      setTimeout(() => {
        onComplete(result)
      }, 800)
    } else {
      // Move to next question with slight delay for animation
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, 300)
    }
  }, [currentQuestion, isLastQuestion, answers, onComplete])

  return (
    <div className="min-h-[400px] flex flex-col">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {DISCOVERY_QUESTIONS.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx < currentStep
                ? 'w-8 bg-blue-500'
                : idx === currentStep
                ? 'w-8 bg-blue-500'
                : 'w-4 bg-neutral-700'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {isProcessing ? (
          // Processing state - building identity
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-4"
          >
            <div className="mb-6">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Configuring preferences...
            </h3>
            <p className="text-neutral-400">
              Setting up your profile
            </p>
          </motion.div>
        ) : (
          // Question display
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            {/* Question */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {currentQuestion.question}
              </h2>
              <p className="text-neutral-400">
                {currentQuestion.subtext}
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2">
              {currentQuestion.options.map((option) => {
                const isSelected = answers[currentQuestion.id]?.id === option.id

                return (
                  <motion.button
                    key={option.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(option)}
                    className={`
                      relative p-4 rounded-xl border-2 text-left transition-all
                      ${isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600 hover:bg-neutral-800'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`
                        p-2 rounded-lg
                        ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-700 text-neutral-400'}
                      `}>
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <span className={`
                          font-medium block
                          ${isSelected ? 'text-white' : 'text-neutral-200'}
                        `}>
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500 absolute top-3 right-3" />
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip option (subtle) */}
      {onSkip && !isProcessing && (
        <div className="mt-8 text-center">
          <button
            onClick={onSkip}
            className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Identity Reveal Component
 * Shows after discovery completes - the "You're becoming X" moment
 */
interface IdentityRevealProps {
  identity: IdentityResult
  onContinue: () => void
}

export function IdentityReveal({ identity, onContinue }: IdentityRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center px-4 py-8"
    >
      {/* Archetype reveal */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mb-6"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          You&apos;re becoming
        </h2>
        <p className="text-2xl font-bold text-blue-400">
          {identity.archetype}
        </p>
      </motion.div>

      {/* Strengths */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mb-8"
      >
        <p className="text-neutral-400 mb-3">Your strengths:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {identity.strengths.map((strength, idx) => (
            <motion.span
              key={strength}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + idx * 0.1 }}
              className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium"
            >
              {strength}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Personalized message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-neutral-300 mb-8 max-w-md mx-auto"
      >
        I&apos;ll remember this. Every mission I give you will build on these strengths
        while helping you grow where you need it most.
      </motion.p>

      {/* Continue button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        onClick={onContinue}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
      >
        Let&apos;s start your first mission
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </motion.div>
  )
}
