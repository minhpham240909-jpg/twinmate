'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  LogOut,
  AlertTriangle,
  MessageSquare,
  BookOpen,
  PenTool,
  Clock,
  Target,
  Lightbulb,
  ImageIcon,
  X,
  Sparkles,
} from 'lucide-react'
// Regular imports for light components
import AIPartnerSessionTimer, { TimerState } from '@/components/ai-partner/AIPartnerSessionTimer'
import EndSessionModal from '@/components/ai-partner/EndSessionModal'
import StartTimerPromptModal from '@/components/ai-partner/StartTimerPromptModal'
import PartnerAvailableNotification from '@/components/ai-partner/PartnerAvailableNotification'
import InteractiveQuiz, { QuizQuestion, WrongAnswerDetail } from '@/components/ai-partner/InteractiveQuiz'
import type { QuizConfig } from '@/components/ai-partner/AIPartnerChat'

// PERFORMANCE: Dynamic imports for heavy AI Partner components
// This reduces initial bundle size by ~100-200KB per component
const LoadingSkeleton = () => (
  <div className="flex items-center justify-center h-64 bg-slate-900/50 rounded-xl">
    <div className="text-center">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
      <p className="text-slate-400 text-sm">Loading...</p>
    </div>
  </div>
)

const AIPartnerChat = dynamic(
  () => import('@/components/ai-partner/AIPartnerChat'),
  { loading: LoadingSkeleton, ssr: false }
)

const AIPartnerFlashcards = dynamic(
  () => import('@/components/ai-partner/AIPartnerFlashcards'),
  { loading: LoadingSkeleton, ssr: false }
)

const AIPartnerWhiteboard = dynamic(
  () => import('@/components/ai-partner/AIPartnerWhiteboard'),
  { loading: LoadingSkeleton, ssr: false }
)

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  messageType: string
  wasFlagged: boolean
  createdAt: Date | string
  imageUrl?: string | null
  imageBase64?: string | null
  imageMimeType?: string | null
  imageType?: string | null
}

interface AISession {
  id: string
  userId: string
  subject: string | null
  skillLevel: string | null
  studyGoal: string | null
  status: string
  startedAt: string
  endedAt: string | null
  messageCount: number
  messages: Message[]
}

type TabType = 'chat' | 'flashcards' | 'whiteboard'

