'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, X, Minimize2, Maximize2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  cards?: AICard[]
  timestamp: Date
}

interface AICard {
  type: 'quiz' | 'flashcard' | 'study_plan' | 'match_insight' | 'info'
  data: any
}

interface AIPanelProps {
  onClose?: () => void
  initialMinimized?: boolean
  initialMessage?: string
}

// Helper to extract page context for AI
function getPageContext(pathname: string): { page: string; description: string } {
  if (pathname.startsWith('/dashboard')) {
    return { page: 'dashboard', description: 'User is on their main dashboard' }
  } else if (pathname.startsWith('/study-sessions')) {
    return { page: 'study-sessions', description: 'User is viewing or in a study session' }
  } else if (pathname.startsWith('/groups')) {
    return { page: 'groups', description: 'User is viewing study groups' }
  } else if (pathname.startsWith('/community')) {
    return { page: 'community', description: 'User is viewing the community feed' }
  } else if (pathname.startsWith('/chat')) {
    return { page: 'chat', description: 'User is in direct messages' }
  } else if (pathname.startsWith('/connections')) {
    return { page: 'connections', description: 'User is viewing their connections' }
  } else if (pathname.startsWith('/profile')) {
    return { page: 'profile', description: 'User is viewing a profile page' }
  } else if (pathname.startsWith('/search')) {
    return { page: 'search', description: 'User is searching the platform' }
  }
  return { page: 'unknown', description: 'User is on the platform' }
}

export default function AIPanel({ onClose, initialMinimized = false, initialMessage }: AIPanelProps) {
  const pathname = usePathname()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI study assistant. I can help you with:\n\n• Searching your notes and materials\n• Creating quizzes and flashcards\n• Finding study partners\n• Building personalized study plans\n\nWhat would you like to work on today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState(initialMessage || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isMinimized, setIsMinimized] = useState(initialMinimized)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasAutoSentRef = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-send initial message if provided
  useEffect(() => {
    if (initialMessage && !hasAutoSentRef.current && !isLoading) {
      hasAutoSentRef.current = true
      // Small delay to let UI render
      setTimeout(() => {
        handleSend()
      }, 500)
    }
  }, [initialMessage, isLoading])

  const handleSend = async () => {
    if (!input.trim() || isLoading || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsStreaming(true)
    setIsLoading(true)

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      // Get context based on current page
      const context = getPageContext(pathname)

      // Call AI agent API (non-streaming for now - streaming has auth issues)
      const response = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch (e) {
          // If we can't parse JSON, use status code
        }
        throw new Error(errorMessage)
      }

      // Parse JSON response
      const data = await response.json()

      // Update assistant message with response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: data.text || 'No response from AI',
                cards: data.cards || []
              }
            : msg
        )
      )
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled - that's fine
        return
      }

      console.error('AI agent error:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response,
      })

      const errorMessage = error.message || 'Sorry, I encountered an error. Please try again later.'
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${errorMessage}\n\nPlease check the console for details.` }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="group relative p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300"
        >
          <Sparkles className="w-6 h-6" />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-blue-400 opacity-20 blur-xl"
          />
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">AI Study Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map(message => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {/* AI Cards */}
              {message.cards && message.cards.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.cards.map((card, idx) => (
                    <AICardRenderer key={idx} card={card} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && !isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-blue-600 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-blue-600 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-blue-600 rounded-full"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {isStreaming ? 'Typing...' : 'Thinking...'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isLoading || isStreaming}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isStreaming}
            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Render different card types
 */
function AICardRenderer({ card }: { card: AICard }) {
  switch (card.type) {
    case 'info':
      return (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          {card.data.message}
        </div>
      )
    case 'quiz':
      return (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
          <p className="font-semibold text-green-900">Quiz Created!</p>
          <p className="text-green-700 mt-1">{card.data.title}</p>
          <button className="mt-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs">
            Take Quiz
          </button>
        </div>
      )
    case 'study_plan':
      return (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
          <p className="font-semibold text-purple-900">Study Plan Created!</p>
          <p className="text-purple-700 mt-1">{card.data.title}</p>
          <button className="mt-2 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs">
            View Plan
          </button>
        </div>
      )
    case 'match_insight':
      return (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs">
          <p className="font-semibold text-orange-900">Match Found!</p>
          <p className="text-orange-700 mt-1">
            Compatibility: {Math.round(card.data.compatibilityScore * 100)}%
          </p>
          <div className="flex gap-2 mt-2">
            <button className="px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs">
              View Details
            </button>
          </div>
        </div>
      )
    default:
      return null
  }
}
