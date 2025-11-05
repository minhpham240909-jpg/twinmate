'use client'

import { useState, useEffect } from 'react'

interface Flashcard {
  id: string
  front: string
  back: string
  difficulty: number
  reviewCount: number
  correctCount: number
  incorrectCount: number
  nextReviewDate: Date | null
  lastReviewed: Date | null
  easeFactor: number
  intervalDays: number
  repetitions: number
  createdAt: Date
  updatedAt: Date
}

interface FlashcardStats {
  total: number
  due: number
  new: number
  reviewed: number
  learned: number
  totalReviews: number
  totalCorrect: number
  totalIncorrect: number
  accuracyRate: number
  retentionRate: number
  byDifficulty: {
    easy: number
    medium: number
    hard: number
  }
  nextReviewDate: Date | null
}

interface SessionFlashcardsProps {
  sessionId: string
}

type ViewMode = 'list' | 'study' | 'create' | 'edit'
type StudyQuality = 'easy' | 'medium' | 'hard' | 'again'

export default function SessionFlashcards({ sessionId }: SessionFlashcardsProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [stats, setStats] = useState<FlashcardStats | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Study mode state
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [studyCards, setStudyCards] = useState<Flashcard[]>([])
  const [studyMode, setStudyMode] = useState<'all' | 'due'>('due')

  // Create/Edit form state
  const [formData, setFormData] = useState({ front: '', back: '', difficulty: 0 })
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load flashcards and stats
  useEffect(() => {
    loadFlashcards()
    loadStats()
  }, [sessionId])

  const loadFlashcards = async (dueOnly = false) => {
    try {
      setLoading(true)
      const url = `/api/study-sessions/${sessionId}/flashcards${dueOnly ? '?due=true' : ''}`
      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load flashcards')

      setFlashcards(data.flashcards || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards/stats`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load stats')

      setStats(data.stats)
    } catch (err: any) {
      console.error('Failed to load stats:', err)
    }
  }

  const createFlashcard = async () => {
    if (!formData.front.trim() || !formData.back.trim()) {
      setError('Both front and back sides are required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create flashcard')

      // Reset form and reload
      setFormData({ front: '', back: '', difficulty: 0 })
      setViewMode('list')
      await loadFlashcards()
      await loadStats()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const updateFlashcard = async () => {
    if (!editingCard || !formData.front.trim() || !formData.back.trim()) {
      setError('Both front and back sides are required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards/${editingCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update flashcard')

      // Reset and reload
      setFormData({ front: '', back: '', difficulty: 0 })
      setEditingCard(null)
      setViewMode('list')
      await loadFlashcards()
      await loadStats()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteFlashcard = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this flashcard?')) return

    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards/${cardId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete flashcard')

      await loadFlashcards()
      await loadStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const recordReview = async (cardId: string, quality: StudyQuality) => {
    try {
      const res = await fetch(`/api/study-sessions/${sessionId}/flashcards/${cardId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record review')

      // Move to next card
      if (currentCardIndex < studyCards.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1)
        setIsFlipped(false)
      } else {
        // Finished studying
        setViewMode('list')
        setCurrentCardIndex(0)
        setIsFlipped(false)
        alert(`Great job! You've reviewed ${studyCards.length} card(s).`)
      }

      await loadFlashcards()
      await loadStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const startStudyMode = (mode: 'all' | 'due') => {
    const cards = mode === 'due'
      ? flashcards.filter(card => {
          if (!card.nextReviewDate) return true // Never reviewed
          return new Date(card.nextReviewDate) <= new Date()
        })
      : flashcards

    if (cards.length === 0) {
      alert(mode === 'due' ? 'No cards due for review!' : 'No flashcards available!')
      return
    }

    setStudyCards(cards)
    setStudyMode(mode)
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setViewMode('study')
  }

  const startEdit = (card: Flashcard) => {
    setEditingCard(card)
    setFormData({
      front: card.front,
      back: card.back,
      difficulty: card.difficulty,
    })
    setViewMode('edit')
  }

  const cancelForm = () => {
    setFormData({ front: '', back: '', difficulty: 0 })
    setEditingCard(null)
    setViewMode('list')
    setError(null)
  }

  if (loading && viewMode === 'list') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading flashcards...</div>
      </div>
    )
  }

  // Study Mode View
  if (viewMode === 'study' && studyCards.length > 0) {
    const currentCard = studyCards[currentCardIndex]
    const progress = ((currentCardIndex + 1) / studyCards.length) * 100

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Study Mode</h3>
          <button
            onClick={() => {
              setViewMode('list')
              setIsFlipped(false)
              setCurrentCardIndex(0)
            }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Exit Study Mode
          </button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Card {currentCardIndex + 1} of {studyCards.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Flashcard */}
        <div className="relative">
          <div
            className={`min-h-[300px] p-8 bg-white border-2 rounded-xl shadow-lg cursor-pointer transition-all duration-300 ${
              isFlipped ? 'border-green-500' : 'border-blue-500'
            }`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-sm font-medium text-gray-500 mb-4">
                {isFlipped ? 'Back' : 'Front'}
              </div>
              <div className="text-2xl font-medium whitespace-pre-wrap">
                {isFlipped ? currentCard.back : currentCard.front}
              </div>
            </div>
          </div>

          {!isFlipped && (
            <div className="absolute bottom-4 right-4 text-sm text-gray-400">
              Click to flip
            </div>
          )}
        </div>

        {/* Review Buttons (shown after flip) */}
        {isFlipped && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => recordReview(currentCard.id, 'again')}
              className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              Again
              <div className="text-xs opacity-80">{'< 1 day'}</div>
            </button>
            <button
              onClick={() => recordReview(currentCard.id, 'hard')}
              className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Hard
              <div className="text-xs opacity-80">{'< 1.2x interval'}</div>
            </button>
            <button
              onClick={() => recordReview(currentCard.id, 'medium')}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Good
              <div className="text-xs opacity-80">Normal interval</div>
            </button>
            <button
              onClick={() => recordReview(currentCard.id, 'easy')}
              className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
            >
              Easy
              <div className="text-xs opacity-80">1.3x interval</div>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Create/Edit Form View
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            {viewMode === 'create' ? 'Create Flashcard' : 'Edit Flashcard'}
          </h3>
          <button
            onClick={cancelForm}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Front Side
            </label>
            <textarea
              value={formData.front}
              onChange={(e) => setFormData({ ...formData, front: e.target.value })}
              placeholder="Enter the question or prompt..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Back Side
            </label>
            <textarea
              value={formData.back}
              onChange={(e) => setFormData({ ...formData, back: e.target.value })}
              placeholder="Enter the answer..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0}>Easy</option>
              <option value={1}>Medium</option>
              <option value={2}>Hard</option>
            </select>
          </div>

          <button
            onClick={viewMode === 'create' ? createFlashcard : updateFlashcard}
            disabled={submitting}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
          >
            {submitting ? 'Saving...' : (viewMode === 'create' ? 'Create Flashcard' : 'Update Flashcard')}
          </button>
        </div>
      </div>
    )
  }

  // List View (default)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Flashcards</h3>
        <button
          onClick={() => setViewMode('create')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + New Flashcard
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.due}</div>
            <div className="text-sm text-gray-600">Due for Review</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.accuracyRate}%</div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.learned}</div>
            <div className="text-sm text-gray-600">Learned</div>
          </div>
        </div>
      )}

      {/* Study Buttons */}
      {flashcards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => startStudyMode('due')}
            disabled={!stats || stats.due === 0}
            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg font-medium text-lg transition-all shadow-lg"
          >
            Study Due Cards ({stats?.due || 0})
          </button>
          <button
            onClick={() => startStudyMode('all')}
            className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-medium text-lg transition-all shadow-lg"
          >
            Study All Cards ({flashcards.length})
          </button>
        </div>
      )}

      {/* Flashcard List */}
      {flashcards.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-lg font-medium mb-2">No flashcards yet</p>
          <p className="text-sm">Create your first flashcard to start learning!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flashcards.map((card) => {
            const isDue = !card.nextReviewDate || new Date(card.nextReviewDate) <= new Date()
            const difficultyLabel = ['Easy', 'Medium', 'Hard'][card.difficulty]
            const difficultyColor = ['text-green-600', 'text-yellow-600', 'text-red-600'][card.difficulty]

            return (
              <div
                key={card.id}
                className={`p-4 bg-white border rounded-lg hover:shadow-md transition-shadow ${
                  isDue ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {isDue && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                          Due
                        </span>
                      )}
                      <span className={`text-xs font-medium ${difficultyColor}`}>
                        {difficultyLabel}
                      </span>
                      {card.reviewCount > 0 && (
                        <span className="text-xs text-gray-500">
                          Reviews: {card.reviewCount} | Accuracy: {card.reviewCount > 0 ? Math.round((card.correctCount / card.reviewCount) * 100) : 0}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate mb-1">
                      {card.front}
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {card.back}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(card)}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteFlashcard(card.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
