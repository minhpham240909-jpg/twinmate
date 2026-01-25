'use client'

/**
 * MISSION CHAT COMPONENT
 *
 * Contextual AI conversation that supports the current mission.
 * This is NOT the main interface - it's a helper for when users need clarification.
 *
 * Key Features:
 * - Clickable nextSuggestion after every AI response
 * - Context-aware (knows current mission/step)
 * - Authority tone maintained
 * - Chat is support, not the product
 * - Message pagination to prevent performance issues
 */

import { useState, useCallback, memo, useRef, useEffect, useMemo } from 'react'
import {
  Loader2,
  Send,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  History,
} from 'lucide-react'

// ============================================
// CONSTANTS
// ============================================

const MESSAGES_PER_PAGE = 20 // Show 20 messages at a time
const MAX_MESSAGES = 100 // Keep max 100 messages in memory

// ============================================
// TYPES
// ============================================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  nextSuggestion?: string // Clickable follow-up
  timestamp: Date
}

interface MissionChatProps {
  missionTitle: string
  missionContext?: string
  isGuest: boolean
  onTrialExhausted?: () => void
}

// ============================================
// COMPONENT
// ============================================

const MissionChat = memo(function MissionChat({
  missionTitle,
  missionContext,
  isGuest,
  onTrialExhausted,
}: MissionChatProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PER_PAGE)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // PAGINATION: Calculate visible messages
  const visibleMessages = useMemo(() => {
    const startIndex = Math.max(0, messages.length - visibleCount)
    return messages.slice(startIndex)
  }, [messages, visibleCount])
  
  const hasOlderMessages = messages.length > visibleCount

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isExpanded])
  
  // PAGINATION: Load older messages
  const loadOlderMessages = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + MESSAGES_PER_PAGE, messages.length))
  }, [messages.length])

  // Send message to AI
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    // MEMORY LIMIT: Trim old messages if exceeding max
    setMessages(prev => {
      const newMessages = [...prev, userMessage]
      if (newMessages.length > MAX_MESSAGES) {
        return newMessages.slice(-MAX_MESSAGES)
      }
      return newMessages
    })
    setInputValue('')
    setIsLoading(true)

    try {
      // Build context for AI
      const contextPrompt = missionContext
        ? `[Current Mission: ${missionTitle}]\n[Context: ${missionContext}]\n\nUser question: ${content}`
        : `[Current Mission: ${missionTitle}]\n\nUser question: ${content}`

      const response = await fetch('/api/guide-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: contextPrompt,
          struggleType: 'dont_understand',
          actionType: 'explanation',
        }),
      })

      const data = await response.json()

      if (response.status === 403 && data.trialExhausted) {
        onTrialExhausted?.()
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      // Extract response content
      const action = data.action
      let assistantContent = ''
      let nextSuggestion = ''

      if (action.type === 'explanation') {
        // Build response from explanation parts
        if (action.core?.idea) {
          assistantContent = action.core.idea
        }
        if (action.core?.keyPoints?.length > 0) {
          assistantContent += '\n\n' + action.core.keyPoints.map((p: string) => `• ${p}`).join('\n')
        }
        nextSuggestion = action.nextSuggestion || 'Want to try an example?'
      } else if (action.type === 'roadmap') {
        assistantContent = action.overview || action.title || 'Here\'s your plan.'
        nextSuggestion = action.nextSuggestion || 'Ready to start?'
      } else {
        assistantContent = action.acknowledgment || 'Let me help you with that.'
        nextSuggestion = action.nextSuggestion || 'What else would you like to know?'
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent || 'I understand. Let me help you with this.',
        nextSuggestion,
        timestamp: new Date(),
      }

      // MEMORY LIMIT: Trim old messages if exceeding max
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage]
        if (newMessages.length > MAX_MESSAGES) {
          return newMessages.slice(-MAX_MESSAGES)
        }
        return newMessages
      })

    } catch (err) {
      console.error('Chat error:', err)
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => {
        const newMessages = [...prev, errorMessage]
        if (newMessages.length > MAX_MESSAGES) {
          return newMessages.slice(-MAX_MESSAGES)
        }
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }, [missionTitle, missionContext, isLoading, onTrialExhausted])

  // Handle clicking on nextSuggestion
  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage(suggestion)
  }, [sendMessage])

  // Handle form submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }, [inputValue, sendMessage])

  // Handle enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }, [inputValue, sendMessage])

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header - Click to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-neutral-900 dark:text-white">
            Need help with this?
          </span>
          {messages.length > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-neutral-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-neutral-400" />
        )}
      </button>

      {/* Chat Area - Only visible when expanded */}
      {isExpanded && (
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          {/* Messages */}
          <div ref={messagesContainerRef} className="max-h-80 overflow-y-auto p-4 space-y-4">
            {/* Load older messages button */}
            {hasOlderMessages && (
              <button
                onClick={loadOlderMessages}
                className="w-full py-2 text-sm text-blue-500 hover:text-blue-600 flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <History className="w-4 h-4" />
                Load older messages ({messages.length - visibleCount} more)
              </button>
            )}
            
            {visibleMessages.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                Ask a question about your current mission
              </p>
            ) : (
              visibleMessages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {/* Message Bubble */}
                  <div
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-blue-500">Clerva</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>

                  {/* Clickable Next Suggestion - Only for assistant messages */}
                  {message.role === 'assistant' && message.nextSuggestion && (
                    <div className="flex justify-start pl-2">
                      <button
                        onClick={() => handleSuggestionClick(message.nextSuggestion!)}
                        disabled={isLoading}
                        className="group flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <span>{message.nextSuggestion}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-sm text-neutral-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
})

export default MissionChat
