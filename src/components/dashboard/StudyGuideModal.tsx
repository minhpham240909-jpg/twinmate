'use client'

/**
 * StudyGuideModal - Professional AI-generated study guide popup
 *
 * Shows personalized study advice before user enters solo study room.
 * Tone: Professional mentor giving guidance
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, BookOpen, Sparkles, ArrowRight } from 'lucide-react'

interface StudyGuideModalProps {
  isOpen: boolean
  onClose: () => void
  subject: string
  suggestionType: 'review_needed' | 'continue' | 'new_topic' | 'streak'
}

export default function StudyGuideModal({
  isOpen,
  onClose,
  subject,
  suggestionType,
}: StudyGuideModalProps) {
  const router = useRouter()
  const [guide, setGuide] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch guide when modal opens
  useEffect(() => {
    if (isOpen && subject) {
      fetchGuide()
    }
  }, [isOpen, subject])

  const fetchGuide = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/study/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, suggestionType }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate guide')
      }

      const data = await response.json()
      setGuide(data.guide)
    } catch (err) {
      console.error('Error fetching study guide:', err)
      setError('Unable to generate guide. You can still proceed with your study session.')
      // Fallback guide
      setGuide(`Focus on building understanding in ${subject}. Take it one concept at a time, and don't hesitate to review fundamentals if needed. Consistent effort leads to mastery.`)
    } finally {
      setLoading(false)
    }
  }

  const handleProceed = () => {
    onClose()
    router.push(`/solo-study?subject=${encodeURIComponent(subject)}`)
  }

  const handleSkip = () => {
    onClose()
    router.push(`/solo-study?subject=${encodeURIComponent(subject)}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-lg hover:bg-white/50 dark:hover:bg-neutral-800/50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Your Study Guide
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {subject}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-blue-200 dark:border-blue-800 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="mt-4 flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                <span className="text-sm">Preparing your personalized guide...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Guide Text */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {guide}
                </p>
              </div>

              {error && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSkip}
            disabled={loading}
            className="flex-1 px-4 py-3 text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleProceed}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>Let's Go</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
