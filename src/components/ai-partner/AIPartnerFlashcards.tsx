'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  BookOpen,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Check,
  X,
  Edit2,
  Save,
  MessageSquare,
  Send,
} from 'lucide-react'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  isCorrect?: boolean
}

interface AIPartnerFlashcardsProps {
  sessionId: string
  subject?: string | null
  onAskAI?: (question: string) => Promise<void>
}

// AI Explain Modal Component
function AIExplainModal({
  isOpen,
  onClose,
  card,
  sessionId,
}: {
  isOpen: boolean
  onClose: () => void
  card: Flashcard | null
  sessionId: string
}) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Reset state when modal opens with new card
  useEffect(() => {
    if (isOpen && card) {
      setQuestion('')
      setMessages([])
    }
  }, [isOpen, card?.id])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAskQuestion = async () => {
    if (!question.trim() || !card || isLoading) return

    const userQuestion = question.trim()
    setQuestion('')
    setMessages((prev) => [...prev, { role: 'user', content: userQuestion }])
    setIsLoading(true)

    try {
      // Build context about the flashcard
      const contextPrompt = `I'm studying a flashcard. The question is: "${card.front}" and the answer is: "${card.back}".

My question about this: ${userQuestion}`

      const res = await fetch('/api/ai-partner/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content: contextPrompt,
        }),
      })

      const data = await res.json()

      if (data.success && data.aiMessage) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.aiMessage.content }])
      } else {
        toast.error('Failed to get explanation')
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I could not process your question. Please try again.' }])
      }
    } catch (error) {
      console.error('Failed to get AI explanation:', error)
      toast.error('Failed to get explanation')
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !card) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-700 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              AI Explain
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Flashcard Context */}
          <div className="p-4 bg-slate-900/50 border-b border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Flashcard</div>
            <div className="text-sm text-white font-medium mb-1">{card.front}</div>
            <div className="text-sm text-slate-300">Answer: {card.back}</div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Ask any question about this flashcard.</p>
                <p className="text-xs text-slate-500 mt-1">e.g., "Can you explain this in simpler terms?"</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAskQuestion()
                  }
                }}
                placeholder="Ask a question about this flashcard..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <button
                onClick={handleAskQuestion}
                disabled={!question.trim() || isLoading}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function AIPartnerFlashcards({
  sessionId,
  subject,
}: AIPartnerFlashcardsProps) {
  // Data State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Study State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')

  // Management State
  const [viewMode, setViewMode] = useState<'study' | 'manage' | 'results'>('manage')
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editData, setEditData] = useState({ front: '', back: '' })

  // Result Tracking
  const [correctCount, setCorrectCount] = useState(0)

  // AI Explain Modal State
  const [showExplainModal, setShowExplainModal] = useState(false)
  const [explainCard, setExplainCard] = useState<Flashcard | null>(null)

  // Generation Count
  const [generateCount, setGenerateCount] = useState(5)
  const [topicInput, setTopicInput] = useState('')
  const MAX_FLASHCARDS = 20

  // Load flashcards from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`ai-flashcards-${sessionId}`)
    if (saved) {
      try {
        const savedCards = JSON.parse(saved)
        setFlashcards(savedCards)
        if (savedCards.length > 0) {
          setViewMode('study')
        }
      } catch (e) {
        console.error('Failed to load flashcards', e)
      }
    }
  }, [sessionId])

  // Save flashcards to localStorage when they change
  useEffect(() => {
    if (flashcards.length > 0) {
      localStorage.setItem(`ai-flashcards-${sessionId}`, JSON.stringify(flashcards))
    }
  }, [flashcards, sessionId])

  // Watch for new cards while in results mode
  const prevFlashcardsLengthRef = useRef(flashcards.length)
  useEffect(() => {
    if (viewMode === 'results' && flashcards.length > prevFlashcardsLengthRef.current) {
      setViewMode('study')
      setCurrentIndex(0)
      setCorrectCount(0)
      toast('New cards added! Restarting deck.', { icon: '🔄' })
    }
    prevFlashcardsLengthRef.current = flashcards.length
  }, [flashcards.length, viewMode])

  // Generate flashcards using AI (topic-based)
  const handleGenerateFlashcards = async () => {
    const topic = topicInput.trim() || subject
    if (!topic) {
      toast.error('Please enter a topic or set a session subject')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai-partner/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic,
          count: generateCount,
        }),
      })

      const data = await res.json()

      if (data.success && data.flashcards) {
        const newCards: Flashcard[] = data.flashcards.map((f: { front: string; back: string }, i: number) => ({
          id: `ai-${Date.now()}-${i}`,
          front: f.front,
          back: f.back,
          difficulty: 0,
        }))
        setFlashcards((prev) => [...prev, ...newCards])
        toast.success(`Generated ${newCards.length} flashcards!`)
        setTopicInput('')
        if (viewMode === 'manage') {
          setViewMode('study')
        }
      } else {
        toast.error(data.error || 'Failed to generate flashcards')
      }
    } catch (error) {
      console.error('Failed to generate flashcards:', error)
      toast.error('Failed to generate flashcards')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteCard = (id: string) => {
    if (!confirm('Delete this card?')) return
    setFlashcards((prev) => prev.filter((c) => c.id !== id))
    toast.success('Card deleted')
  }

  const handleEditCard = (card: Flashcard) => {
    setEditingCard(card.id)
    setEditData({ front: card.front, back: card.back })
  }

  const handleSaveEdit = (id: string) => {
    if (!editData.front.trim() || !editData.back.trim()) return
    setFlashcards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, front: editData.front.trim(), back: editData.back.trim() } : c
      )
    )
    setEditingCard(null)
    toast.success('Card updated')
  }

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userAnswer.trim()) {
      toast.error('Please enter an answer first')
      return
    }
    setIsFlipped(true)
  }

  const handleNextCard = (wasCorrect?: boolean) => {
    if (wasCorrect !== undefined) {
      if (wasCorrect) setCorrectCount((prev) => prev + 1)
    }

    setIsFlipped(false)
    setUserAnswer('')

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setViewMode('results')
      toast.success('Deck completed!')
    }
  }

  const handleRestartDeck = () => {
    setCurrentIndex(0)
    setCorrectCount(0)
    setViewMode('study')
    setIsFlipped(false)
    setUserAnswer('')
  }

  const handleOpenExplainModal = (card: Flashcard) => {
    setExplainCard(card)
    setShowExplainModal(true)
  }

  // MANAGEMENT VIEW
  if (viewMode === 'manage') {
    return (
      <div className="space-y-6 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Flashcards</h2>
              <p className="text-slate-400 text-sm">Generate flashcards from a topic to study</p>
            </div>
            {flashcards.length > 0 && (
              <button
                onClick={() => setViewMode('study')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Study ({flashcards.length})
              </button>
            )}
          </div>

          {/* AI Generation Controls */}
          <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300 whitespace-nowrap">Generate</label>
                <input
                  type="number"
                  min={1}
                  max={MAX_FLASHCARDS}
                  value={generateCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    setGenerateCount(Math.min(Math.max(val, 1), MAX_FLASHCARDS))
                  }}
                  className="w-16 px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
                <span className="text-sm text-slate-400">cards</span>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder={subject || 'Enter a topic (e.g., Photosynthesis, World War II)'}
                disabled={isGenerating}
                className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateFlashcards()
                }}
              />
              <button
                onClick={handleGenerateFlashcards}
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate
              </button>
            </div>

            {subject && !topicInput && (
              <p className="text-xs text-slate-500">
                Will generate flashcards about: {subject}
              </p>
            )}
          </div>
        </div>

        {/* Card List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">
            Current Deck ({flashcards.length})
          </h3>
          {flashcards.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/20 rounded-xl border-2 border-dashed border-slate-700/50">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No flashcards yet</p>
              <p className="text-slate-500 text-sm">Generate flashcards from a topic above</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {flashcards.map((card, idx) => (
                <div
                  key={card.id}
                  className="group bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                >
                  {editingCard === card.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={editData.front}
                          onChange={(e) => setEditData({ ...editData, front: e.target.value })}
                          className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white"
                          placeholder="Front"
                        />
                        <input
                          value={editData.back}
                          onChange={(e) => setEditData({ ...editData, back: e.target.value })}
                          className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white"
                          placeholder="Back"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingCard(null)}
                          className="px-3 py-1 text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(card.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-500"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 flex-1">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-700/50 rounded text-xs font-medium text-slate-400">
                          {idx + 1}
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                          <div className="text-sm">
                            <span className="font-medium text-slate-400">Q:</span>{' '}
                            <span className="text-white">{card.front}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-slate-400">A:</span>{' '}
                            <span className="text-white">{card.back}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenExplainModal(card)}
                          className="p-1 text-slate-400 hover:text-purple-400 transition-colors"
                          title="AI Explain"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditCard(card)}
                          className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Explain Modal */}
        <AIExplainModal
          isOpen={showExplainModal}
          onClose={() => setShowExplainModal(false)}
          card={explainCard}
          sessionId={sessionId}
        />
      </div>
    )
  }

  // RESULTS VIEW
  if (viewMode === 'results') {
    const percentage = flashcards.length > 0 ? Math.round((correctCount / flashcards.length) * 100) : 0

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 rounded-full flex items-center justify-center mb-6 text-5xl border border-yellow-500/30"
        >
          {percentage >= 80 ? '🏆' : percentage >= 50 ? '👍' : '📚'}
        </motion.div>

        <h2 className="text-3xl font-bold text-white mb-2">Session Complete!</h2>
        <p className="text-slate-400 mb-8">Here is how you performed:</p>

        <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-8">
          <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/30">
            <div className="text-2xl font-bold text-green-400">{correctCount}</div>
            <div className="text-xs text-green-300 uppercase font-semibold">Correct</div>
          </div>
          <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/30">
            <div className="text-2xl font-bold text-red-400">
              {flashcards.length - correctCount}
            </div>
            <div className="text-xs text-red-300 uppercase font-semibold">Incorrect</div>
          </div>
          <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/30">
            <div className="text-2xl font-bold text-blue-400">{percentage}%</div>
            <div className="text-xs text-blue-300 uppercase font-semibold">Score</div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleRestartDeck}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Restart Deck
          </button>
          <button
            onClick={() => setViewMode('manage')}
            className="px-6 py-3 bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-600 transition-colors"
          >
            Manage Cards
          </button>
        </div>
      </div>
    )
  }

  // STUDY VIEW
  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-8">
        <BookOpen className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Flashcards Yet</h3>
        <p className="text-slate-400 max-w-md mb-6">
          Generate flashcards from a topic to start studying!
        </p>
        <button
          onClick={() => setViewMode('manage')}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-500 transition-colors"
        >
          Generate Flashcards
        </button>
      </div>
    )
  }

  const currentCard = flashcards[currentIndex]
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  return (
    <div className="max-w-3xl mx-auto py-4 px-4">
      {/* Header & Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
            Card {currentIndex + 1} / {flashcards.length}
          </div>
          <button
            onClick={() => setViewMode('manage')}
            className="text-sm text-slate-400 hover:text-white underline"
          >
            Manage Cards
          </button>
        </div>
        <div className="w-32 h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 3D Card Container */}
      <div className="relative w-full aspect-[3/2]" style={{ perspective: '1000px' }}>
        <motion.div
          key={currentIndex}
          className="w-full h-full relative"
          initial={{ opacity: 0, x: 50, rotateY: 0 }}
          animate={{ opacity: 1, x: 0, rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.4 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-700/50 p-8 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                Question
              </h3>
              <div className="text-2xl md:text-3xl font-medium text-white leading-relaxed max-w-xl">
                {currentCard.front}
              </div>

              <form onSubmit={handleSubmitAnswer} className="w-full max-w-md mt-6">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full px-6 py-4 bg-slate-900/50 border-2 border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-lg text-center"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!userAnswer.trim()}
                  className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  Check Answer
                </button>
              </form>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 bg-slate-900 rounded-2xl shadow-xl border border-slate-700/50 p-8 flex flex-col text-white"
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-blue-300 text-sm font-semibold uppercase tracking-wider">
                  Correct Answer
                </h3>
                <div className="text-2xl md:text-3xl font-bold leading-relaxed max-w-xl">
                  {currentCard.back}
                </div>
              </div>

              <div className="w-full h-px bg-slate-700/50" />

              <div className="space-y-2">
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                  Your Answer
                </h3>
                <div className="text-xl text-slate-200">{userAnswer}</div>
              </div>

              {/* AI Explain button */}
              <button
                onClick={() => handleOpenExplainModal(currentCard)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-colors text-sm"
              >
                <Sparkles className="w-4 h-4" />
                AI Explain
              </button>

              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => handleNextCard(false)}
                  className="flex items-center gap-2 px-8 py-3 bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-xl hover:bg-red-500/30 transition-all"
                >
                  <X className="w-5 h-5" />
                  Got it Wrong
                </button>
                <button
                  onClick={() => handleNextCard(true)}
                  className="flex items-center gap-2 px-8 py-3 bg-green-500/20 text-green-400 border border-green-500/30 font-bold rounded-xl hover:bg-green-500/30 transition-all"
                >
                  <Check className="w-5 h-5" />
                  Got it Right
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex((prev) => prev - 1)
              setIsFlipped(false)
              setUserAnswer('')
            }
          }}
          disabled={currentIndex === 0}
          className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => {
            if (currentIndex < flashcards.length - 1) {
              setCurrentIndex((prev) => prev + 1)
              setIsFlipped(false)
              setUserAnswer('')
            }
          }}
          disabled={currentIndex === flashcards.length - 1}
          className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Instructions */}
      {!isFlipped && (
        <p className="text-center text-slate-500 text-sm mt-6">
          Type your answer and press Enter to reveal the solution
        </p>
      )}

      {/* AI Explain Modal */}
      <AIExplainModal
        isOpen={showExplainModal}
        onClose={() => setShowExplainModal(false)}
        card={explainCard}
        sessionId={sessionId}
      />
    </div>
  )
}
