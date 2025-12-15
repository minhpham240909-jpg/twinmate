'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  userId: string
}

interface SessionFlashcardsProps {
  sessionId: string
  isHost?: boolean
  currentUserId?: string
}

export default function SessionFlashcards({ sessionId, isHost = false, currentUserId }: SessionFlashcardsProps) {
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
  
  // Result Tracking
  const [correctCount, setCorrectCount] = useState(0)
  const [results, setResults] = useState<Array<{id: string, isCorrect: boolean}>>([])

  // Initialize
  useEffect(() => {
    loadFlashcards()
  }, [sessionId])

  useEffect(() => {
    // Default to manage mode if no cards
    if (!loading) {
        if (flashcards.length === 0) {
            setViewMode('manage')
        } else if (viewMode === 'results' && flashcards.length > results.length) {
            // If new cards added while showing results, go back to study
            // But we need to be careful not to reset if we just finished.
            // Actually, simpler logic: if results are shown, and card count increases, reset.
            // Ideally we compare with a ref of previous length, but for now:
            // If we are in results, it means we finished all. If length > currentIndex + 1 (which was max),
            // it implies new cards.
            // Let's just use a simple check: if in results mode, and we have more cards than we answered,
            // user likely wants to see them.
             if (flashcards.length > results.length) {
                 setViewMode('study')
                 // Optional: resume from where we left off? Or restart?
                 // User said "go back to normal show the flashcards".
                 // Safest is to stay on results until user explicitly restarts or we detect meaningful change.
                 // Let's implement a dedicated listener for changes.
             }
        }
    }
  }, [loading, flashcards.length])

  // Watch for new cards while in results mode to auto-switch back
  const prevFlashcardsLengthRef = useRef(flashcards.length)
  useEffect(() => {
      if (viewMode === 'results' && flashcards.length > prevFlashcardsLengthRef.current) {
          // If cards were added (length increased), reset to study mode
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
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards`)
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
        // Update score
        setResults(prev => [...prev, { id: flashcards[currentIndex].id, isCorrect: wasCorrect }])
        if (wasCorrect) setCorrectCount(prev => prev + 1)
    }

    setIsFlipped(false)
    setHasAnswered(false)
    setUserAnswer('')
    
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // Deck finished
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // MANAGEMENT VIEW (Accessible to everyone now)
  if (viewMode === 'manage') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 p-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-white">Manage Flashcards</h2>
                <p className="text-slate-400">Create cards for the study group</p>
            </div>
            <div className="flex gap-3">
                <button
                  onClick={() => setViewMode('study')}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 backdrop-blur-sm"
                  disabled={flashcards.length === 0}
                >
                  <span>Preview Mode</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
            </div>
        </div>

        {/* Create Form */}
        <div className="bg-slate-800/40 backdrop-blur-xl p-6 rounded-xl shadow-sm border border-slate-700/50">
            <h3 className="text-lg font-semibold mb-4 text-white">Add New Card</h3>
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
                        className="px-6 py-2.5 bg-blue-600/80 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    >
                        {isSubmitting ? 'Adding...' : 'Add Card'}
                    </button>
                </div>
            </form>
        </div>

        {/* List */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Current Deck ({flashcards.length})</h3>
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
                            {/* Allow delete for everyone for now to ensure functionality is accessible as requested */}
                            <button
                                onClick={() => handleDeleteCard(card.id)}
                                className="text-slate-400 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                title="Delete card"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    )
  }

  // STUDY MODE
  if (flashcards.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
            <div className="w-20 h-20 bg-slate-800/40 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📭</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Flashcards Yet</h3>
            <p className="text-slate-400 max-w-md">
                No flashcards have been created for this session yet. Be the first to add one!
            </p>

            <div className="flex flex-col gap-3 mt-6">
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Check for New Cards
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

  const currentCard = flashcards[currentIndex]
  const isCreator = currentCard.userId === currentUserId
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  return (
    <div className="max-w-3xl mx-auto py-4 px-4">
      {/* Header & Controls */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-blue-500/20 backdrop-blur-sm text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
                Card {currentIndex + 1} / {flashcards.length}
            </div>
            <button
                onClick={() => setViewMode('manage')}
                className="text-sm text-slate-400 hover:text-white underline"
            >
                Add/Edit Cards
            </button>
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
                
                {/* Answer Section - Differs for Creator vs Others */}
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
                
                <button
                    onClick={() => handleNextCard(false)}
                    className="mt-8 px-8 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-all flex-1"
                >
                    Got it Wrong
                </button>
                <button
                    onClick={() => handleNextCard(true)}
                    className="mt-8 px-8 py-3 bg-green-100 text-green-700 font-bold rounded-xl hover:bg-green-200 transition-all flex-1"
                >
                    Got it Right
                </button>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Instructions footer */}
      {!isFlipped && (
        <p className="text-center text-slate-500 text-sm mt-8">
          {isCreator ? 'You can flip this card anytime.' : 'Type your answer and press Enter to reveal the solution'}
        </p>
      )}
    </div>
  )
}
