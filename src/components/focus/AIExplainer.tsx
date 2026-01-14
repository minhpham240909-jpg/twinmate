'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Loader2, Minimize2, Maximize2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIExplainerProps {
  sessionId: string
  taskContext?: string | null
}

export default function AIExplainer({ sessionId, taskContext }: AIExplainerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load previous messages for this session
  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(`focus_ai_messages_${sessionId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setMessages(parsed.map((m: { role: string; content: string; timestamp: string }) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })))
        } catch (e) {
          console.error('Failed to parse saved messages:', e)
        }
      }
    }
  }, [sessionId])

  // Save messages when they change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`focus_ai_messages_${sessionId}`, JSON.stringify(messages))
    }
  }, [sessionId, messages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, isMinimized])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/focus/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question: userMessage.content,
          context: taskContext,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI Explainer error:', error)
      
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I couldn't process your question right now. Please try again in a moment.",
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId, taskContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 hover:from-purple-500/30 hover:to-blue-500/30 transition-all"
        title="AI Study Helper"
      >
        <Sparkles className="w-5 h-5" />
      </button>
    )
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white transition-all"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">AI Helper</span>
        <Maximize2 className="w-3 h-3 text-neutral-400" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-neutral-900/95 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">AI Study Helper</h4>
            <p className="text-xs text-neutral-400">Ask me anything</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-neutral-400" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400 text-sm mb-2">Need help understanding something?</p>
            <p className="text-neutral-500 text-xs">Ask me to explain concepts, solve problems, or get study tips.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-neutral-800 text-neutral-200 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 text-neutral-200 px-4 py-2.5 rounded-2xl rounded-bl-md">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2.5 bg-neutral-800 border-0 rounded-xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
