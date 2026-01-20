'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Plus,
  BookOpen,
  Sparkles,
  ChevronRight,
  Loader2,
  RotateCcw,
  Check,
  AlertCircle,
  Layers,
  Brain,
  Zap,
} from 'lucide-react'

interface FlashcardDeck {
  id: string
  title: string
  description: string | null
  subject: string | null
  cardCount: number
  color: string | null
  lastStudiedAt: string | null
  progress: {
    masteryPercent: number
    cardsStudied: number
    cardsMastered: number
  } | null
}

interface FlashcardCard {
  id: string
  front: string
  back: string
  hint: string | null
  explanation: string | null
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  questionType: 'FLIP' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK'
  multipleChoiceOptions: { id: string; text: string; isCorrect: boolean }[] | null
  progress: {
    status: string
    confidence: number
    nextReviewDate: string | null
  } | null
}

// Study plan types (from "Guide Me" flow)
interface StudyPlanStep {
  id: string
  order: number
  duration: number
  title: string
  description: string
  tips?: string[]
}

interface StudyPlan {
  id: string
  subject: string
  totalMinutes: number
  encouragement: string
  steps: StudyPlanStep[]
}

interface FlashcardPanelProps {
  onClose: () => void
  onOpenFullScreen?: (deckId: string) => void
  studyPlan?: StudyPlan | null
}

type PanelView = 'decks' | 'create' | 'study' | 'generate'

