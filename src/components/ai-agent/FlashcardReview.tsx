/**
 * Flashcard Review Component
 * Implements spaced repetition with mastery levels
 */

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle2, XCircle, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Flashcard {
  id: string
  front: string
  back: string
  masteryLevel: number
  nextReviewAt: string
}

interface FlashcardReviewProps {
  onComplete?: (reviewed: number, correct: number) => void
}

export default function FlashcardReview({ onComplete }: FlashcardReviewProps) {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewedCards, setReviewedCards] = useState<Set<string>>(new Set())
  const [correctCards, setCorrectCards] = useState<Set<string>>(new Set())
  const [showResults, setShowResults] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadDueCards()
  }, [])

  async function loadDueCards() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Get cards due for review
      const { data, error } = await supabase
        .from('flashcard')
        .select('id, front, back, mastery_level, next_review_at')
        .eq('user_id', user.id)
        .lte('next_review_at', new Date().toISOString())
        .order('next_review_at', { ascending: true })
        .limit(20)

      if (error) {
        console.error('Failed to load flashcards:', error)
        return
      }

      setCards(
        data.map(card => ({
          id: card.id,
          front: card.front,
          back: card.back,
          masteryLevel: card.mastery_level || 0,
          nextReviewAt: card.next_review_at,
        }))
      )
    } catch (err) {
      console.error('Error loading cards:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleResponse = async (correct: boolean) => {
    const currentCard = cards[currentIndex]
    if (!currentCard) return

    // Mark as reviewed
    const newReviewed = new Set(reviewedCards)
    newReviewed.add(currentCard.id)
    setReviewedCards(newReviewed)

    if (correct) {
      const newCorrect = new Set(correctCards)
      newCorrect.add(currentCard.id)
      setCorrectCards(newCorrect)
    }

    // Update mastery level and next review time using spaced repetition
    const newMasteryLevel = correct
      ? Math.min(currentCard.masteryLevel + 1, 5)
      : Math.max(currentCard.masteryLevel - 1, 0)

    // Calculate next review time (SM-2 inspired)
    const intervals = [1, 3, 7, 14, 30, 60] // days
    const nextReviewDays = intervals[newMasteryLevel] || 1
    const nextReviewAt = new Date()
    nextReviewAt.setDate(nextReviewAt.getDate() + nextReviewDays)

    // Update in database
    await supabase
      .from('flashcard')
      .update({
        mastery_level: newMasteryLevel,
        next_review_at: nextReviewAt.toISOString(),
      })
      .eq('id', currentCard.id)

    // Move to next card or show results
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    } else {
      setShowResults(true)
      onComplete?.(reviewedCards.size + 1, correctCards.size + (correct ? 1 : 0))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RotateCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading flashcards...</p>
        </div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">All Caught Up!</h3>
          <p className="text-slate-600">No flashcards due for review right now.</p>
          <p className="text-sm text-slate-500 mt-2">Come back later for more practice.</p>
        </div>
      </div>
    )
  }

  if (showResults) {
    const totalReviewed = reviewedCards.size
    const totalCorrect = correctCards.size
    const accuracy = Math.round((totalCorrect / totalReviewed) * 100)

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-2xl mx-auto text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center"
        >
          <Trophy className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-3xl font-bold text-slate-900 mb-2">Review Complete!</h2>
        <p className="text-slate-600 mb-8">Great job on your flashcard review session.</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">{totalReviewed}</p>
            <p className="text-sm text-slate-600 mt-1">Reviewed</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-600">{totalCorrect}</p>
            <p className="text-sm text-slate-600 mt-1">Correct</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl">
            <p className="text-3xl font-bold text-purple-600">{accuracy}%</p>
            <p className="text-sm text-slate-600 mt-1">Accuracy</p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowResults(false)
            setCurrentIndex(0)
            setReviewedCards(new Set())
            setCorrectCards(new Set())
            loadDueCards()
          }}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Review More Cards
        </button>
      </motion.div>
    )
  }

  const currentCard = cards[currentIndex]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-2xl mx-auto"
    >
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
          <span>
            Card {currentIndex + 1} of {cards.length}
          </span>
          <span>Mastery: Level {currentCard.masteryLevel}/5</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
          />
        </div>
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className="relative w-full h-80 cursor-pointer mb-8 perspective-1000"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isFlipped ? 'back' : 'front'}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl"
          >
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-4">
                {isFlipped ? 'Back' : 'Front'}
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
              <p className="text-sm text-slate-500 mt-6">Click to flip</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Response Buttons (only show when flipped) */}
      {isFlipped && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4"
        >
          <button
            onClick={() => handleResponse(false)}
            className="flex items-center justify-center gap-2 py-4 bg-red-50 border-2 border-red-200 text-red-700 font-semibold rounded-xl hover:bg-red-100 transition-colors"
          >
            <XCircle className="w-5 h-5" />
            Incorrect
          </button>
          <button
            onClick={() => handleResponse(true)}
            className="flex items-center justify-center gap-2 py-4 bg-green-50 border-2 border-green-200 text-green-700 font-semibold rounded-xl hover:bg-green-100 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            Correct
          </button>
        </motion.div>
      )}

      {/* Navigation (only show when not flipped) */}
      {!isFlipped && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1)
              }
            }}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <button
            onClick={handleFlip}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Show Answer
          </button>

          <button
            onClick={() => {
              if (currentIndex < cards.length - 1) {
                setCurrentIndex(currentIndex + 1)
              }
            }}
            disabled={currentIndex === cards.length - 1}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </motion.div>
  )
}
