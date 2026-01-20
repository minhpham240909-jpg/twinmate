'use client'

import { useState } from 'react'
import { useStudySuggestions } from '@/hooks/useUserStats'
import { AlertCircle, BookOpen, RefreshCw, Sparkles, Flame } from 'lucide-react'
import StudyGuideModal from './StudyGuideModal'

/**
 * Study Suggestions Component
 * Shows personalized AI-powered study recommendations
 *
 * When clicked, shows a professional AI-generated study guide modal
 * before navigating to the solo study room.
 *
 * Examples:
 * - "Review Chemistry - You haven't studied this in 3 days"
 * - "Continue Math - Last studied yesterday"
 * - "Start studying Biology - You haven't studied this class yet"
 *
 * Props:
 * - maxSuggestions: Limit number of suggestions shown (for progressive disclosure)
 */

interface Suggestion {
  id: string
  type: 'review_needed' | 'continue' | 'new_topic' | 'streak'
  title: string
  description: string
  subject?: string
  actionUrl?: string
}

interface StudySuggestionsProps {
  maxSuggestions?: number
}

export default function StudySuggestions({ maxSuggestions }: StudySuggestionsProps = {}) {
  const { data, isLoading, error } = useStudySuggestions()
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [showGuideModal, setShowGuideModal] = useState(false)

  // Apply maxSuggestions limit if provided
  const allSuggestions = data?.suggestions || []
  const suggestions = maxSuggestions ? allSuggestions.slice(0, maxSuggestions) : allSuggestions

  // Don't show if no suggestions
  if (!isLoading && suggestions.length === 0) {
    return null
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
          <div className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // Error state - subtle, don't break the UI
  if (error) {
    return null
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'review_needed':
        return <AlertCircle className="w-4 h-4 text-amber-500" />
      case 'continue':
        return <RefreshCw className="w-4 h-4 text-blue-500" />
      case 'new_topic':
        return <BookOpen className="w-4 h-4 text-green-500" />
      case 'streak':
        return <Flame className="w-4 h-4 text-orange-500" />
      default:
        return <Sparkles className="w-4 h-4 text-purple-500" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'review_needed':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700'
      case 'continue':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700'
      case 'new_topic':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700'
      case 'streak':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700'
      default:
        return 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
    }
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    // Extract subject from title (e.g., "Review: Chemistry" -> "Chemistry")
    const subject = suggestion.subject ||
      suggestion.title.replace(/^(Review|Continue|Start):\s*/i, '').trim()

    setSelectedSuggestion({ ...suggestion, subject })
    setShowGuideModal(true)
  }

  const handleCloseModal = () => {
    setShowGuideModal(false)
    setSelectedSuggestion(null)
  }

  return (
    <>
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Suggested for you</h3>
        </div>

        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion as Suggestion)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${getTypeColor(suggestion.type)}`}
            >
              {getTypeIcon(suggestion.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                  {suggestion.title}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {suggestion.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Study Guide Modal */}
      {selectedSuggestion && (
        <StudyGuideModal
          isOpen={showGuideModal}
          onClose={handleCloseModal}
          subject={selectedSuggestion.subject || ''}
          suggestionType={selectedSuggestion.type}
        />
      )}
    </>
  )
}