export default function FlashcardPanel({ onClose, onOpenFullScreen, studyPlan }: FlashcardPanelProps) {
  const [view, setView] = useState<PanelView>('decks')
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null)
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // AI Generation state
  const [generateText, setGenerateText] = useState('')
  const [generateTitle, setGenerateTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Study session state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [studyMode, setStudyMode] = useState<'flip' | 'spaced' | 'quiz'>('flip')
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, total: 0 })

  // Fetch decks on mount
  useEffect(() => {
    fetchDecks()
  }, [])

  const fetchDecks = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/flashcards/decks')
      if (response.ok) {
        const data = await response.json()
        setDecks(data.decks || [])
      } else {
        throw new Error('Failed to fetch decks')
      }
    } catch (err) {
      setError('Failed to load flashcard decks')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const startStudySession = async (deck: FlashcardDeck, mode: 'flip' | 'spaced' | 'quiz') => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/flashcards/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId: deck.id, studyMode: mode }),
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedDeck(deck)
        setCards(data.cards || [])
        setSessionId(data.session.id)
        setStudyMode(mode)
        setCurrentCardIndex(0)
        setIsFlipped(false)
        setSessionStats({ correct: 0, incorrect: 0, total: 0 })
        setView('study')
      } else {
        throw new Error('Failed to start study session')
      }
    } catch (err) {
      setError('Failed to start study session')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCardReview = async (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (!cards[currentCardIndex] || !sessionId) return

    const card = cards[currentCardIndex]
    const isCorrect = quality !== 'again'

    try {
      await fetch('/api/flashcards/study/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          cardId: card.id,
          quality,
        }),
      })

      setSessionStats((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        total: prev.total + 1,
      }))

      // Move to next card
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex((prev) => prev + 1)
        setIsFlipped(false)
      } else {
        // Session complete
        setView('decks')
        fetchDecks() // Refresh progress
      }
    } catch (err) {
      console.error('Failed to submit review:', err)
    }
  }

  const handleGenerateFlashcards = async () => {
    // Allow shorter content if using study plan context
    const minLength = studyPlan ? 20 : 50
    if (!generateText.trim() || generateText.length < minLength) {
      setError(`Please enter at least ${minLength} characters of content`)
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Build request with optional study plan context
      const requestBody: Record<string, unknown> = {
        content: generateText,
        title: generateTitle || undefined,
        cardCount: 10,
        questionTypes: ['FLIP', 'MULTIPLE_CHOICE'],
      }

      // If there's a study plan, include it for context-aware generation
      if (studyPlan) {
        requestBody.studyPlanContext = {
          subject: studyPlan.subject,
          steps: studyPlan.steps.map((s) => ({
            title: s.title,
            description: s.description,
            tips: s.tips,
          })),
        }
      }

      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const data = await response.json()
        setGenerateText('')
        setGenerateTitle('')
        setView('decks')
        fetchDecks() // Refresh to show new deck
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate flashcards')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards')
    } finally {
      setIsGenerating(false)
    }
  }

  const currentCard = cards[currentCardIndex]

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'text-green-400'
      case 'MEDIUM': return 'text-yellow-400'
      case 'HARD': return 'text-red-400'
      default: return 'text-neutral-400'
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-neutral-900/95 backdrop-blur-sm border-l border-neutral-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">Flashcards</h2>
            <p className="text-xs text-neutral-400">
              {view === 'decks' && `${decks.length} decks`}
              {view === 'study' && selectedDeck?.title}
              {view === 'generate' && 'AI Generation'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view !== 'decks' && (
            <button
              onClick={() => setView('decks')}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Decks List View */}
        {view === 'decks' && (
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setView('generate')}
                className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl hover:from-purple-500/30 hover:to-blue-500/30 transition-all"
              >
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-white">AI Generate</span>
              </button>
              <button
                onClick={() => {/* TODO: Create manual deck */}}
                className="flex items-center gap-2 p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl hover:bg-neutral-800 transition-all"
              >
                <Plus className="w-5 h-5 text-neutral-400" />
                <span className="text-sm font-medium text-white">Create Deck</span>
              </button>
            </div>

            {/* Decks */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : decks.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400 mb-2">No flashcard decks yet</p>
                <p className="text-sm text-neutral-500">
                  Generate flashcards from your notes using AI
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map((deck) => (
                  <div
                    key={deck.id}
                    className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 hover:border-neutral-600 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{deck.title}</h3>
                        <p className="text-sm text-neutral-400">
                          {deck.cardCount} cards
                          {deck.subject && ` · ${deck.subject}`}
                        </p>
                      </div>
                      {deck.progress && (
                        <div className="text-right">
                          <span className="text-lg font-bold text-blue-400">
                            {Math.round(deck.progress.masteryPercent)}%
                          </span>
                          <p className="text-xs text-neutral-500">mastery</p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {deck.progress && (
                      <div className="h-1.5 bg-neutral-700 rounded-full mb-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                          style={{ width: `${deck.progress.masteryPercent}%` }}
                        />
                      </div>
                    )}

                    {/* Study Mode Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => startStudySession(deck, 'flip')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                        Flip
                      </button>
                      <button
                        onClick={() => startStudySession(deck, 'spaced')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors"
                      >
                        <Brain className="w-4 h-4" />
                        Spaced
                      </button>
                      <button
                        onClick={() => startStudySession(deck, 'quiz')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Quiz
                      </button>
                    </div>

                    {/* Full Screen Button */}
                    {onOpenFullScreen && (
                      <button
                        onClick={() => onOpenFullScreen(deck.id)}
                        className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-neutral-400 hover:text-white text-sm transition-colors"
                      >
                        Full Screen Study
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Generate View */}
        {view === 'generate' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">AI Flashcard Generator</h3>
              </div>
              <p className="text-sm text-neutral-400">
                Paste your notes, textbook content, or any study material and AI will generate flashcards for you.
              </p>
            </div>

            {/* Study Plan Context Badge */}
            {studyPlan && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
                <div className="p-1.5 bg-amber-500/20 rounded-lg">
                  <Brain className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-300">Study Plan Connected</p>
                  <p className="text-xs text-amber-400/70">
                    Flashcards will be tailored to your "{studyPlan.subject}" study plan for better relevance.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Deck Title (optional)
              </label>
              <input
                type="text"
                value={generateTitle}
                onChange={(e) => setGenerateTitle(e.target.value)}
                placeholder="e.g., Biology Chapter 5"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Content to Generate From
              </label>
              <textarea
                value={generateText}
                onChange={(e) => setGenerateText(e.target.value)}
                placeholder="Paste your notes, textbook content, or any study material here... (minimum 50 characters)"
                rows={8}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
              <p className="text-xs text-neutral-500 mt-1">
                {generateText.length} / 50 characters minimum
              </p>
            </div>

            <button
              onClick={handleGenerateFlashcards}
              disabled={isGenerating || generateText.length < 50}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Flashcards...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Flashcards
                </>
              )}
            </button>
          </div>
        )}

        {/* Study View */}
        {view === 'study' && currentCard && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">
                Card {currentCardIndex + 1} of {cards.length}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-green-400">{sessionStats.correct} ✓</span>
                <span className="text-red-400">{sessionStats.incorrect} ✗</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
              />
            </div>

            {/* Card */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative min-h-[300px] cursor-pointer perspective-1000"
            >
              <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* Front */}
                <div className={`absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 rounded-2xl p-6 flex flex-col backface-hidden ${isFlipped ? 'invisible' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
                      {currentCard.difficulty}
                    </span>
                    <span className="text-xs text-neutral-500">Tap to flip</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xl text-white text-center font-medium">
                      {currentCard.front}
                    </p>
                  </div>
                  {currentCard.hint && (
                    <p className="text-sm text-neutral-500 text-center mt-4">
                      💡 {currentCard.hint}
                    </p>
                  )}
                </div>

                {/* Back */}
                <div className={`absolute inset-0 bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-2xl p-6 flex flex-col rotate-y-180 backface-hidden ${!isFlipped ? 'invisible' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-blue-400">Answer</span>
                    <span className="text-xs text-neutral-500">Tap to flip back</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xl text-white text-center font-medium">
                      {currentCard.back}
                    </p>
                  </div>
                  {currentCard.explanation && (
                    <p className="text-sm text-neutral-400 text-center mt-4">
                      {currentCard.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Rating Buttons (show after flip) */}
            {isFlipped && (
              <div className="grid grid-cols-4 gap-2 animate-in fade-in duration-300">
                <button
                  onClick={() => handleCardReview('again')}
                  className="py-3 bg-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/30 transition-colors"
                >
                  Again
                </button>
                <button
                  onClick={() => handleCardReview('hard')}
                  className="py-3 bg-orange-500/20 text-orange-400 rounded-xl font-medium hover:bg-orange-500/30 transition-colors"
                >
                  Hard
                </button>
                <button
                  onClick={() => handleCardReview('good')}
                  className="py-3 bg-blue-500/20 text-blue-400 rounded-xl font-medium hover:bg-blue-500/30 transition-colors"
                >
                  Good
                </button>
                <button
                  onClick={() => handleCardReview('easy')}
                  className="py-3 bg-green-500/20 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-colors"
                >
                  Easy
                </button>
              </div>
            )}
          </div>
        )}

        {/* No cards in study */}
        {view === 'study' && cards.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-2">All caught up!</p>
            <p className="text-sm text-neutral-400">
              No cards due for review. Great job!
            </p>
            <button
              onClick={() => setView('decks')}
              className="mt-4 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors"
            >
              Back to Decks
            </button>
          </div>
        )}
      </div>

      {/* Add custom styles for 3D flip */}
      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  )
}
