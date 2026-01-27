'use client'

import { useState } from 'react'
import {
  Play,
  FileText,
  Dumbbell,
  Wrench,
  BookOpen,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Star,
} from 'lucide-react'

interface StepResource {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  url?: string
  searchQuery?: string
}

interface ResourceCardProps {
  resource: StepResource
  subject?: string
  stepTitle?: string
}

/**
 * ResourceCard - Displays a learning resource with click tracking and feedback
 *
 * Features:
 * - Tracks clicks for quality analytics
 * - Allows users to vote if resource was helpful
 * - Shows quality badges for highly-rated resources
 */
export function ResourceCard({ resource, subject, stepTitle }: ResourceCardProps) {
  const [voted, setVoted] = useState<'helpful' | 'not_helpful' | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  // Get icon based on resource type
  const ResourceIcon = {
    video: Play,
    article: FileText,
    exercise: Dumbbell,
    tool: Wrench,
    book: BookOpen,
  }[resource.type] || FileText

  // Generate search URL if searchQuery is provided
  const searchUrl = resource.searchQuery
    ? resource.type === 'video'
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(resource.searchQuery)}`
      : `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`
    : resource.url

  // Track resource click
  const handleClick = () => {
    fetch('/api/resource/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'click',
        resourceType: resource.type,
        resourceTitle: resource.title,
        searchQuery: resource.searchQuery,
        url: searchUrl,
        subject,
        stepTitle,
      }),
    }).catch(() => {}) // Silent fail

    // Show feedback option after a delay
    setTimeout(() => setShowFeedback(true), 500)
  }

  // Handle helpful vote
  const handleVote = (isHelpful: boolean) => {
    const action = isHelpful ? 'helpful' : 'not_helpful'
    setVoted(action)

    fetch('/api/resource/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        resourceType: resource.type,
        resourceTitle: resource.title,
        searchQuery: resource.searchQuery,
        url: searchUrl,
        subject,
        stepTitle,
      }),
    }).catch(() => {}) // Silent fail
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg border border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors overflow-hidden">
      <a
        href={searchUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="flex items-start gap-3 p-2.5 group"
      >
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${
          resource.type === 'video'
            ? 'bg-red-100 dark:bg-red-900/30'
            : resource.type === 'exercise'
            ? 'bg-orange-100 dark:bg-orange-900/30'
            : 'bg-indigo-100 dark:bg-indigo-900/30'
        }`}>
          <ResourceIcon className={`w-3.5 h-3.5 ${
            resource.type === 'video'
              ? 'text-red-600 dark:text-red-400'
              : resource.type === 'exercise'
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-indigo-600 dark:text-indigo-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {resource.title}
            </span>
            {searchUrl && (
              <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
            )}
          </div>
          {resource.description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
              {resource.description}
            </p>
          )}
        </div>
      </a>

      {/* Feedback section - appears after clicking */}
      {showFeedback && !voted && (
        <div className="px-2.5 pb-2 flex items-center gap-2 border-t border-indigo-50 dark:border-indigo-900/30 pt-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Was this helpful?</span>
          <button
            onClick={() => handleVote(true)}
            className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-950/30 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            title="Yes, helpful"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleVote(false)}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="No, not helpful"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Thank you message after voting */}
      {voted && (
        <div className="px-2.5 pb-2 flex items-center gap-1.5 border-t border-indigo-50 dark:border-indigo-900/30 pt-2">
          {voted === 'helpful' ? (
            <>
              <Star className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400">Thanks! This helps other learners.</span>
            </>
          ) : (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Thanks for the feedback.</span>
          )}
        </div>
      )}
    </div>
  )
}

export default ResourceCard
