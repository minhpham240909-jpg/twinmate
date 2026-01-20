'use client'

/**
 * Quick Session Page - Instant AI Study Help
 *
 * Flow: Pick intent → See assignment → Type question → Read answer → Done
 *
 * Step 1: Show 4 intent options (Explain, Solve, Review, Plan)
 * Step 2: After picking, show specific prompt/assignment
 * Step 3: User types question and gets AI response
 *
 * UX Improvements:
 * - Smooth transitions between steps
 * - Loading skeleton during AI response
 * - Keyboard shortcuts (Enter to submit when focused)
 * - Auto-resize textarea
 * - Better error recovery
 *
 * No navigation to other rooms, no timer - just instant help.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Loader2, Sparkles, RotateCcw, BookOpen, Calculator, ClipboardList, Map, ChevronRight, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import ReactMarkdown from 'react-markdown'

// Intent configuration with assignment prompts
const INTENTS = [
  {
    id: 'explain',
    label: 'Explain',
    icon: BookOpen,
    description: 'Help me understand a concept',
    assignment: "What concept or topic do you need help understanding?",
    placeholder: "e.g., What is photosynthesis? How do derivatives work?"
  },
  {
    id: 'solve',
    label: 'Solve',
    icon: Calculator,
    description: 'Walk through a problem step-by-step',
    assignment: "Paste or type the problem you need help solving.",
    placeholder: "e.g., Solve for x: 2x + 5 = 15"
  },
  {
    id: 'review',
    label: 'Review',
    icon: ClipboardList,
    description: 'Summarize key points',
    assignment: "What topic or chapter do you want to review?",
    placeholder: "e.g., The causes of World War I, Chapter 5 on cell biology"
  },
  {
    id: 'plan',
    label: 'Plan',
    icon: Map,
    description: 'Create a study plan',
    assignment: "What do you need to study for? When is it due?",
    placeholder: "e.g., I have a chemistry exam on Friday covering chapters 3-5"
  },
] as const

type Intent = typeof INTENTS[number]['id']

// Flow steps
type Step = 'select' | 'input' | 'answer'

export default function QuickSessionPage() {
  const router = useRouter()
  const { user } = useAuth()

  // State
  const [step, setStep] = useState<Step>('select')
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)

  // Get current intent config
  const currentIntent = INTENTS.find(i => i.id === selectedIntent)

  // Auto-resize textarea based on content
  const autoResizeTextarea = useCallback(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  // Handle intent selection - move to input step
  const handleIntentSelect = (intent: Intent) => {
    setSelectedIntent(intent)
    setStep('input')
    // Focus input after transition
    setTimeout(() => inputRef.current?.focus(), 150)
  }

  // Handle input change with auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
    autoResizeTextarea()
  }

  // Reset textarea height when changing modes
  useEffect(() => {
    if (step === 'input') {
      autoResizeTextarea()
    }
  }, [step, autoResizeTextarea])

  // Submit question
  const handleSubmit = async () => {
    if (!question.trim() || isLoading || !selectedIntent) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/study/quick-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: selectedIntent,
          question: question.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      setAnswer(data.answer)
      setStep('answer')

      // Scroll to answer after it renders
      setTimeout(() => {
        answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      console.error('Quick session error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Reset for new question (same intent)
  const handleNewQuestion = () => {
    setQuestion('')
    setAnswer(null)
    setError(null)
    setStep('input')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Start over (new intent)
  const handleStartOver = () => {
    setQuestion('')
    setAnswer(null)
    setError(null)
    setSelectedIntent(null)
    setStep('select')
  }

  // Go back one step
  const handleBack = () => {
    if (step === 'answer') {
      setStep('input')
      setAnswer(null)
    } else if (step === 'input') {
      setStep('select')
      setSelectedIntent(null)
      setQuestion('')
    } else {
      router.push('/dashboard')
    }
  }

  // Loading state for auth
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-neutral-950 to-purple-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">
              {step === 'select' ? 'Back' : step === 'input' ? 'Change' : 'Edit'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-semibold text-white">Quick Help</h1>
          </div>

          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* STEP 1: Select Intent */}
        {step === 'select' && (
          <div className="animate-in fade-in duration-200">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">What do you need?</h2>
              <p className="text-white/50">Pick one and I&apos;ll help you right away</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTENTS.map((intent) => {
                const Icon = intent.icon
                return (
                  <button
                    key={intent.id}
                    onClick={() => handleIntentSelect(intent.id)}
                    className="flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white mb-0.5">{intent.label}</h3>
                      <p className="text-sm text-white/50 truncate">{intent.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Input Question */}
        {step === 'input' && currentIntent && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Assignment Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <currentIntent.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs text-white/40 uppercase tracking-wider">Mode</span>
                  <h2 className="text-lg font-semibold text-white">{currentIntent.label}</h2>
                </div>
              </div>

              {/* Assignment from "supervisor" */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200 font-medium">{currentIntent.assignment}</p>
              </div>
            </div>

            {/* Input Area */}
            <div className="mb-4">
              <textarea
                ref={inputRef}
                value={question}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={currentIntent.placeholder}
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-all text-base"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={handleSubmit}
                    className="text-red-300 hover:text-red-200 text-sm underline mt-1"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!question.trim() || isLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Getting answer...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Get Answer</span>
                </>
              )}
            </button>

            <p className="text-center text-white/30 text-xs mt-3">
              {typeof window !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'} + Enter to submit
            </p>

            {/* Loading Skeleton - Shows while AI is generating */}
            {isLoading && (
              <div className="mt-6 animate-in fade-in duration-300">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white animate-pulse" />
                    </div>
                    <span className="text-sm font-medium text-white/80">Thinking...</span>
                  </div>
                  {/* Skeleton lines */}
                  <div className="space-y-3">
                    <div className="h-4 bg-white/10 rounded-lg animate-pulse w-full" />
                    <div className="h-4 bg-white/10 rounded-lg animate-pulse w-11/12" />
                    <div className="h-4 bg-white/10 rounded-lg animate-pulse w-4/5" />
                    <div className="h-4 bg-white/10 rounded-lg animate-pulse w-9/12" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Show Answer */}
        {step === 'answer' && answer && currentIntent && (
          <div ref={answerRef} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Question recap */}
            <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <currentIntent.icon className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-white/50 uppercase tracking-wider">{currentIntent.label}</span>
              </div>
              <p className="text-white/70 text-sm">{question}</p>
            </div>

            {/* AI Response */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white/80">Answer</span>
              </div>

              {/* Markdown rendered response */}
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-white/90 leading-relaxed mb-3 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="text-white/90 space-y-1.5 mb-3 list-disc pl-4">{children}</ul>,
                    ol: ({ children }) => <ol className="text-white/90 space-y-1.5 mb-3 list-decimal pl-4">{children}</ol>,
                    li: ({ children }) => <li className="text-white/90">{children}</li>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-300 text-xs">{children}</code>,
                    h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
                  }}
                >
                  {answer}
                </ReactMarkdown>
              </div>
            </div>

            {/* Action Options */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={handleNewQuestion}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ask another</span>
              </button>
              <button
                onClick={handleStartOver}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Change mode</span>
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