export default function AIPartnerSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<AISession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('chat')

  // State-based proactive suggestion system
  // Types: setup_question, clarification, engagement, progress_check, visual_suggestion, practice_offer, wrap_up, none
  const [proactiveSuggestion, setProactiveSuggestion] = useState<{
    show: boolean
    type: string
    suggestion?: string
    imageSuggestion?: { prompt: string; reason: string }
  }>({ show: false, type: 'none' })

  // Track state for proactive system (cooldowns, last ask index)
  const [lastProactiveAskIndex, setLastProactiveAskIndex] = useState(0)
  const [aiMessagesSinceLastAsk, setAiMessagesSinceLastAsk] = useState(0)

  // Track Pomodoro focus time (only counts when timer is running in 'study' mode)
  // This is the key metric for analytics - NOT total session duration
  const [focusTime, setFocusTime] = useState(0)

  // Timer state tracking - users must start timer before using AI features
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [showTimerPrompt, setShowTimerPrompt] = useState(false)
  const [externalStartTrigger, setExternalStartTrigger] = useState(0)

  // Check if timer is active (study or break mode - user has started the timer)
  const isTimerActive = timerState === 'study' || timerState === 'break'

  // Interactive quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [showInteractiveQuiz, setShowInteractiveQuiz] = useState(false)
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null)
  const [excludedQuestions, setExcludedQuestions] = useState<string[]>([])
  const [pendingWrongAnswers, setPendingWrongAnswers] = useState<WrongAnswerDetail[]>([])
  const [isRegeneratingQuiz, setIsRegeneratingQuiz] = useState(false)

  useEffect(() => {
    fetchSession()
  }, [sessionId])

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/ai-partner/session/${sessionId}`)
      const data = await res.json()

      if (data.success) {
        setSession(data.session)
        setMessages(data.session.messages)
      } else {
        setError(data.error || 'Failed to load session')
      }
    } catch (err) {
      console.error('Failed to fetch session:', err)
      setError('Failed to load session')
    } finally {
      setIsLoading(false)
    }
  }

  // State-based proactive suggestion check
  // Called after AI responses to determine if we should suggest something
  const checkProactiveSuggestion = async () => {
    // Don't check if suggestion already showing
    if (proactiveSuggestion.show) return

    try {
      const res = await fetch(
        `/api/ai-partner/proactive?sessionId=${sessionId}&lastProactiveIndex=${lastProactiveAskIndex}&aiMessagesSinceAsk=${aiMessagesSinceLastAsk}`
      )
      const data = await res.json()

      // Only show if there's an actual suggestion
      if (data.type !== 'none' && (data.suggestion || data.imageSuggestion)) {
        setProactiveSuggestion({
          show: true,
          type: data.type,
          suggestion: data.suggestion,
          imageSuggestion: data.imageSuggestion,
        })

        // If this was a "shouldAsk" type, update tracking
        if (data.shouldAsk) {
          const currentMessageCount = messages.filter(m => m.role !== 'SYSTEM').length
          setLastProactiveAskIndex(currentMessageCount)
          setAiMessagesSinceLastAsk(0)
        }
      }
    } catch (err) {
      // Silently fail - this is just an enhancement
      console.error('Proactive suggestion check failed:', err)
    }
  }

  // Handle accepting a proactive question suggestion (add to chat as AI message)
  const handleAcceptProactiveSuggestion = async () => {
    if (proactiveSuggestion.type === 'visual_suggestion' && proactiveSuggestion.imageSuggestion) {
      // Generate image
      setProactiveSuggestion({ show: false, type: 'none' })
      await handleGenerateImage(proactiveSuggestion.imageSuggestion.prompt, 'illustration')
    } else if (proactiveSuggestion.suggestion) {
      // For questions/suggestions, we can show as a soft prompt or dismiss
      // The AI will naturally incorporate these into responses
      setProactiveSuggestion({ show: false, type: 'none' })
    }
  }

  // Dismiss the proactive suggestion
  const handleDismissProactiveSuggestion = () => {
    setProactiveSuggestion({ show: false, type: 'none' })
  }

  // Handler to start timer from modal
  const handleStartTimerFromModal = () => {
    setExternalStartTrigger((prev) => prev + 1)
  }

  const handleSendMessage = async (content: string) => {
    // Check if timer is active before allowing messages
    if (!isTimerActive) {
      setShowTimerPrompt(true)
      return
    }

    setIsSending(true)
    setError(null)

    // Optimistically add user message
    const tempUserMsgId = `temp-user-${Date.now()}`
    const tempAiMsgId = `temp-ai-${Date.now()}`

    const tempUserMsg: Message = {
      id: tempUserMsgId,
      role: 'USER',
      content,
      messageType: 'CHAT',
      wasFlagged: false,
      createdAt: new Date(),
    }

    // Add user message and empty AI message for streaming
    const tempAiMsg: Message = {
      id: tempAiMsgId,
      role: 'ASSISTANT',
      content: '',
      messageType: 'CHAT',
      wasFlagged: false,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, tempUserMsg, tempAiMsg])

    try {
      // Use streaming endpoint
      const res = await fetch('/api/ai-partner/message/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content }),
      })

      // Check if it's a JSON response (blocked, image, or error - not stream)
      const contentType = res.headers.get('Content-Type')
      if (contentType?.includes('application/json')) {
        const data = await res.json()
        if (data.type === 'blocked') {
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.id.startsWith('temp-'))
            return [
              ...filtered,
              {
                id: data.userMessageId,
                role: 'USER',
                content,
                messageType: 'CHAT',
                wasFlagged: data.userMessageWasFlagged,
                createdAt: new Date(),
              },
              {
                id: data.aiMessageId,
                role: 'ASSISTANT',
                content: data.content,
                messageType: 'CHAT',
                wasFlagged: false,
                createdAt: new Date(),
              },
            ]
          })
          setError('Session ended due to content policy violation.')
          setTimeout(() => router.push('/ai-partner'), 3000)
          return
        }
        // Handle image generation response
        if (data.type === 'image') {
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.id.startsWith('temp-'))
            return [
              ...filtered,
              {
                id: data.userMessageId,
                role: 'USER',
                content,
                messageType: 'CHAT',
                wasFlagged: data.userMessageWasFlagged,
                createdAt: new Date(),
              },
              {
                id: data.aiMessageId,
                role: 'ASSISTANT',
                content: data.content,
                messageType: 'IMAGE',
                wasFlagged: false,
                createdAt: new Date(),
                imageUrl: data.imageUrl,
                imageType: 'generated',
              },
            ]
          })
          return
        }
        if (data.error) {
          setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')))
          setError(data.error)
          return
        }
      }

      // Handle SSE stream
      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let userMessageId = tempUserMsgId
      let userMessageWasFlagged = false
      let streamedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'start') {
                userMessageId = data.userMessageId
                userMessageWasFlagged = data.userMessageWasFlagged
                // Update user message with real ID
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempUserMsgId
                      ? { ...m, id: userMessageId, wasFlagged: userMessageWasFlagged }
                      : m
                  )
                )
              } else if (data.type === 'token') {
                streamedContent += data.content
                // Update AI message content progressively
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAiMsgId
                      ? { ...m, content: streamedContent }
                      : m
                  )
                )
              } else if (data.type === 'complete') {
                // Finalize with real AI message ID
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAiMsgId
                      ? { ...m, id: data.aiMessageId, content: data.content }
                      : m
                  )
                )
                // Increment AI message counter for cooldown tracking
                setAiMessagesSinceLastAsk(prev => prev + 1)
                // Check for state-based proactive suggestion
                checkProactiveSuggestion()
              } else if (data.type === 'error') {
                setMessages((prev) => prev.filter((m) => m.id !== tempAiMsgId))
                setError(data.error || 'Failed to get AI response')
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')))
      setError('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleGenerateQuiz = async (config: QuizConfig) => {
    // Check if timer is active before allowing quiz generation
    if (!isTimerActive) {
      setShowTimerPrompt(true)
      return
    }

    setIsSending(true)
    // Store config for Try Again
    setQuizConfig(config)
    // Reset excluded questions for new quiz
    setExcludedQuestions([])
    setPendingWrongAnswers([])

    try {
      const res = await fetch('/api/ai-partner/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          difficulty: config.difficulty,
          count: config.count,
          questionType: config.questionType,
          interactive: true, // Use interactive mode
        }),
      })

      const data = await res.json()

      if (data.success && data.questions && data.questions.length > 0) {
        // Set quiz questions and show interactive quiz
        setQuizQuestions(data.questions)
        setShowInteractiveQuiz(true)
      } else {
        setError(data.error || 'Failed to generate quiz. Make sure you have some conversation first!')
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err)
      setError('Failed to generate quiz. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleQuizComplete = (
    _results: Array<{ questionIndex: number; isCorrect: boolean; userAnswer: string | number; correctAnswer: string | number }>,
    _score: number,
    wrongAnswers: WrongAnswerDetail[]
  ) => {
    // Store wrong answers to post when Done is clicked
    setPendingWrongAnswers(wrongAnswers)

    // Add current questions to excluded list for Try Again
    const currentQuestionTexts = quizQuestions.map(q => q.question)
    setExcludedQuestions(prev => [...prev, ...currentQuestionTexts])
  }

  const handleTryAgain = async () => {
    if (!quizConfig) return

    setIsRegeneratingQuiz(true)
    try {
      const res = await fetch('/api/ai-partner/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          difficulty: quizConfig.difficulty,
          count: quizConfig.count,
          questionType: quizConfig.questionType,
          interactive: true,
          excludeQuestions: excludedQuestions, // Send excluded questions for new generation
        }),
      })

      const data = await res.json()

      if (data.success && data.questions && data.questions.length > 0) {
        // Reset pending wrong answers for new attempt
        setPendingWrongAnswers([])
        // Set new quiz questions (this will reset the quiz component)
        setQuizQuestions(data.questions)
      } else {
        setError(data.error || 'Failed to generate new quiz questions.')
      }
    } catch (err) {
      console.error('Failed to regenerate quiz:', err)
      setError('Failed to generate new quiz. Please try again.')
    } finally {
      setIsRegeneratingQuiz(false)
    }
  }

  const handleCloseQuiz = () => {
    // Post wrong answers to chat if there are any
    if (pendingWrongAnswers.length > 0) {
      const wrongAnswersContent = pendingWrongAnswers
        .map((wa, i) =>
          `**${i + 1}. ${wa.question}**\n` +
          `   ❌ Your answer: ${wa.userAnswer}\n` +
          `   ✅ Correct answer: ${wa.correctAnswer}\n` +
          `   💡 ${wa.explanation}`
        )
        .join('\n\n')

      const wrongAnswersMessage: Message = {
        id: `quiz-wrong-${Date.now()}`,
        role: 'ASSISTANT',
        content: `📝 **Review Your Mistakes**\n\nHere are the questions you got wrong. Review them to strengthen your understanding:\n\n${wrongAnswersContent}`,
        messageType: 'QUIZ_REVIEW',
        wasFlagged: false,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, wrongAnswersMessage])
    }

    // Reset quiz state
    setShowInteractiveQuiz(false)
    setQuizQuestions([])
    setPendingWrongAnswers([])
    setQuizConfig(null)
    setExcludedQuestions([])
  }

  const handleSendMessageWithImage = async (content: string, imageBase64: string, imageMimeType: string) => {
    // Check if timer is active before allowing image messages
    if (!isTimerActive) {
      setShowTimerPrompt(true)
      return
    }

    setIsSending(true)
    setError(null)

    // Add optimistic user message with image
    const tempUserMsgId = `temp-user-${Date.now()}`
    const tempAiMsgId = `temp-ai-${Date.now()}`

    const tempUserMsg: Message = {
      id: tempUserMsgId,
      role: 'USER',
      content: content || 'Uploaded an image',
      messageType: 'IMAGE',
      wasFlagged: false,
      createdAt: new Date(),
      imageBase64: imageBase64,
      imageMimeType: imageMimeType,
      imageType: 'uploaded',
    }

    const tempAiMsg: Message = {
      id: tempAiMsgId,
      role: 'ASSISTANT',
      content: '',
      messageType: 'IMAGE',
      wasFlagged: false,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, tempUserMsg, tempAiMsg])

    try {
      const res = await fetch('/api/ai-partner/image/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content,
          imageBase64,
          imageMimeType,
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Update messages with real IDs and content
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === tempUserMsgId) {
              return { ...m, id: data.userMessage.id }
            }
            if (m.id === tempAiMsgId) {
              return { ...m, id: data.aiMessage.id, content: data.aiMessage.content }
            }
            return m
          })
        )
      } else {
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')))
        setError(data.error || 'Failed to process image')
      }
    } catch (err) {
      console.error('Failed to send image message:', err)
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')))
      setError('Failed to process image. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  // Chat-driven image generation (no button). Called when user types an inline image command.
  const handleGenerateImage = async (prompt: string, style: string = 'diagram') => {
    // Check if timer is active before allowing image generation
    if (!isTimerActive) {
      setShowTimerPrompt(true)
      return
    }

    setIsSending(true)
    setError(null)

    const tempMsgId = `temp-ai-${Date.now()}`
    const tempMsg: Message = {
      id: tempMsgId,
      role: 'ASSISTANT',
      content: `Generating ${style}: "${prompt}"...`,
      messageType: 'IMAGE',
      wasFlagged: false,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, tempMsg])

    try {
      const res = await fetch('/api/ai-partner/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, prompt, style }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempMsgId
              ? {
                  ...m,
                  id: data.messageId || m.id,
                  content: `Here's a ${style} for: "${prompt}"`,
                  imageUrl: data.imageUrl,
                  imageType: 'generated',
                  createdAt: new Date(),
                }
              : m
          )
        )
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsgId))
        setError(data.error || 'Failed to generate image')
      }
    } catch (err) {
      console.error('Failed to generate image:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempMsgId))
      setError('Failed to generate image. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleEndSession = async (rating?: number, feedback?: string) => {
    try {
      const res = await fetch(`/api/ai-partner/session/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // Pass focusTime - only the time when Pomodoro timer was running in study mode
        // If user never clicked Start Timer, focusTime will be 0
        body: JSON.stringify({ rating, feedback, focusTime }),
      })

      const data = await res.json()

      if (data.success) {
        console.log('[AI Partner] Session ended successfully')

        // Dispatch custom event to notify CompletedSessionFAB
        window.dispatchEvent(new CustomEvent('ai-partner-session-ended'))

        // Redirect to dashboard so user can see the completed session FAB
        router.push('/dashboard')
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Failed to end session:', err)
      throw err
    }
  }

  // Pause session and navigate to dashboard
  const handlePauseAndLeave = async () => {
    if (session?.status !== 'ACTIVE') {
      router.push('/dashboard')
      return
    }

    try {
      console.log('[AI Partner] Pausing session:', sessionId)
      const res = await fetch(`/api/ai-partner/session/${sessionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      console.log('[AI Partner] Pause response:', data)

      if (data.success) {
        console.log('[AI Partner] Session paused successfully, navigating to dashboard')
        // Update local session state to reflect pause
        setSession(prev => prev ? { ...prev, status: 'PAUSED' } : null)

        // Dispatch custom event to notify FAB to check for paused session
        window.dispatchEvent(new CustomEvent('ai-partner-session-paused'))

        // Navigate to dashboard
        router.push('/dashboard')
      } else {
        // If pause fails, still navigate but log error
        console.error('Failed to pause session:', data.error)
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Failed to pause session:', err)
      // Still navigate even if pause fails
      router.push('/dashboard')
    }
  }

  // Handler for asking AI from flashcards
  const handleAskAIFromFlashcards = async (question: string) => {
    setActiveTab('chat')
    await handleSendMessage(question)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/ai-partner')}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
          >
            Back to AI Partner
          </button>
        </div>
      </div>
    )
  }

  if (!session) return null

  const tabs: { id: TabType; label: string; icon: typeof MessageSquare }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'flashcards', label: 'Flashcards', icon: BookOpen },
    { id: 'whiteboard', label: 'Whiteboard', icon: PenTool },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePauseAndLeave}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Pause session and go to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center overflow-hidden">
                <Image src="/logo.png" alt="AI Partner" width={28} height={28} className="object-contain" />
              </div>
              <div>
                <h1 className="font-semibold text-white">
                  {session.subject || 'AI Study Session'}
                </h1>
                <p className="text-xs text-slate-400">
                  {session.status === 'ACTIVE' ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Active Session
                    </span>
                  ) : (
                    'Session Ended'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {session.status === 'ACTIVE' && (
            <button
              onClick={() => setShowEndModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">End Session</span>
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center"
        >
          <p className="text-red-400 text-sm flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </p>
        </motion.div>
      )}

      {/* State-based Proactive Suggestion Banner (smart, non-annoying, dismissable) */}
      {proactiveSuggestion.show && activeTab === 'chat' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`border-b px-4 py-3 ${
            proactiveSuggestion.type === 'visual_suggestion'
              ? 'bg-gradient-to-r from-blue-500/10 to-blue-500/10 border-blue-500/20'
              : proactiveSuggestion.type === 'clarification' || proactiveSuggestion.type === 'engagement'
              ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20'
              : 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2 rounded-lg ${
                proactiveSuggestion.type === 'visual_suggestion'
                  ? 'bg-blue-500/20'
                  : proactiveSuggestion.type === 'clarification' || proactiveSuggestion.type === 'engagement'
                  ? 'bg-amber-500/20'
                  : 'bg-blue-500/20'
              }`}>
                {proactiveSuggestion.type === 'visual_suggestion' ? (
                  <ImageIcon className="w-5 h-5 text-blue-400" />
                ) : proactiveSuggestion.type === 'clarification' || proactiveSuggestion.type === 'engagement' ? (
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                ) : (
                  <Sparkles className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium">
                  {proactiveSuggestion.type === 'visual_suggestion'
                    ? 'Would a visual help?'
                    : proactiveSuggestion.type === 'clarification'
                    ? 'Need a different explanation?'
                    : proactiveSuggestion.type === 'engagement'
                    ? 'Let\'s try something different'
                    : proactiveSuggestion.type === 'progress_check'
                    ? 'Quick check-in'
                    : proactiveSuggestion.type === 'wrap_up'
                    ? 'Session wrap-up'
                    : proactiveSuggestion.type === 'practice_offer'
                    ? 'Ready to practice?'
                    : 'Suggestion'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {proactiveSuggestion.imageSuggestion?.reason ||
                   proactiveSuggestion.suggestion ||
                   'I have a suggestion that might help'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {proactiveSuggestion.type === 'visual_suggestion' ? (
                <button
                  onClick={handleAcceptProactiveSuggestion}
                  disabled={isSending}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" />
                  Generate
                </button>
              ) : (
                <button
                  onClick={handleDismissProactiveSuggestion}
                  className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Got it
                </button>
              )}
              <button
                onClick={handleDismissProactiveSuggestion}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Main Feature Area */}
        <div className="flex-1 p-4">
          <div className="h-[calc(100vh-8rem)]">
            {activeTab === 'chat' && (
              <AIPartnerChat
                sessionId={session.id}
                messages={messages}
                onSendMessage={handleSendMessage}
                onSendMessageWithImage={handleSendMessageWithImage}
                onGenerateImage={handleGenerateImage}
                onGenerateQuiz={handleGenerateQuiz}
                isLoading={isSending}
                subject={session.subject}
                isTimerActive={isTimerActive}
              />
            )}

            {activeTab === 'flashcards' && (
              <div className="h-full bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <AIPartnerFlashcards
                    sessionId={session.id}
                    subject={session.subject}
                    onAskAI={handleAskAIFromFlashcards}
                  />
                </div>
              </div>
            )}

            {activeTab === 'whiteboard' && (
              <div className="h-full">
                <AIPartnerWhiteboard
                  sessionId={session.id}
                  subject={session.subject}
                  skillLevel={session.skillLevel}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Timer & Tools */}
        <div className="w-80 p-4 border-l border-slate-700/50 hidden lg:block overflow-y-auto">
          <AIPartnerSessionTimer
            sessionStartedAt={session.startedAt}
            onTimerComplete={(isBreak) => {
              console.log(isBreak ? 'Break complete!' : 'Study session complete!')
            }}
            onFocusTimeUpdate={(time) => setFocusTime(time)}
            onTimerStateChange={(state) => setTimerState(state)}
            externalStartTrigger={externalStartTrigger}
          />

          {/* Study Goal */}
          {session.studyGoal && (
            <div className="mt-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                Session Goal
              </h3>
              <p className="text-sm text-slate-400">{session.studyGoal}</p>
            </div>
          )}

          {/* Session Stats */}
          <div className="mt-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Session Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-white">
                  {messages.filter((m) => m.role !== 'SYSTEM').length}
                </div>
                <div className="text-xs text-slate-400">Messages</div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-white">
                  {messages.filter((m) => m.messageType === 'QUIZ').length}
                </div>
                <div className="text-xs text-slate-400">Quizzes</div>
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              Quick Tips
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <MessageSquare className="w-3 h-3 mt-0.5 text-blue-400" />
                Ask questions in the Chat tab
              </li>
              <li className="flex items-start gap-2">
                <BookOpen className="w-3 h-3 mt-0.5 text-green-400" />
                Create or generate flashcards to study
              </li>
              <li className="flex items-start gap-2">
                <PenTool className="w-3 h-3 mt-0.5 text-blue-400" />
                Use the whiteboard to draw diagrams
              </li>
            </ul>
          </div>

          {/* Feature Highlights */}
          <div className="mt-4 bg-gradient-to-br from-blue-600/10 to-blue-600/10 rounded-2xl border border-blue-500/20 p-4">
            <h3 className="text-sm font-medium text-white mb-2">
              Study Tools Available
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                AI Chat & Quiz
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                Interactive Flashcards
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                Digital Whiteboard
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                Pomodoro Timer
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End Session Modal */}
      <EndSessionModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onEnd={handleEndSession}
        sessionStats={{
          duration: Math.floor(
            (Date.now() - new Date(session.startedAt).getTime()) / 1000
          ),
          messageCount: messages.filter((m) => m.role !== 'SYSTEM').length,
          quizCount: messages.filter((m) => m.messageType === 'QUIZ').length,
        }}
      />

      {/* Start Timer Prompt Modal - shown when user tries to use AI without starting timer */}
      <StartTimerPromptModal
        isOpen={showTimerPrompt}
        onClose={() => setShowTimerPrompt(false)}
        onStartTimer={handleStartTimerFromModal}
      />

      {/* Real Partner Available Notification */}
      {session.status === 'ACTIVE' && (
        <PartnerAvailableNotification
          sessionId={session.id}
          checkInterval={60000}
        />
      )}

      {/* Interactive Quiz Modal */}
      {showInteractiveQuiz && quizQuestions.length > 0 && (
        <InteractiveQuiz
          key={quizQuestions[0]?.id} // Force re-mount when questions change for Try Again
          questions={quizQuestions}
          onClose={handleCloseQuiz}
          onComplete={handleQuizComplete}
          onTryAgain={handleTryAgain}
          isRegenerating={isRegeneratingQuiz}
          subject={session.subject || undefined}
        />
      )}
    </div>
  )
}
