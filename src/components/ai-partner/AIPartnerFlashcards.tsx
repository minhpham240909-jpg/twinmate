'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  BookOpen,
  Plus,
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

export default function AIPartnerFlashcards({
  sessionId,
  subject,
  onAskAI,
}: AIPartnerFlashcardsProps) {
  // Data State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Study State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [hasAnswered, setHasAnswered] = useState(false)

  // Management State
  const [viewMode, setViewMode] = useState<'study' | 'manage' | 'results'>('manage')
  const [formData, setFormData] = useState({ front: '', back: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editData, setEditData] = useState({ front: '', back: '' })

  // Result Tracking
  const [correctCount, setCorrectCount] = useState(0)
  const [results, setResults] = useState<Array<{ id: string; isCorrect: boolean }>>([])

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
      setResults([])
      setCorrectCount(0)
      toast('New cards added! Restarting deck.', { icon: '🔄' })
    }
    prevFlashcardsLengthRef.current = flashcards.length
  }, [flashcards.length, viewMode])

  // Generate flashcards using AI (topic-based)
  const handleGenerateFlashcards = async () => {
    if (!subject) {
      toast.error('No subject specified for this session')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai-partner/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic: subject,
          count: 5,
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

  // Generate flashcards from conversation context
  const handleGenerateFromConversation = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai-partner/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fromConversation: true,
          count: 5,
        }),
      })

      const data = await res.json()

      if (data.success && data.flashcards) {
        const newCards: Flashcard[] = data.flashcards.map((f: { front: string; back: string }, i: number) => ({
          id: `conv-${Date.now()}-${i}`,
          front: f.front,
          back: f.back,
          difficulty: 0,
        }))
        setFlashcards((prev) => [...prev, ...newCards])
        toast.success(`Created ${newCards.length} flashcards from your conversation!`)
        if (viewMode === 'manage') {
          setViewMode('study')
        }
      } else {
        toast.error(data.error || 'Failed to generate flashcards from conversation')
      }
    } catch (error) {
      console.error('Failed to generate flashcards from conversation:', error)
      toast.error('Failed to generate flashcards')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.front.trim() || !formData.back.trim()) return

    const newCard: Flashcard = {
      id: `manual-${Date.now()}`,
      front: formData.front.trim(),
      back: formData.back.trim(),
      difficulty: 0,
    }

    setFlashcards((prev) => [...prev, newCard])
    setFormData({ front: '', back: '' })
    toast.success('Flashcard created!')
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
    setHasAnswered(true)
    setIsFlipped(true)
  }

  const handleNextCard = (wasCorrect?: boolean) => {
    if (wasCorrect !== undefined) {
      setResults((prev) => [...prev, { id: flashcards[currentIndex].id, isCorrect: wasCorrect }])
      if (wasCorrect) setCorrectCount((prev) => prev + 1)
    }

    setIsFlipped(false)
    setHasAnswered(false)
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
    setResults([])
    setCorrectCount(0)
    setViewMode('study')
    setIsFlipped(false)
    setHasAnswered(false)
    setUserAnswer('')
  }

  const handleAskAIAboutCard = async () => {
    if (!onAskAI || !flashcards[currentIndex]) return
    const card = flashcards[currentIndex]
    await onAskAI(`Can you explain this concept more? Question: "${card.front}" Answer: "${card.back}"`)
  }

  // MANAGEMENT VIEW
  if (viewMode === 'manage') {
    return (
      <div className="space-y-6 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Flashcards</h2>
            <p className="text-slate-400 text-sm">Create or generate flashcards for your study session</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={handleGenerateFromConversation}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
              title="Create flashcards based on what you discussed with AI"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              From Chat
            </button>
            <button
              onClick={handleGenerateFlashcards}
              disabled={isGenerating || !subject}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
              title="Generate flashcards about the session subject"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              From Topic
            </button>
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
        </div>

        {/* Create Form */}
        <div className="bg-slate-800/40 backdrop-blur-xl p-6 rounded-xl border border-slate-700/50">
          <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-400" />
            Add New Card
          </h3>
          <form onSubmit={handleCreateCard} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Front (Question)
                </label>
                <textarea
                  value={formData.front}
                  onChange={(e) => setFormData({ ...formData, front: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none h-24"
                  placeholder="What is the capital of France?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Back (Answer)
                </label>
                <textarea
                  value={formData.back}
                  onChange={(e) => setFormData({ ...formData, back: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none h-24"
                  placeholder="Paris"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!formData.front || !formData.back}
                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                Add Card
              </button>
            </div>
          </form>
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
              <p className="text-slate-500 text-sm">Create cards manually or generate with AI</p>
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
          Create flashcards to start studying!
        </p>
        <button
          onClick={() => setViewMode('manage')}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-500 transition-colors"
        >
          Create Flashcards
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

              {/* Ask AI button */}
              {onAskAI && (
                <button
                  onClick={handleAskAIAboutCard}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-colors text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Ask AI to explain
                </button>
              )}

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
              setHasAnswered(false)
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
              setHasAnswered(false)
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
    </div>
  )
}
