'use client'

/**
 * SessionFlashcards Component
 *
 * Private flashcard study for sessions.
 * - Each user has their own private flashcards
 * - Flashcards are only visible to the owner
 * - Users can share flashcards to screen for others to view
 * - Supports spaced repetition learning
 */

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { Lock, Share2, Eye, Loader2, Plus, Trash2, RotateCcw, BookOpen } from 'lucide-react'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  userId: string
}

interface SharedFlashcardsData {
  flashcards: Flashcard[]
  currentIndex: number
  isFlipped: boolean
  sharedBy: {
    id: string
    name: string
    avatarUrl?: string | null
  }
}

interface SessionFlashcardsProps {
  sessionId: string
  currentUserId?: string
  onShareFlashcards?: (data: SharedFlashcardsData) => void
  onStopSharing?: () => void
  isSharing?: boolean
  sharedFlashcards?: SharedFlashcardsData | null
}

export default function SessionFlashcards({
  sessionId,
  currentUserId,
  onShareFlashcards,
  onStopSharing,
  isSharing = false,
  sharedFlashcards = null
}: SessionFlashcardsProps) {
  // Data State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)

  // Study State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [hasAnswered, setHasAnswered] = useState(false)

  // Management State
  const [viewMode, setViewMode] = useState<'study' | 'manage' | 'results'>('study')
  const [formData, setFormData] = useState({ front: '', back: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showShareConfirm, setShowShareConfirm] = useState(false)

  // Result Tracking
  const [correctCount, setCorrectCount] = useState(0)
  const [results, setResults] = useState<Array<{id: string, isCorrect: boolean}>>([])

  // Initialize
  useEffect(() => {
    loadFlashcards()
  }, [sessionId])

  useEffect(() => {
    if (!loading) {
      if (flashcards.length === 0) {
        setViewMode('manage')
      } else if (viewMode === 'results' && flashcards.length > results.length) {
        if (flashcards.length > results.length) {
          setViewMode('study')
        }
      }
    }
  }, [loading, flashcards.length])

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

  const loadFlashcards = async () => {
    try {
      setLoading(true)
      // Fetch only current user's flashcards (private by default)
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards?own=true`)
      const data = await res.json()
      if (data.flashcards) {
        setFlashcards(data.flashcards)
      }
    } catch (error) {
      console.error('Failed to load flashcards', error)
      toast.error('Failed to load flashcards')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.front.trim() || !formData.back.trim()) return

    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, difficulty: 0 }),
      })

      if (!res.ok) throw new Error('Failed to create')

      setFormData({ front: '', back: '' })
      toast.success('Flashcard created')
      loadFlashcards()
    } catch (error) {
      toast.error('Failed to create flashcard')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Delete this card?')) return
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Deleted')
        loadFlashcards()
      }
    } catch (error) {
      toast.error('Failed to delete')
    }
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

  const handleRevealForCreator = () => {
    setHasAnswered(true)
    setIsFlipped(true)
    setUserAnswer('(Revealed by creator)')
  }

  const handleNextCard = (wasCorrect?: boolean) => {
    if (wasCorrect !== undefined) {
      setResults(prev => [...prev, { id: flashcards[currentIndex].id, isCorrect: wasCorrect }])
      if (wasCorrect) setCorrectCount(prev => prev + 1)
    }

    setIsFlipped(false)
    setHasAnswered(false)
    setUserAnswer('')

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
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

  // Share flashcards to screen
  const handleShareFlashcards = () => {
    if (onShareFlashcards && flashcards.length > 0) {
      onShareFlashcards({
        flashcards,
        currentIndex,
        isFlipped,
        sharedBy: {
          id: currentUserId || '',
          name: 'You',
          avatarUrl: null
        }
      })
      setShowShareConfirm(false)
      toast.success('Flashcards shared with all participants')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your flashcards...</span>
        </div>
      </div>
    )
  }

  // If viewing shared flashcards from another user
  if (sharedFlashcards && sharedFlashcards.sharedBy.id !== currentUserId) {
    return (
      <SharedFlashcardsViewer
        data={sharedFlashcards}
        onClose={() => {}}
      />
    )
  }

  // MANAGEMENT VIEW
  if (viewMode === 'manage') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-semibold text-white">My Flashcards</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/50 rounded-full">
              <Lock className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Private</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Share button */}
            {onShareFlashcards && (
              isSharing ? (
                <button
                  onClick={onStopSharing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-green-600/80 hover:bg-red-600 text-white"
                >
                  <Eye className="w-4 h-4" />
                  Stop Sharing
                </button>
              ) : (
                <button
                  onClick={() => setShowShareConfirm(true)}
                  disabled={flashcards.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-blue-600/80 hover:bg-blue-600 text-white disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <Share2 className="w-4 h-4" />
                  Share to Screen
                </button>
              )
            )}

            <button
              onClick={() => setViewMode('study')}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 backdrop-blur-sm"
              disabled={flashcards.length === 0}
            >
              <Eye className="w-4 h-4" />
              Study Mode
            </button>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            Your flashcards are private and only visible to you. Use "Share to Screen" to show them to your study partners.
          </p>
        </div>

        {/* Create Form */}
        <div className="bg-slate-800/40 backdrop-blur-xl p-6 rounded-xl shadow-sm border border-slate-700/50">
          <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            Add New Card
          </h3>
          <form onSubmit={handleCreateCard} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Front (Question)</label>
                <textarea
                  value={formData.front}
                  onChange={e => setFormData({...formData, front: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none h-32 backdrop-blur-sm"
                  placeholder="What is the capital of France?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Back (Answer)</label>
                <textarea
                  value={formData.back}
                  onChange={e => setFormData({...formData, back: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none h-32 backdrop-blur-sm"
                  placeholder="Paris"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !formData.front || !formData.back}
                className="px-6 py-2.5 bg-blue-600/80 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {isSubmitting ? 'Adding...' : 'Add Card'}
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">My Deck ({flashcards.length} cards)</h3>
          {flashcards.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/20 rounded-xl border-2 border-dashed border-slate-700/50 backdrop-blur-sm">
              <p className="text-slate-400">No flashcards yet. Create one above!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {flashcards.map((card, idx) => (
                <div key={card.id} className="group bg-slate-800/40 backdrop-blur-sm p-4 rounded-lg border border-slate-700/50 shadow-sm hover:shadow-md transition-shadow flex justify-between items-start gap-4">
                  <div className="flex gap-4 flex-1">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-700/50 rounded text-xs font-medium text-slate-400">
                      {idx + 1}
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      <div className="text-sm"><span className="font-medium text-white">Q:</span> <span className="text-slate-300">{card.front}</span></div>
                      <div className="text-sm"><span className="font-medium text-white">A:</span> <span className="text-slate-300">{card.back}</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="text-slate-400 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                    title="Delete card"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share confirmation modal */}
        {showShareConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Share2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Share Flashcards to Screen</h3>
                  <p className="text-sm text-slate-400">Your partners will see your flashcards</p>
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-6">
                This will share your {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''} to the session screen. All participants will be able to study along with you. You can stop sharing at any time.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowShareConfirm(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShareFlashcards}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share Flashcards
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // STUDY MODE - No cards
  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-8">
        <div className="w-20 h-20 bg-slate-800/40 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">📭</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Flashcards Yet</h3>
        <p className="text-slate-400 max-w-md mb-2">
          You haven't created any flashcards for this session yet.
        </p>
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-6">
          <Lock className="w-3 h-3" />
          Your flashcards are private until you share them
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setViewMode('manage')}
            className="px-6 py-2.5 bg-blue-600/80 text-white font-medium rounded-lg hover:bg-blue-600 transition-all backdrop-blur-sm"
          >
            Create Flashcards
          </button>

          <button
            onClick={loadFlashcards}
            className="px-6 py-2.5 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 text-slate-200 font-medium rounded-lg hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    )
  }

  // RESULTS MODE
  if (viewMode === 'results') {
    const percentage = flashcards.length > 0 ? Math.round((correctCount / flashcards.length) * 100) : 0

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-24 h-24 bg-yellow-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-6 text-5xl shadow-lg border border-yellow-500/30">
          {percentage >= 80 ? '🏆' : percentage >= 50 ? '👍' : '📚'}
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">Session Complete!</h2>
        <p className="text-slate-400 mb-8">Here is how you performed:</p>

        <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-8">
          <div className="bg-green-500/10 backdrop-blur-sm p-4 rounded-xl border border-green-500/30">
            <div className="text-2xl font-bold text-green-400">{correctCount}</div>
            <div className="text-xs text-green-300 uppercase font-semibold">Correct</div>
          </div>
          <div className="bg-red-500/10 backdrop-blur-sm p-4 rounded-xl border border-red-500/30">
            <div className="text-2xl font-bold text-red-400">{flashcards.length - correctCount}</div>
            <div className="text-xs text-red-300 uppercase font-semibold">Incorrect</div>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-sm p-4 rounded-xl border border-blue-500/30">
            <div className="text-2xl font-bold text-blue-400">{percentage}%</div>
            <div className="text-xs text-blue-300 uppercase font-semibold">Score</div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleRestartDeck}
            className="px-6 py-3 bg-blue-600/80 text-white font-semibold rounded-xl hover:bg-blue-600 transition-all shadow-lg backdrop-blur-sm"
          >
            Restart Deck
          </button>
          <button
            onClick={() => setViewMode('manage')}
            className="px-6 py-3 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 text-slate-200 font-semibold rounded-xl hover:bg-slate-800/60 transition-all"
          >
            Manage Cards
          </button>
        </div>
      </div>
    )
  }

  // STUDY MODE - With cards
  const currentCard = flashcards[currentIndex]
  const isCreator = currentCard.userId === currentUserId
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">My Flashcards</h3>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/50 rounded-full">
            <Lock className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Private</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Share button */}
          {onShareFlashcards && (
            isSharing ? (
              <button
                onClick={onStopSharing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all bg-green-600/80 hover:bg-red-600 text-white text-sm"
              >
                <Eye className="w-4 h-4" />
                Stop Sharing
              </button>
            ) : (
              <button
                onClick={() => setShowShareConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all bg-blue-600/80 hover:bg-blue-600 text-white text-sm"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )
          )}

          <button
            onClick={() => setViewMode('manage')}
            className="text-sm text-slate-400 hover:text-white underline"
          >
            Add/Edit Cards
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex justify-between items-center mb-8">
        <div className="px-3 py-1 bg-blue-500/20 backdrop-blur-sm text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
          Card {currentIndex + 1} / {flashcards.length}
        </div>
        <div className="w-32 h-2 bg-slate-800/50 backdrop-blur-sm rounded-full overflow-hidden border border-slate-700/50">
          <div className="h-full bg-blue-600/80 transition-all duration-500" style={{ width: `${progress}%` }} />
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
          <div className="absolute inset-0 bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-700/50 p-8 md:p-12 flex flex-col" style={{ backfaceVisibility: 'hidden' }}>
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Question</h3>
                {isCreator && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded-full font-medium border border-green-500/30">
                    You created this
                  </span>
                )}
              </div>
              <div className="text-2xl md:text-3xl font-medium text-white leading-relaxed max-w-xl">
                {currentCard.front}
              </div>

              <div className="w-full max-w-md mt-8" onClick={(e) => e.stopPropagation()}>
                {isCreator ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-slate-400 italic">
                      Since you created this card, you can flip it immediately.
                    </p>
                    <button
                      onClick={handleRevealForCreator}
                      className="px-8 py-3 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all transform active:scale-95 backdrop-blur-sm"
                    >
                      Flip Card ↻
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitAnswer} className="relative">
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full px-6 py-4 bg-slate-900/50 border-2 border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-lg text-center backdrop-blur-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!userAnswer.trim()}
                      className="mt-4 w-full py-3 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:shadow-none backdrop-blur-sm"
                    >
                      Check Answer
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 bg-slate-900 rounded-2xl shadow-xl p-8 md:p-12 flex flex-col text-white"
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <div className="space-y-2">
                <h3 className="text-blue-300 text-sm font-semibold uppercase tracking-wider">Correct Answer</h3>
                <div className="text-2xl md:text-3xl font-bold leading-relaxed max-w-xl">
                  {currentCard.back}
                </div>
              </div>

              <div className="w-full h-px bg-slate-700/50" />

              <div className="space-y-2">
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Your Answer</h3>
                <div className="text-xl text-slate-200">
                  {userAnswer}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => handleNextCard(false)}
                  className="px-8 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-all"
                >
                  Got it Wrong
                </button>
                <button
                  onClick={() => handleNextCard(true)}
                  className="px-8 py-3 bg-green-100 text-green-700 font-bold rounded-xl hover:bg-green-200 transition-all"
                >
                  Got it Right
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {!isFlipped && (
        <p className="text-center text-slate-500 text-sm mt-8">
          {isCreator ? 'You can flip this card anytime.' : 'Type your answer and press Enter to reveal the solution'}
        </p>
      )}

      {/* Share confirmation modal */}
      {showShareConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Share2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Share Flashcards to Screen</h3>
                <p className="text-sm text-slate-400">Your partners will see your flashcards</p>
              </div>
            </div>

            <p className="text-slate-300 text-sm mb-6">
              This will share your {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''} to the session screen. All participants will be able to study along with you.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowShareConfirm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareFlashcards}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Flashcards
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared Flashcards Viewer Component
function SharedFlashcardsViewer({ data, onClose }: { data: SharedFlashcardsData; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(data.currentIndex)
  const [isFlipped, setIsFlipped] = useState(false)

  const currentCard = data.flashcards[currentIndex]
  const progress = ((currentIndex + 1) / data.flashcards.length) * 100

  const handleNext = () => {
    if (currentIndex < data.flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setIsFlipped(false)
    }
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <BookOpen className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Shared Flashcards</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Shared by</span>
              <span className="font-medium text-slate-300">{data.sharedBy.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400">Card {currentIndex + 1} of {data.flashcards.length}</span>
        </div>
        <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500/80 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="p-6">
        <div
          className="bg-slate-900/50 rounded-xl p-8 min-h-[200px] flex flex-col items-center justify-center cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">
            {isFlipped ? 'Answer' : 'Question'}
          </p>
          <p className="text-xl text-white text-center">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>
          <p className="text-xs text-slate-500 mt-6">Click to flip</p>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === data.flashcards.length - 1}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500 text-center">
          This is a shared view from {data.sharedBy.name}'s flashcards.
        </p>
      </div>
    </div>
  )
}
