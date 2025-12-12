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
} from 'lucide-react'
// Regular imports for light components
import AIPartnerSessionTimer from '@/components/ai-partner/AIPartnerSessionTimer'
import EndSessionModal from '@/components/ai-partner/EndSessionModal'
import PartnerAvailableNotification from '@/components/ai-partner/PartnerAvailableNotification'

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

  const handleSendMessage = async (content: string) => {
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

      // Check if it's a blocked response (JSON, not stream)
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

  const handleGenerateQuiz = async () => {
    setIsSending(true)
    try {
      const res = await fetch('/api/ai-partner/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          difficulty: 'medium',
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Add quiz as a message
        const quizMessage: Message = {
          id: data.quiz.messageId,
          role: 'ASSISTANT',
          content: `🎯 **Quiz Question**\n\n${data.quiz.question}\n\nA) ${data.quiz.options[0]}\nB) ${data.quiz.options[1]}\nC) ${data.quiz.options[2]}\nD) ${data.quiz.options[3]}\n\n_Answer: ${['A', 'B', 'C', 'D'][data.quiz.correctAnswer]}_\n\n**Explanation:** ${data.quiz.explanation}`,
          messageType: 'QUIZ',
          wasFlagged: false,
          createdAt: new Date(),
        }
        setMessages((prev) => [...prev, quizMessage])
      } else {
        setError(data.error || 'Failed to generate quiz')
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err)
      setError('Failed to generate quiz. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleGenerateFlashcards = async (topic: string) => {
    setIsSending(true)
    try {
      const res = await fetch('/api/ai-partner/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic,
          count: 5,
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Add flashcards as a message
        const flashcardContent = data.flashcards
          .map(
            (f: { front: string; back: string }, i: number) =>
              `**${i + 1}. ${f.front}**\n   _${f.back}_`
          )
          .join('\n\n')

        const flashcardMessage: Message = {
          id: data.messageId,
          role: 'ASSISTANT',
          content: `📚 **Flashcards: ${topic}**\n\n${flashcardContent}\n\n_These flashcards have been saved to your session._`,
          messageType: 'FLASHCARD',
          wasFlagged: false,
          createdAt: new Date(),
        }
        setMessages((prev) => [...prev, flashcardMessage])
      } else {
        setError(data.error || 'Failed to generate flashcards')
      }
    } catch (err) {
      console.error('Failed to generate flashcards:', err)
      setError('Failed to generate flashcards. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendMessageWithImage = async (content: string, imageBase64: string, imageMimeType: string) => {
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

  const handleGenerateImage = async (prompt: string, style: string) => {
    setIsSending(true)
    setError(null)

    // Add optimistic AI message for loading state
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
        body: JSON.stringify({
          sessionId,
          prompt,
          style,
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Update with real message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempMsgId
              ? {
                  ...m,
                  id: data.messageId,
                  content: `I've created a ${style} to help visualize: "${prompt}"`,
                  imageUrl: data.imageUrl,
                  imageType: 'generated',
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
        body: JSON.stringify({ rating, feedback }),
      })

      const data = await res.json()

      if (data.success) {
        // Show summary briefly then redirect
        router.push('/ai-partner')
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
        // Small delay to ensure state is updated before navigation
        await new Promise(resolve => setTimeout(resolve, 100))
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
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
                onGenerateFlashcards={handleGenerateFlashcards}
                isLoading={isSending}
                subject={session.subject}
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
                <PenTool className="w-3 h-3 mt-0.5 text-purple-400" />
                Use the whiteboard to draw diagrams
              </li>
            </ul>
          </div>

          {/* Feature Highlights */}
          <div className="mt-4 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-2xl border border-blue-500/20 p-4">
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

      {/* Real Partner Available Notification */}
      {session.status === 'ACTIVE' && (
        <PartnerAvailableNotification
          sessionId={session.id}
          checkInterval={60000}
        />
      )}
    </div>
  )
}
