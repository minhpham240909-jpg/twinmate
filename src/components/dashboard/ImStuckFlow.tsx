'use client'

/**
 * ImStuckFlow - AI Study Guidance Entry Point
 *
 * Vision: When students don't know what to study, AI provides DIRECTION
 *
 * Improved Flow:
 * 1. User clicks "I'm stuck"
 * 2. Modal asks: "What subject are you stuck on?"
 * 3. AI asks 1-3 smart diagnostic questions
 * 4. User answers via quick-select or text
 * 5. AI generates personalized study roadmap
 * 6. User can [Start] [Adjust] [Skip]
 * 7. Roadmap is passed to Study Room for progress tracking
 *
 * Rule: AI asks like a counselor - few targeted questions, not surveys
 * Rule: Roadmap is specific to their situation, not template-based
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Loader2,
  Play,
  Pencil,
  SkipForward,
  BookOpen,
  Clock,
  Sparkles,
  ArrowRight,
  MessageCircle,
  ChevronRight,
  Lightbulb,
} from 'lucide-react'

// Types
interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Question {
  id: string
  text: string
  type: 'single-select' | 'text'
  options?: string[]
}

interface StudyPlanStep {
  id: string
  order: number
  duration: number
  title: string
  description: string
  tips?: string[]
}

interface StudyPlan {
  id: string
  subject: string
  totalMinutes: number
  encouragement: string
  steps: StudyPlanStep[]
}

interface ImStuckFlowProps {
  className?: string
}

type FlowStep = 'input' | 'questions' | 'generating' | 'plan'

export default function ImStuckFlow({
  className = '',
}: ImStuckFlowProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<FlowStep>('input')
  const [subject, setSubject] = useState('')
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Conversation state for questions flow
  const [messages, setMessages] = useState<Message[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [canGenerate, setCanGenerate] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && step === 'input' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, step])

  // Reset state when closing
  const handleClose = () => {
    setIsOpen(false)
    setStep('input')
    setSubject('')
    setPlan(null)
    setMessages([])
    setCurrentQuestion(null)
    setCustomAnswer('')
    setCanGenerate(false)
    setQuestionCount(0)
  }

  // Start the questions flow
  const handleStartQuestions = async () => {
    const topicToUse = subject.trim()
    if (!topicToUse) return

    setStep('questions')
    setIsLoadingQuestion(true)

    try {
      const response = await fetch('/api/study/stuck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          subject: topicToUse,
          messages: [],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.questions && data.questions.length > 0) {
          setCurrentQuestion(data.questions[0])
          setCanGenerate(data.canGenerate || false)
          setQuestionCount(1)
        } else {
          // Fallback: go directly to plan generation
          await handleGeneratePlan([])
        }
      } else {
        // Fallback: go directly to plan generation
        await handleGeneratePlan([])
      }
    } catch (error) {
      console.error('Error fetching questions:', error)
      // Fallback: go directly to plan generation
      await handleGeneratePlan([])
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  // Handle answer selection
  const handleAnswerSelect = async (answer: string) => {
    if (!currentQuestion) return

    // Add the Q&A to messages
    const newMessages: Message[] = [
      ...messages,
      { role: 'assistant', content: currentQuestion.text },
      { role: 'user', content: answer },
    ]
    setMessages(newMessages)
    setCustomAnswer('')

    // After 3 questions or if canGenerate, generate the plan
    if (questionCount >= 3 || canGenerate) {
      await handleGeneratePlan(newMessages)
      return
    }

    // Otherwise, get the next question
    setIsLoadingQuestion(true)
    try {
      const topicToUse = subject.trim()
      const response = await fetch('/api/study/stuck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          subject: topicToUse,
          messages: newMessages,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.questions && data.questions.length > 0) {
          setCurrentQuestion(data.questions[0])
          setCanGenerate(data.canGenerate || false)
          setQuestionCount(prev => prev + 1)
        } else {
          // No more questions, generate plan
          await handleGeneratePlan(newMessages)
        }
      } else {
        await handleGeneratePlan(newMessages)
      }
    } catch (error) {
      console.error('Error fetching next question:', error)
      await handleGeneratePlan(newMessages)
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  // Skip remaining questions and generate plan
  const handleSkipToGenerate = async () => {
    await handleGeneratePlan(messages)
  }

  // Generate study plan
  const handleGeneratePlan = async (conversationMessages: Message[]) => {
    const topicToUse = subject.trim()
    if (!topicToUse) return

    setStep('generating')

    try {
      const response = await fetch('/api/study/stuck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          subject: topicToUse,
          messages: conversationMessages,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPlan(data.plan)
        setStep('plan')
      } else {
        // Fallback plan
        setPlan(createFallbackPlan(topicToUse))
        setStep('plan')
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      setPlan(createFallbackPlan(topicToUse))
      setStep('plan')
    }
  }

  // Create fallback plan
  const createFallbackPlan = (topic: string): StudyPlan => ({
    id: crypto.randomUUID(),
    subject: topic,
    totalMinutes: 25,
    encouragement: "Let's work through this together. You've got this!",
    steps: [
      {
        id: crypto.randomUUID(),
        order: 1,
        duration: 5,
        title: 'Review key concepts',
        description: 'Look over the main ideas and definitions you need',
      },
      {
        id: crypto.randomUUID(),
        order: 2,
        duration: 10,
        title: 'Practice with examples',
        description: 'Work through 2-3 practice problems step by step',
      },
      {
        id: crypto.randomUUID(),
        order: 3,
        duration: 10,
        title: 'Test your understanding',
        description: 'Explain the concept in your own words or solve a new problem',
      },
    ],
  })

  // Start session with the plan - creates session and redirects to Solo Study Room
  const handleStartPlan = async () => {
    if (!plan || isStarting) return
    setIsStarting(true)

    try {
      // Store the plan in sessionStorage for the Solo Study Room
      sessionStorage.setItem('imstuck_study_plan', JSON.stringify(plan))

      // Also store a flag to auto-start the session when the page loads
      sessionStorage.setItem('imstuck_auto_start', 'true')

      // Redirect to Solo Study Room - it will pick up the plan and auto-start
      router.push('/solo-study')
    } catch (error) {
      console.error('Error starting session:', error)
      router.push('/solo-study')
    } finally {
      setIsStarting(false)
      handleClose()
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-xl transition-colors group ${className}`}
      >
        <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="font-medium text-sm text-neutral-900 dark:text-white">Guide Me</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                    {step === 'questions' ? (
                      <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                      {step === 'input' && "Let's figure it out"}
                      {step === 'questions' && 'Understanding your situation'}
                      {step === 'generating' && 'Creating your plan...'}
                      {step === 'plan' && 'Your study plan'}
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {step === 'input' && 'What are you stuck on?'}
                      {step === 'questions' && `Question ${questionCount} of 3`}
                      {step === 'generating' && 'AI is thinking...'}
                      {step === 'plan' && `${plan?.totalMinutes} minutes`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Step 1: Input */}
              {step === 'input' && (
                <div className="space-y-4">
                  {/* Type subject */}
                  <div>
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                      What subject or topic?
                    </p>
                    <input
                      ref={inputRef}
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Chemistry - acids & bases"
                      className="w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border-0 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-blue-500 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && subject.trim()) {
                          handleStartQuestions()
                        }
                      }}
                    />
                  </div>

                  {/* Continue button */}
                  <button
                    onClick={handleStartQuestions}
                    disabled={!subject.trim()}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-200 dark:disabled:bg-neutral-700 text-white disabled:text-neutral-500 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Step 2: Questions */}
              {step === 'questions' && (
                <div className="space-y-4">
                  {isLoadingQuestion ? (
                    <div className="py-8 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                      <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                        Thinking...
                      </p>
                    </div>
                  ) : currentQuestion ? (
                    <>
                      {/* Question */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                        <p className="text-neutral-900 dark:text-white font-medium">
                          {currentQuestion.text}
                        </p>
                      </div>

                      {/* Quick select options */}
                      {currentQuestion.options && (
                        <div className="grid grid-cols-2 gap-2">
                          {currentQuestion.options.map((option, index) => (
                            <button
                              key={index}
                              onClick={() => handleAnswerSelect(option)}
                              className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white transition-colors text-left"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Or type custom answer */}
                      <div className="relative">
                        <input
                          type="text"
                          value={customAnswer}
                          onChange={(e) => setCustomAnswer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customAnswer.trim()) {
                              handleAnswerSelect(customAnswer.trim())
                            }
                          }}
                          placeholder="Or type your answer..."
                          className="w-full px-4 py-3 pr-12 bg-neutral-100 dark:bg-neutral-800 border-0 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {customAnswer.trim() && (
                          <button
                            onClick={() => handleAnswerSelect(customAnswer.trim())}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <ArrowRight className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>

                      {/* Skip to generate */}
                      {questionCount >= 1 && (
                        <button
                          onClick={handleSkipToGenerate}
                          className="w-full py-3 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm transition-colors"
                        >
                          Skip questions and create plan
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {/* Step 3: Generating */}
              {step === 'generating' && (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-neutral-600 dark:text-neutral-400">
                    Creating your personalized study plan...
                  </p>
                </div>
              )}

              {/* Step 4: Show Plan */}
              {step === 'plan' && plan && (
                <div className="space-y-4">
                  {/* Encouragement */}
                  {plan.encouragement && (
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4">
                      <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-neutral-700 dark:text-neutral-300 text-sm">
                        {plan.encouragement}
                      </p>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm">{plan.subject}</span>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    {plan.steps.map((planStep, index) => (
                      <div
                        key={planStep.id}
                        className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-neutral-900 dark:text-white">
                                {planStep.title}
                              </span>
                              <span className="text-xs text-neutral-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {planStep.duration} min
                              </span>
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                              {planStep.description}
                            </p>
                            {planStep.tips && planStep.tips.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {planStep.tips.map((tip, tipIndex) => (
                                  <p key={tipIndex} className="text-xs text-neutral-500 dark:text-neutral-500 flex items-start gap-1">
                                    <span className="text-amber-500">•</span>
                                    {tip}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total time */}
                  <div className="flex items-center justify-center gap-2 py-2 text-neutral-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Total: {plan.totalMinutes} minutes</span>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleStartPlan}
                      disabled={isStarting}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Starting...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 fill-white" />
                          <span>Start This Plan</span>
                        </>
                      )}
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setStep('input')
                          setMessages([])
                          setQuestionCount(0)
                        }}
                        className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        <span>Adjust</span>
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" />
                        <span>Skip</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
