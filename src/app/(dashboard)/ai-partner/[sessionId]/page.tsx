'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  Loader2,
  LogOut,
  AlertTriangle,
} from 'lucide-react'
import AIPartnerChat from '@/components/ai-partner/AIPartnerChat'
import AIPartnerSessionTimer from '@/components/ai-partner/AIPartnerSessionTimer'
import EndSessionModal from '@/components/ai-partner/EndSessionModal'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  messageType: string
  wasFlagged: boolean
  createdAt: Date | string
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
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
      messageType: 'CHAT',
      wasFlagged: false,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/ai-partner/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content }),
      })

      const data = await res.json()

      if (data.success) {
        // Replace temp message with real ones
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith('temp-'))
          return [
            ...filtered,
            {
              id: data.userMessage.id,
              role: 'USER',
              content: data.userMessage.content,
              messageType: 'CHAT',
              wasFlagged: data.userMessage.wasFlagged,
              createdAt: new Date(),
            },
            {
              id: data.aiMessage.id,
              role: 'ASSISTANT',
              content: data.aiMessage.content,
              messageType: 'CHAT',
              wasFlagged: false,
              createdAt: new Date(),
            },
          ]
        })

        // If session was blocked due to safety, show warning
        if (data.safetyBlocked) {
          setError('Session ended due to content policy violation.')
          setTimeout(() => router.push('/ai-partner'), 3000)
        }
      } else {
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')))
        setError(data.error || 'Failed to send message')
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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/ai-partner')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
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

          {session.status === 'ACTIVE' && (
            <button
              onClick={() => setShowEndModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              End Session
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
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Chat Area */}
        <div className="flex-1 p-4">
          <div className="h-[calc(100vh-8rem)]">
            <AIPartnerChat
              sessionId={session.id}
              messages={messages}
              onSendMessage={handleSendMessage}
              onGenerateQuiz={handleGenerateQuiz}
              onGenerateFlashcards={handleGenerateFlashcards}
              isLoading={isSending}
              subject={session.subject}
            />
          </div>
        </div>

        {/* Sidebar - Timer & Tools */}
        <div className="w-80 p-4 border-l border-slate-700/50 hidden lg:block">
          <AIPartnerSessionTimer
            sessionStartedAt={session.startedAt}
            onTimerComplete={(isBreak) => {
              // Could send a message to AI about timer completion
              console.log(isBreak ? 'Break complete!' : 'Study session complete!')
            }}
          />

          {/* Study Goal */}
          {session.studyGoal && (
            <div className="mt-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Session Goal
              </h3>
              <p className="text-sm text-slate-400">{session.studyGoal}</p>
            </div>
          )}

          {/* Quick Tips */}
          <div className="mt-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Quick Tips
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Ask questions about any topic</li>
              <li>• Use &quot;Quiz Me&quot; to test yourself</li>
              <li>• Generate flashcards for revision</li>
              <li>• Stay focused on studying!</li>
            </ul>
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
    </div>
  )
}
