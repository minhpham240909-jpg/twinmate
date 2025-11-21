'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { toast } from 'react-hot-toast'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
}

interface SessionFlashcardsProps {
  sessionId: string
  isHost?: boolean
}

export default function SessionFlashcards({ sessionId, isHost = false }: SessionFlashcardsProps) {
  // Data State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  
  // Study State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [hasAnswered, setHasAnswered] = useState(false)
  
  // Host/Edit State
  const [viewMode, setViewMode] = useState<'study' | 'manage'>('study')
  const [formData, setFormData] = useState({ front: '', back: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize
  useEffect(() => {
    loadFlashcards()
  }, [sessionId])

  useEffect(() => {
    // If host, default to manage mode if no cards, otherwise study
    if (!loading) {
        if (isHost && flashcards.length === 0) {
            setViewMode('manage')
        }
    }
  }, [loading, isHost])

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

  const handleAutoGenerate = async () => {
    const topic = window.prompt('Enter a topic to generate flashcards for (e.g., "React Basics", "World Capitals", "Science"):')
    if (!topic) return

    try {
      setIsGenerating(true)
      toast.loading('Generating flashcards...', { id: 'generating' })

      // MOCK AI GENERATION: In a real app, this would call an AI API.
      // For now, we'll simulate generation with some predefined sets or generic cards.
      const mockData: Record<string, Array<{front: string, back: string}>> = {
        'react': [
            { front: 'What is a Component in React?', back: 'A reusable, self-contained piece of UI code.' },
            { front: 'What is useState used for?', back: 'To manage local state within a functional component.' },
            { front: 'What is useEffect used for?', back: 'To perform side effects like data fetching or subscriptions.' },
            { front: 'What is the Virtual DOM?', back: 'A lightweight copy of the real DOM used for performance optimization.' },
            { front: 'What are Props?', back: 'Read-only inputs passed from parent to child components.' }
        ],
        'capitals': [
            { front: 'Capital of France?', back: 'Paris' },
            { front: 'Capital of Japan?', back: 'Tokyo' },
            { front: 'Capital of Brazil?', back: 'Brasilia' },
            { front: 'Capital of Canada?', back: 'Ottawa' },
            { front: 'Capital of Australia?', back: 'Canberra' }
        ]
      }

      // Simple keyword matching for demo
      const lowerTopic = topic.toLowerCase()
      let cardsToCreate = []
      if (lowerTopic.includes('react')) cardsToCreate = mockData['react']
      else if (lowerTopic.includes('capital')) cardsToCreate = mockData['capitals']
      else {
          // Generic fallback if topic not matched in demo
          cardsToCreate = [
              { front: `What is the most important concept in ${topic}?`, back: `The core fundamental principle of ${topic}.` },
              { front: `Example of ${topic}?`, back: `A specific instance or case study of ${topic}.` },
              { front: `Why is ${topic} important?`, back: `It helps in understanding broader contexts.` },
              { front: `Who founded/discovered ${topic}?`, back: `The key historical figure associated with it.` },
              { front: `Key term in ${topic}?`, back: `A crucial vocabulary word.` }
          ]
      }

      // Create cards sequentially
      let count = 0
      for (const card of cardsToCreate) {
        const res = await fetch(`/api/study-sessions/${sessionId}/flashcards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...card, difficulty: 0 }),
        })
        if (res.ok) count++
      }

      toast.success(`Generated ${count} flashcards for "${topic}"`, { id: 'generating' })
      loadFlashcards()
    } catch (error) {
      console.error(error)
      toast.error('Failed to generate flashcards', { id: 'generating' })
    } finally {
      setIsGenerating(false)
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

  const handleNextCard = () => {
    setIsFlipped(false)
    setHasAnswered(false)
    setUserAnswer('')
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // Completed logic
      toast.success('Deck completed! Great job!')
      setCurrentIndex(0)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // HOST MANAGEMENT VIEW
  if (isHost && viewMode === 'manage') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 p-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Flashcards</h2>
                <p className="text-gray-500">Create cards for your study group</p>
            </div>
            <div className="flex gap-3">
                 <button
                  onClick={handleAutoGenerate}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isGenerating ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  )}
                  <span>Auto-Generate</span>
                </button>
                <button
                  onClick={() => setViewMode('study')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                  disabled={flashcards.length === 0}
                >
                  <span>Preview Mode</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
            </div>
        </div>

        {/* Create Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Add New Card</h3>
            <form onSubmit={handleCreateCard} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Front (Question)</label>
                        <textarea
                            value={formData.front}
                            onChange={e => setFormData({...formData, front: e.target.value})}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none h-32"
                            placeholder="What is the capital of France?"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Back (Answer)</label>
                        <textarea
                            value={formData.back}
                            onChange={e => setFormData({...formData, back: e.target.value})}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none h-32"
                            placeholder="Paris"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.front || !formData.back}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Adding...' : 'Add Card'}
                    </button>
                </div>
            </form>
        </div>

        {/* List */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Deck ({flashcards.length})</h3>
            {flashcards.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500">No flashcards yet. Create one above!</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {flashcards.map((card, idx) => (
                        <div key={card.id} className="group bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex justify-between items-start gap-4">
                            <div className="flex gap-4 flex-1">
                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-medium text-gray-500">
                                    {idx + 1}
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                    <div className="text-sm"><span className="font-medium text-gray-900">Q:</span> <span className="text-gray-600">{card.front}</span></div>
                                    <div className="text-sm"><span className="font-medium text-gray-900">A:</span> <span className="text-gray-600">{card.back}</span></div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDeleteCard(card.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1 opacity-0 group-hover:opacity-100"
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

  // STUDY MODE (For everyone)
  if (flashcards.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📭</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Flashcards Yet</h3>
            <p className="text-gray-500 max-w-md">
                {isHost ? "You haven't created any flashcards for this session yet." : "The host hasn't created any flashcards yet. Ask them to add some!"}
            </p>
            {isHost && (
                <div className="flex flex-col gap-3 mt-6">
                    <button 
                        onClick={() => setViewMode('manage')}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all"
                    >
                        Create Flashcards
                    </button>
                     <button 
                        onClick={handleAutoGenerate}
                        disabled={isGenerating}
                        className="px-6 py-2.5 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 transition-all"
                    >
                        {isGenerating ? 'Generating...' : '✨ Auto-Generate with AI'}
                    </button>
                </div>
            )}
        </div>
    )
  }

  const currentCard = flashcards[currentIndex]
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  return (
    <div className="max-w-3xl mx-auto py-4 px-4">
      {/* Header & Controls */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                Card {currentIndex + 1} / {flashcards.length}
            </div>
            {isHost && (
                <button 
                    onClick={() => setViewMode('manage')}
                    className="text-sm text-gray-500 hover:text-gray-900 underline"
                >
                    Edit Deck
                </button>
            )}
        </div>
        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 3D Card Container */}
      <div className="relative w-full aspect-[3/2]" style={{ perspective: '1000px' }}>
        <motion.div
          className="w-full h-full relative transition-all duration-700"
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* FRONT */}
          <div className="absolute inset-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 flex flex-col" style={{ backfaceVisibility: 'hidden' }}>
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Question</h3>
                <div className="text-2xl md:text-3xl font-medium text-gray-900 leading-relaxed max-w-xl">
                    {currentCard.front}
                </div>
                
                {/* Answer Input - Only on front */}
                <div className="w-full max-w-md mt-8" onClick={(e) => e.stopPropagation()}>
                    <form onSubmit={handleSubmitAnswer} className="relative">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg text-center placeholder:text-gray-400"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!userAnswer.trim()}
                            className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:shadow-none"
                        >
                            Check Answer
                        </button>
                    </form>
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
                    onClick={handleNextCard}
                    className="mt-8 px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg active:scale-95"
                >
                    {currentIndex === flashcards.length - 1 ? 'Finish Deck' : 'Next Card →'}
                </button>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Instructions footer */}
      {!isFlipped && (
        <p className="text-center text-gray-400 text-sm mt-8">
          Type your answer and press Enter to reveal the solution
        </p>
      )}
    </div>
  )
}
