'use client'

import { useState, useEffect } from 'react'
import {
  X,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Settings,
  Trophy,
  Zap,
  Brain,
  BookOpen,
  Check,
  AlertCircle,
  Loader2,
  Lightbulb,
} from 'lucide-react'

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
  } | null
}

interface FlashcardFullScreenProps {
  deckId: string
  deckTitle: string
  onClose: () => void
}

type StudyMode = 'flip' | 'spaced' | 'quiz'

export default function FlashcardFullScreen({ deckId, deckTitle, onClose }: FlashcardFullScreenProps) {
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyMode, setStudyMode] = useState<StudyMode>('flip')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [fillInAnswer, setFillInAnswer] = useState('')

  // Stats
  const [stats, setStats] = useState({
    correct: 0,
    incorrect: 0,
    skipped: 0,
    xpEarned: 0,
  })

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [shuffled, setShuffled] = useState(false)
  const [typeAnswerMode, setTypeAnswerMode] = useState(true) // Type answer before flip
  const [userTypedAnswer, setUserTypedAnswer] = useState('')
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false)

  // Load cards
  useEffect(() => {
    const loadCards = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/flashcards/study', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deckId, studyMode }),
        })

        if (response.ok) {
          const data = await response.json()
          let loadedCards = data.cards || []
          if (shuffled) {
            loadedCards = [...loadedCards].sort(() => Math.random() - 0.5)
          }
          setCards(loadedCards)
          setSessionId(data.session.id)
        } else {
          throw new Error('Failed to load cards')
        }
      } catch (err) {
        setError('Failed to load flashcards')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    loadCards()
  }, [deckId, studyMode, shuffled])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        goToPrevious()
      } else if (e.key === 'ArrowRight' && currentIndex < cards.length - 1) {
        goToNext()
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (studyMode === 'flip') {
          setIsFlipped(!isFlipped)
        }
      } else if (e.key === 'Escape') {
        onClose()
      } else if (e.key >= '1' && e.key <= '4' && answerRevealed) {
        const ratings = ['again', 'hard', 'good', 'easy'] as const
        handleRating(ratings[parseInt(e.key) - 1])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, cards.length, isFlipped, answerRevealed, studyMode])

  const currentCard = cards[currentIndex]

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      resetCardState()
    }
  }

  const goToNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      resetCardState()
    }
  }

  const resetCardState = () => {
    setIsFlipped(false)
    setShowHint(false)
    setSelectedAnswer(null)
    setAnswerRevealed(false)
    setFillInAnswer('')
    setUserTypedAnswer('')
    setHasSubmittedAnswer(false)
  }

  const handleRating = async (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard || !sessionId) return

    const isCorrect = quality !== 'again'

    try {
      const response = await fetch('/api/flashcards/study/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          cardId: currentCard.id,
          quality,
          usedHint: showHint,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setStats((prev) => ({
          ...prev,
          correct: prev.correct + (isCorrect ? 1 : 0),
          incorrect: prev.incorrect + (isCorrect ? 0 : 1),
          xpEarned: prev.xpEarned + (data.xpEarned || 0),
        }))
      }
    } catch (err) {
      console.error('Failed to submit rating:', err)
    }

    // Move to next card or finish
    if (currentIndex < cards.length - 1) {
      goToNext()
    } else {
      // Study session complete - show completion
    }
  }

  const handleMultipleChoiceSelect = (optionId: string) => {
    if (answerRevealed) return
    setSelectedAnswer(optionId)
  }

  const handleMultipleChoiceSubmit = () => {
    if (!selectedAnswer || !currentCard?.multipleChoiceOptions) return

    setAnswerRevealed(true)
    const isCorrect = currentCard.multipleChoiceOptions.find(
      (opt) => opt.id === selectedAnswer
    )?.isCorrect

    // Auto-submit rating based on answer
    setTimeout(() => {
      handleRating(isCorrect ? 'good' : 'again')
    }, 1500)
  }

  const handleFillInSubmit = () => {
    if (!fillInAnswer.trim() || !currentCard) return

    setAnswerRevealed(true)
    const isCorrect = fillInAnswer.toLowerCase().trim() === currentCard.back.toLowerCase().trim()

    setTimeout(() => {
      handleRating(isCorrect ? 'good' : 'again')
    }, 1500)
  }

  const handleTrueFalseSelect = (answer: boolean) => {
    if (answerRevealed || !currentCard) return

    setSelectedAnswer(answer ? 'true' : 'false')
    setAnswerRevealed(true)

    const isCorrect =
      (answer && currentCard.back.toLowerCase() === 'true') ||
      (!answer && currentCard.back.toLowerCase() === 'false')

    setTimeout(() => {
      handleRating(isCorrect ? 'good' : 'again')
    }, 1500)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-500/20 text-green-400'
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400'
      case 'HARD': return 'bg-red-500/20 text-red-400'
      default: return 'bg-neutral-500/20 text-neutral-400'
    }
  }

  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0
  const accuracy = stats.correct + stats.incorrect > 0
    ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
    : 0

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-neutral-950 z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading flashcards...</p>
        </div>
      </div>
    )
  }

  if (error || cards.length === 0) {
    return (
      <div className="fixed inset-0 bg-neutral-950 z-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white font-semibold mb-2">{error || 'No cards found'}</p>
          <p className="text-neutral-400 mb-6">
            {error ? 'Please try again later.' : 'This deck has no cards yet.'}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Session complete
  if (currentIndex >= cards.length - 1 && answerRevealed && studyMode !== 'flip') {
    return (
      <div className="fixed inset-0 bg-neutral-950 z-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
          <p className="text-neutral-400 mb-6">You've reviewed all cards in this deck.</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-green-500/20 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">{stats.correct}</div>
              <div className="text-xs text-green-400/70">Correct</div>
            </div>
            <div className="bg-red-500/20 rounded-xl p-4">
              <div className="text-2xl font-bold text-red-400">{stats.incorrect}</div>
              <div className="text-xs text-red-400/70">Incorrect</div>
            </div>
            <div className="bg-purple-500/20 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-400">+{stats.xpEarned}</div>
              <div className="text-xs text-purple-400/70">XP Earned</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCurrentIndex(0)
                setStats({ correct: 0, incorrect: 0, skipped: 0, xpEarned: 0 })
                resetCardState()
              }}
              className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
            >
              Study Again
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-white">{deckTitle}</h1>
            <p className="text-xs text-neutral-400">
              Card {currentIndex + 1} of {cards.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-400">{stats.correct} ✓</span>
            <span className="text-red-400">{stats.incorrect} ✗</span>
            {stats.xpEarned > 0 && (
              <span className="text-purple-400 flex items-center gap-1">
                <Zap className="w-4 h-4" />
                {stats.xpEarned}
              </span>
            )}
          </div>

          {/* Mode Selector */}
          <div className="flex bg-neutral-800 rounded-lg p-1">
            {(['flip', 'spaced', 'quiz'] as StudyMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setStudyMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  studyMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {mode === 'flip' && <BookOpen className="w-4 h-4" />}
                {mode === 'spaced' && <Brain className="w-4 h-4" />}
                {mode === 'quiz' && <Zap className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-neutral-800">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Card */}
          {currentCard && (
            <>
              {/* Difficulty Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
                  {currentCard.difficulty}
                </span>
                {currentCard.hint && (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showHint
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Hint
                  </button>
                )}
              </div>

              {/* Flip Card Mode */}
              {(studyMode === 'flip' || studyMode === 'spaced') && currentCard.questionType === 'FLIP' && (
                <div className="space-y-4">
                  {/* Card Display */}
                  <div
                    onClick={() => {
                      if (hasSubmittedAnswer || !typeAnswerMode) {
                        setIsFlipped(!isFlipped)
                      }
                    }}
                    className={`relative h-64 perspective-1000 ${hasSubmittedAnswer || !typeAnswerMode ? 'cursor-pointer' : ''}`}
                  >
                    <div
                      className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
                        isFlipped ? 'rotate-y-180' : ''
                      }`}
                    >
                      {/* Front */}
                      <div className={`absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 rounded-2xl p-8 flex flex-col backface-hidden ${isFlipped ? 'invisible' : ''}`}>
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-2xl text-white text-center font-medium">
                            {currentCard.front}
                          </p>
                        </div>
                        {showHint && currentCard.hint && (
                          <p className="text-sm text-yellow-400/80 text-center mt-4">
                            💡 {currentCard.hint}
                          </p>
                        )}
                        {!typeAnswerMode && (
                          <p className="text-sm text-neutral-500 text-center mt-4">
                            Click or press Space to flip
                          </p>
                        )}
                      </div>

                      {/* Back */}
                      <div className={`absolute inset-0 bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-2xl p-8 flex flex-col rotate-y-180 backface-hidden ${!isFlipped ? 'invisible' : ''}`}>
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-2xl text-white text-center font-medium">
                            {currentCard.back}
                          </p>
                        </div>
                        {currentCard.explanation && (
                          <p className="text-sm text-blue-300/80 text-center mt-4">
                            {currentCard.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Type Answer Input (only in typeAnswerMode and not yet submitted) */}
                  {typeAnswerMode && !isFlipped && (
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={userTypedAnswer}
                          onChange={(e) => setUserTypedAnswer(e.target.value)}
                          disabled={hasSubmittedAnswer}
                          placeholder="Type your answer here..."
                          className={`w-full px-6 py-4 bg-neutral-800 border rounded-xl text-white text-lg placeholder-neutral-500 focus:outline-none transition-colors ${
                            hasSubmittedAnswer
                              ? userTypedAnswer.toLowerCase().trim() === currentCard.back.toLowerCase().trim()
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-orange-500 bg-orange-500/10'
                              : 'border-neutral-700 focus:border-blue-500'
                          }`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !hasSubmittedAnswer && userTypedAnswer.trim()) {
                              e.preventDefault()
                              setHasSubmittedAnswer(true)
                              setIsFlipped(true)
                            }
                          }}
                        />
                        {hasSubmittedAnswer && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {userTypedAnswer.toLowerCase().trim() === currentCard.back.toLowerCase().trim() ? (
                              <Check className="w-6 h-6 text-green-400" />
                            ) : (
                              <AlertCircle className="w-6 h-6 text-orange-400" />
                            )}
                          </div>
                        )}
                      </div>

                      {!hasSubmittedAnswer ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setHasSubmittedAnswer(true)
                              setIsFlipped(true)
                            }}
                            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                            disabled={!userTypedAnswer.trim()}
                          >
                            Check Answer
                          </button>
                          <button
                            onClick={() => {
                              setHasSubmittedAnswer(true)
                              setIsFlipped(true)
                            }}
                            className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded-xl font-medium transition-colors"
                          >
                            Skip & Reveal
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-400 text-center">
                          {userTypedAnswer.toLowerCase().trim() === currentCard.back.toLowerCase().trim()
                            ? '✓ Great job! Your answer matches.'
                            : 'Your answer differs from the correct one. Rate how well you knew it.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Show click to flip message after submission */}
                  {typeAnswerMode && hasSubmittedAnswer && !isFlipped && (
                    <p className="text-sm text-neutral-500 text-center">
                      Click card or press Space to see the answer
                    </p>
                  )}
                </div>
              )}

              {/* Multiple Choice Mode */}
              {(studyMode === 'quiz' || currentCard.questionType === 'MULTIPLE_CHOICE') &&
                currentCard.multipleChoiceOptions && (
                  <div className="space-y-4">
                    <div className="bg-neutral-800/50 border border-neutral-700 rounded-2xl p-8">
                      <p className="text-2xl text-white text-center font-medium">
                        {currentCard.front}
                      </p>
                      {showHint && currentCard.hint && (
                        <p className="text-sm text-yellow-400/80 text-center mt-4">
                          💡 {currentCard.hint}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {currentCard.multipleChoiceOptions.map((option) => {
                        const isSelected = selectedAnswer === option.id
                        const isCorrectOption = option.isCorrect
                        const showResult = answerRevealed

                        let buttonClass = 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                        if (showResult) {
                          if (isCorrectOption) {
                            buttonClass = 'bg-green-500/20 border-green-500'
                          } else if (isSelected && !isCorrectOption) {
                            buttonClass = 'bg-red-500/20 border-red-500'
                          }
                        } else if (isSelected) {
                          buttonClass = 'bg-blue-500/20 border-blue-500'
                        }

                        return (
                          <button
                            key={option.id}
                            onClick={() => handleMultipleChoiceSelect(option.id)}
                            disabled={answerRevealed}
                            className={`p-4 border rounded-xl text-left transition-all ${buttonClass}`}
                          >
                            <span className="text-white">{option.text}</span>
                            {showResult && isCorrectOption && (
                              <Check className="w-5 h-5 text-green-400 float-right" />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {selectedAnswer && !answerRevealed && (
                      <button
                        onClick={handleMultipleChoiceSubmit}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
                      >
                        Check Answer
                      </button>
                    )}
                  </div>
                )}

              {/* True/False Mode */}
              {currentCard.questionType === 'TRUE_FALSE' && (
                <div className="space-y-4">
                  <div className="bg-neutral-800/50 border border-neutral-700 rounded-2xl p-8">
                    <p className="text-2xl text-white text-center font-medium">
                      {currentCard.front}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleTrueFalseSelect(true)}
                      disabled={answerRevealed}
                      className={`py-6 rounded-xl font-bold text-xl transition-all ${
                        answerRevealed && currentCard.back.toLowerCase() === 'true'
                          ? 'bg-green-500/30 border-2 border-green-500 text-green-400'
                          : answerRevealed && selectedAnswer === 'true'
                          ? 'bg-red-500/30 border-2 border-red-500 text-red-400'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                      }`}
                    >
                      True
                    </button>
                    <button
                      onClick={() => handleTrueFalseSelect(false)}
                      disabled={answerRevealed}
                      className={`py-6 rounded-xl font-bold text-xl transition-all ${
                        answerRevealed && currentCard.back.toLowerCase() === 'false'
                          ? 'bg-green-500/30 border-2 border-green-500 text-green-400'
                          : answerRevealed && selectedAnswer === 'false'
                          ? 'bg-red-500/30 border-2 border-red-500 text-red-400'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                      }`}
                    >
                      False
                    </button>
                  </div>
                </div>
              )}

              {/* Fill in the Blank Mode */}
              {currentCard.questionType === 'FILL_IN_BLANK' && (
                <div className="space-y-4">
                  <div className="bg-neutral-800/50 border border-neutral-700 rounded-2xl p-8">
                    <p className="text-2xl text-white text-center font-medium">
                      {currentCard.front}
                    </p>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={fillInAnswer}
                      onChange={(e) => setFillInAnswer(e.target.value)}
                      disabled={answerRevealed}
                      placeholder="Type your answer..."
                      className={`w-full px-6 py-4 bg-neutral-800 border rounded-xl text-white text-lg placeholder-neutral-500 focus:outline-none transition-colors ${
                        answerRevealed
                          ? fillInAnswer.toLowerCase().trim() === currentCard.back.toLowerCase().trim()
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-red-500 bg-red-500/10'
                          : 'border-neutral-700 focus:border-blue-500'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !answerRevealed) {
                          handleFillInSubmit()
                        }
                      }}
                    />
                    {answerRevealed && (
                      <div className="mt-2 text-center">
                        <p className="text-sm text-neutral-400">Correct answer:</p>
                        <p className="text-lg text-green-400 font-medium">{currentCard.back}</p>
                      </div>
                    )}
                  </div>

                  {!answerRevealed && fillInAnswer.trim() && (
                    <button
                      onClick={handleFillInSubmit}
                      className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
                    >
                      Check Answer
                    </button>
                  )}
                </div>
              )}

              {/* Rating Buttons for Flip Mode */}
              {(studyMode === 'flip' || studyMode === 'spaced') &&
                currentCard.questionType === 'FLIP' &&
                isFlipped && (
                  <div className="grid grid-cols-4 gap-3 mt-6 animate-in fade-in duration-300">
                    <button
                      onClick={() => handleRating('again')}
                      className="py-4 bg-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/30 transition-colors"
                    >
                      <span className="text-xs block text-red-400/60">1</span>
                      Again
                    </button>
                    <button
                      onClick={() => handleRating('hard')}
                      className="py-4 bg-orange-500/20 text-orange-400 rounded-xl font-medium hover:bg-orange-500/30 transition-colors"
                    >
                      <span className="text-xs block text-orange-400/60">2</span>
                      Hard
                    </button>
                    <button
                      onClick={() => handleRating('good')}
                      className="py-4 bg-blue-500/20 text-blue-400 rounded-xl font-medium hover:bg-blue-500/30 transition-colors"
                    >
                      <span className="text-xs block text-blue-400/60">3</span>
                      Good
                    </button>
                    <button
                      onClick={() => handleRating('easy')}
                      className="py-4 bg-green-500/20 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-colors"
                    >
                      <span className="text-xs block text-green-400/60">4</span>
                      Easy
                    </button>
                  </div>
                )}
            </>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between p-4 border-t border-neutral-800">
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Previous
        </button>

        <div className="text-neutral-400 text-sm">
          {accuracy > 0 && <span>{accuracy}% accuracy</span>}
        </div>

        <button
          onClick={goToNext}
          disabled={currentIndex >= cards.length - 1}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ArrowRight className="w-5 h-5" />
        </button>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Study Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-white">Type Answer First</span>
                  <p className="text-xs text-neutral-400">Type your answer before revealing</p>
                </div>
                <button
                  onClick={() => setTypeAnswerMode(!typeAnswerMode)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    typeAnswerMode ? 'bg-blue-500' : 'bg-neutral-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      typeAnswerMode ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between">
                <span className="text-white">Shuffle Cards</span>
                <button
                  onClick={() => setShuffled(!shuffled)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    shuffled ? 'bg-blue-500' : 'bg-neutral-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      shuffled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              <button
                onClick={() => {
                  setShowSettings(false)
                  setCurrentIndex(0)
                  resetCardState()
                  setStats({ correct: 0, incorrect: 0, skipped: 0, xpEarned: 0 })
                }}
                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Restart Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for 3D flip */}
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
