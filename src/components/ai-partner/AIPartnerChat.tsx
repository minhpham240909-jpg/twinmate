'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Bot,
  User,
  AlertTriangle,
  Loader2,
  Sparkles,
  BookOpen,
  Brain,
  Clock,
  X,
} from 'lucide-react'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  messageType: string
  wasFlagged: boolean
  createdAt: Date | string
}

interface AIPartnerChatProps {
  sessionId: string
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
  onGenerateQuiz: () => Promise<void>
  onGenerateFlashcards: (topic: string) => Promise<void>
  isLoading?: boolean
  subject?: string | null
}

export default function AIPartnerChat({
  sessionId,
  messages,
  onSendMessage,
  onGenerateQuiz,
  onGenerateFlashcards,
  isLoading = false,
  subject,
}: AIPartnerChatProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showFlashcardModal, setShowFlashcardModal] = useState(false)
  const [flashcardTopic, setFlashcardTopic] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isSending) return

    const content = input.trim()
    setInput('')
    setIsSending(true)

    try {
      await onSendMessage(content)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFlashcardGeneration = async () => {
    if (!flashcardTopic.trim()) return
    setShowFlashcardModal(false)
    await onGenerateFlashcards(flashcardTopic.trim())
    setFlashcardTopic('')
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* AI Disclosure Banner */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-700/50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Bot className="w-4 h-4 text-blue-400" />
          <span>
            <strong className="text-blue-400">AI Study Partner</strong> - This is an automated assistant, not a real person.
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        <button
          onClick={onGenerateQuiz}
          disabled={isLoading || isSending}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-colors text-sm disabled:opacity-50"
        >
          <Brain className="w-4 h-4" />
          Quiz Me
        </button>
        <button
          onClick={() => setShowFlashcardModal(true)}
          disabled={isLoading || isSending}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-300 rounded-lg hover:bg-green-600/30 transition-colors text-sm disabled:opacity-50"
        >
          <BookOpen className="w-4 h-4" />
          Flashcards
        </button>
        <div className="flex-1" />
        {subject && (
          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
            {subject}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex gap-3 ${
                message.role === 'USER' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'ASSISTANT' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'USER'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100 border border-slate-700/50'
                }`}
              >
                {message.wasFlagged && (
                  <div className="flex items-center gap-1 text-amber-400 text-xs mb-2">
                    <AlertTriangle className="w-3 h-3" />
                    Content redirected
                  </div>
                )}

                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>

                <div className="text-xs opacity-50 mt-2">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {message.role === 'USER' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {(isLoading || isSending) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask your AI study partner..."
            rows={1}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            disabled={isLoading || isSending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isSending}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Safety reminder */}
        <p className="text-xs text-slate-500 mt-2 text-center">
          Messages are moderated for safety. Stay focused on studying!
        </p>
      </div>

      {/* Flashcard Topic Modal */}
      <AnimatePresence>
        {showFlashcardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowFlashcardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-400" />
                  Generate Flashcards
                </h3>
                <button
                  onClick={() => setShowFlashcardModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Enter a topic and we&apos;ll create flashcards to help you study.
              </p>

              <input
                type="text"
                value={flashcardTopic}
                onChange={(e) => setFlashcardTopic(e.target.value)}
                placeholder="e.g., Photosynthesis, World War II, Calculus derivatives"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFlashcardGeneration()
                }}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowFlashcardModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFlashcardGeneration}
                  disabled={!flashcardTopic.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                  Generate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
