'use client'

/**
 * LESSON SLIDES COMPONENT
 *
 * Displays the understanding section (40%) of each step.
 * User must complete the lesson before actions unlock.
 *
 * Structure:
 * - Slide navigation (dots or arrows)
 * - Each slide explains a concept with WHY
 * - Understanding check at the end
 * - Bridge to actions section
 *
 * Design principles:
 * - Clean, focused, no distractions
 * - One concept at a time
 * - Clear progress through slides
 * - Warm, mentor voice
 */

import { useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Target,
  CheckCircle2,
  ExternalLink,
  Play,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface LessonSlide {
  order: number
  title: string
  concept: string
  explanation: string
  whyItMatters: string
  whatHappensWithout: string
  realWorldExample: string
  analogyOrMetaphor?: string
  visualHint?: string
  keyTakeaway: string
}

interface LessonResource {
  type: string
  title: string
  description?: string
  searchQuery?: string
  directUrl?: string
  thumbnailUrl?: string
  platformName?: string
  priority?: number
}

interface UnderstandingCheck {
  question: string
  correctAnswer: string
  hint?: string
}

interface StepLesson {
  title: string
  subtitle?: string
  duration: number
  slides: LessonSlide[]
  resources?: LessonResource[]
  understandingCheck?: UnderstandingCheck
  bridgeToActions: string
}

interface LessonSlidesProps {
  lesson: StepLesson
  isCompleted?: boolean
  onComplete?: () => void
  onResourceClick?: (resource: LessonResource) => void
  className?: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export function LessonSlides({
  lesson,
  isCompleted = false,
  onComplete,
  onResourceClick,
  className = '',
}: LessonSlidesProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [showCheck, setShowCheck] = useState(false)
  const [checkPassed, setCheckPassed] = useState(isCompleted)
  const [showHint, setShowHint] = useState(false)

  const totalSlides = lesson.slides.length
  const currentSlide = lesson.slides[currentSlideIndex]
  const isLastSlide = currentSlideIndex === totalSlides - 1
  const hasUnderstandingCheck = !!lesson.understandingCheck

  const goToNextSlide = useCallback(() => {
    if (isLastSlide) {
      if (hasUnderstandingCheck && !checkPassed) {
        setShowCheck(true)
      } else {
        onComplete?.()
      }
    } else {
      setCurrentSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1))
    }
  }, [isLastSlide, hasUnderstandingCheck, checkPassed, onComplete, totalSlides])

  const goToPrevSlide = useCallback(() => {
    if (showCheck) {
      setShowCheck(false)
    } else {
      setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))
    }
  }, [showCheck])

  const handleCheckComplete = useCallback(() => {
    setCheckPassed(true)
    onComplete?.()
  }, [onComplete])

  // If already completed, show completion state
  if (isCompleted && !showCheck) {
    return (
      <div className={`bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Lesson Completed
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              {lesson.title}
            </div>
          </div>
        </div>
        <button
          onClick={() => setCurrentSlideIndex(0)}
          className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Review lesson →
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xs font-medium tracking-widest text-blue-600 dark:text-blue-400 uppercase">
                Lesson • {lesson.duration} min
              </div>
              <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100">
                {lesson.title}
              </h3>
            </div>
          </div>

          {/* Slide Progress */}
          <div className="flex items-center gap-1.5">
            {lesson.slides.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setShowCheck(false)
                  setCurrentSlideIndex(index)
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentSlideIndex && !showCheck
                    ? 'bg-blue-600 dark:bg-blue-400 w-4'
                    : index < currentSlideIndex || (isLastSlide && showCheck)
                    ? 'bg-blue-400 dark:bg-blue-600'
                    : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
            {hasUnderstandingCheck && (
              <button
                onClick={() => isLastSlide && setShowCheck(true)}
                className={`w-2 h-2 rounded-full transition-all ${
                  showCheck
                    ? 'bg-blue-600 dark:bg-blue-400 w-4'
                    : checkPassed
                    ? 'bg-emerald-500'
                    : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
                aria-label="Understanding check"
              />
            )}
          </div>
        </div>
        {lesson.subtitle && (
          <p className="mt-2 text-sm text-blue-700 dark:text-blue-300 italic">
            {lesson.subtitle}
          </p>
        )}
      </div>

      {/* Content Area */}
      {showCheck && lesson.understandingCheck ? (
        // Understanding Check
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-indigo-500" />
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
              Quick Check
            </h4>
          </div>

          <div className="mb-6">
            <p className="text-base text-neutral-800 dark:text-neutral-200 font-medium mb-4">
              {lesson.understandingCheck.question}
            </p>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg mb-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                What a good answer looks like:
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {lesson.understandingCheck.correctAnswer}
              </p>
            </div>

            {lesson.understandingCheck.hint && (
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
              >
                {showHint ? 'Hide hint' : 'Need a hint?'}
              </button>
            )}

            {showHint && lesson.understandingCheck.hint && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                💡 {lesson.understandingCheck.hint}
              </div>
            )}
          </div>

          {/* Bridge to Actions */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg mb-6">
            <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
              {lesson.bridgeToActions}
            </p>
          </div>

          <button
            onClick={handleCheckComplete}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            I understand - let's practice!
          </button>
        </div>
      ) : currentSlide ? (
        // Slide Content
        <div className="p-6 space-y-5">
          {/* Slide Title with Visual */}
          <div className="flex items-start gap-3">
            {currentSlide.visualHint && (
              <span className="text-2xl">{currentSlide.visualHint}</span>
            )}
            <div>
              <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {currentSlide.title}
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Slide {currentSlideIndex + 1} of {totalSlides}
              </p>
            </div>
          </div>

          {/* Concept - The main point */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
            <p className="text-base font-medium text-blue-900 dark:text-blue-100">
              {currentSlide.concept}
            </p>
          </div>

          {/* Explanation */}
          <div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {currentSlide.explanation}
            </p>
          </div>

          {/* Why It Matters */}
          <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
            <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                Why This Matters For You
              </p>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                {currentSlide.whyItMatters}
              </p>
            </div>
          </div>

          {/* What Happens Without */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                What Happens If You Skip This
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {currentSlide.whatHappensWithout}
              </p>
            </div>
          </div>

          {/* Real-World Example */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
              Real-World Example
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 italic">
              {currentSlide.realWorldExample}
            </p>
          </div>

          {/* Key Takeaway */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-100 dark:border-purple-900/50">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
              Key Takeaway
            </p>
            <p className="text-base font-semibold text-purple-900 dark:text-purple-100">
              "{currentSlide.keyTakeaway}"
            </p>
          </div>
        </div>
      ) : null}

      {/* Resources (shown after slides or during review) */}
      {lesson.resources && lesson.resources.length > 0 && !showCheck && (
        <div className="px-6 pb-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
            Learn More
          </p>
          <div className="space-y-2">
            {lesson.resources.slice(0, 2).map((resource, i) => (
              <a
                key={i}
                href={resource.directUrl || `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery || resource.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onResourceClick?.(resource)}
                className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors group"
              >
                {resource.thumbnailUrl ? (
                  <img
                    src={resource.thumbnailUrl}
                    alt={resource.title}
                    className="w-12 h-9 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-9 bg-neutral-200 dark:bg-neutral-700 rounded flex items-center justify-center">
                    <Play className="w-4 h-4 text-neutral-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {resource.title}
                  </p>
                  {resource.description && (
                    <p className="text-xs text-neutral-500 truncate">
                      {resource.description}
                    </p>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between">
        <button
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0 && !showCheck}
          className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            currentSlideIndex === 0 && !showCheck
              ? 'text-neutral-400 cursor-not-allowed'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={goToNextSlide}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {isLastSlide && !showCheck ? (
            hasUnderstandingCheck ? (
              <>
                Check Understanding
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Complete Lesson
                <CheckCircle2 className="w-4 h-4" />
              </>
            )
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default LessonSlides
