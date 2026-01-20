'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Study plan types (from "Guide Me" flow)
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

interface SoloStudyAITutorProps {
  onClose: () => void
  studyPlan?: StudyPlan | null
}

// Dynamic quick actions based on whether there's a study plan
const getQuickActions = (hasStudyPlan: boolean) => {
  const baseActions = [
    { label: 'Explain this concept', prompt: 'Can you explain this concept in simple terms?' },
    { label: 'Give me an example', prompt: 'Can you give me a practical example?' },
    { label: 'Quiz me', prompt: 'Quiz me on what I\'m studying' },
    { label: 'Study tips', prompt: 'What are some effective study techniques for this topic?' },
  ]

  if (hasStudyPlan) {
    return [
      { label: 'Help with my plan', prompt: 'Can you help me understand the current step in my study plan?' },
      { label: 'Explain this step', prompt: 'Can you explain the concept I\'m currently working on from my study plan?' },
      ...baseActions.slice(0, 2),
    ]
  }

  return baseActions
}

export default function SoloStudyAITutor({ onClose, studyPlan }: SoloStudyAITutorProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Add initial greeting (context-aware based on study plan)
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = studyPlan
        ? `Hi! I'm your AI study tutor, and I can see you're working on "${studyPlan.subject}". I have access to your study plan and can help you with any step. What would you like help with?`
        : "Hi! I'm your AI study tutor. I can help explain concepts, quiz you, or provide study tips. What would you like help with?"

      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        },
      ])
    }
  }, [studyPlan])

  // Send message
  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          // Pass study plan context if available
          studyPlan: studyPlan ? {
            subject: studyPlan.subject,
            totalMinutes: studyPlan.totalMinutes,
            steps: studyPlan.steps.map((s) => ({
              title: s.title,
              description: s.description,
              duration: s.duration,
              tips: s.tips,
            })),
          } : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I'm sorry, I couldn't process that. Could you try rephrasing?",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI Tutor error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-neutral-900 border-l border-neutral-800 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Tutor</h3>
            <p className="text-xs text-neutral-400">Ask me anything</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-800 text-neutral-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-neutral-800 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {getQuickActions(!!studyPlan).map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                disabled={isLoading}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-full transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-neutral-800">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your question..."
            rows={1}
            className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-purple-500 hover:bg-purple-600 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
