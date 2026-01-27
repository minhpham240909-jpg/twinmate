'use client'

/**
 * STEP MICRO-ACTIONS COMPONENT
 *
 * Provides lightweight AI assistance buttons for each roadmap step:
 * - Explain this: Get a clear explanation of the step concept
 * - Give example: See a practical example
 * - Test me: Quick comprehension check
 *
 * Features:
 * - Lazy loading of content
 * - Cached responses
 * - Smooth animations
 * - Accessible keyboard navigation
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  BookOpen,
  Code,
  HelpCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type MicroActionType = 'explain' | 'example' | 'test'

interface StepMicroActionsProps {
  stepId: string
  roadmapId: string
  stepTitle: string
  isLocked?: boolean
  className?: string
}

interface ActionButtonProps {
  type: MicroActionType
  label: string
  icon: React.ReactNode
  isActive: boolean
  isLoading: boolean
  onClick: () => void
  disabled?: boolean
}

// ============================================
// ACTION BUTTON COMPONENT
// ============================================

function ActionButton({
  type,
  label,
  icon,
  isActive,
  isLoading,
  onClick,
  disabled,
}: ActionButtonProps) {
  const colors = {
    explain: {
      base: 'border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30',
      active: 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600',
      icon: 'text-blue-600 dark:text-blue-400',
    },
    example: {
      base: 'border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30',
      active: 'bg-purple-50 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600',
      icon: 'text-purple-600 dark:text-purple-400',
    },
    test: {
      base: 'border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30',
      active: 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600',
      icon: 'text-amber-600 dark:text-amber-400',
    },
  }

  const color = colors[type]

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
        transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isActive ? color.active : color.base}
      `}
      aria-pressed={isActive}
      aria-label={label}
    >
      <span className={`${color.icon} transition-colors`}>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          icon
        )}
      </span>
      <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
    </button>
  )
}

// ============================================
// CONTENT PANEL COMPONENT
// ============================================

function ContentPanel({
  type,
  content,
  isLoading,
  onClose,
  onRefresh,
}: {
  type: MicroActionType
  content: string
  isLoading: boolean
  onClose: () => void
  onRefresh: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus panel when opened for accessibility
  useEffect(() => {
    if (content && panelRef.current) {
      panelRef.current.focus()
    }
  }, [content])

  const titles = {
    explain: 'Explanation',
    example: 'Example',
    test: 'Quick Test',
  }

  const colors = {
    explain: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20',
    example: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20',
    test: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20',
  }

  const headerColors = {
    explain: 'text-blue-700 dark:text-blue-400',
    example: 'text-purple-700 dark:text-purple-400',
    test: 'text-amber-700 dark:text-amber-400',
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`
        mt-3 p-4 rounded-xl border-2
        ${colors[type]}
        animate-in slide-in-from-top-2 duration-200
      `}
      role="region"
      aria-label={titles[type]}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-semibold ${headerColors[type]}`}>
          {titles[type]}
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
            aria-label="Refresh content"
          >
            <RefreshCw className={`w-4 h-4 text-neutral-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {/* Render content with basic markdown support */}
          {content.split('\n').map((paragraph, i) => {
            // Handle bold text
            const formatted = paragraph.replace(
              /\*\*(.+?)\*\*/g,
              '<strong>$1</strong>'
            )

            // Handle code blocks
            if (paragraph.startsWith('```')) {
              return null // Skip code fence markers
            }

            if (paragraph.trim() === '') {
              return <br key={i} />
            }

            return (
              <p
                key={i}
                className="text-sm text-neutral-700 dark:text-neutral-300 mb-2 last:mb-0"
                dangerouslySetInnerHTML={{ __html: formatted }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StepMicroActions({
  stepId,
  roadmapId,
  stepTitle,
  isLocked = false,
  className = '',
}: StepMicroActionsProps) {
  const [activeAction, setActiveAction] = useState<MicroActionType | null>(null)
  const [content, setContent] = useState<Record<MicroActionType, string>>({
    explain: '',
    example: '',
    test: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch content from API
  const fetchContent = useCallback(async (type: MicroActionType, forceRefresh = false) => {
    // Return cached content if available and not forcing refresh
    if (content[type] && !forceRefresh) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/roadmap/step/micro-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stepId,
          roadmapId,
          actionType: type,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch content')
      }

      const data = await response.json()

      if (data.success && data.content) {
        setContent(prev => ({
          ...prev,
          [type]: data.content,
        }))
      } else {
        throw new Error('Invalid response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [stepId, roadmapId, content])

  // Handle action button click
  const handleActionClick = useCallback((type: MicroActionType) => {
    if (activeAction === type) {
      // Toggle off if clicking the same action
      setActiveAction(null)
    } else {
      setActiveAction(type)
      fetchContent(type)
    }
  }, [activeAction, fetchContent])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (activeAction) {
      fetchContent(activeAction, true)
    }
  }, [activeAction, fetchContent])

  // Handle close
  const handleClose = useCallback(() => {
    setActiveAction(null)
  }, [])

  if (isLocked) {
    return null // Don't show actions for locked steps
  }

  return (
    <div className={`${className}`}>
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="explain"
          label="Explain"
          icon={<BookOpen className="w-4 h-4" />}
          isActive={activeAction === 'explain'}
          isLoading={isLoading && activeAction === 'explain'}
          onClick={() => handleActionClick('explain')}
        />
        <ActionButton
          type="example"
          label="Example"
          icon={<Code className="w-4 h-4" />}
          isActive={activeAction === 'example'}
          isLoading={isLoading && activeAction === 'example'}
          onClick={() => handleActionClick('example')}
        />
        <ActionButton
          type="test"
          label="Test Me"
          icon={<HelpCircle className="w-4 h-4" />}
          isActive={activeAction === 'test'}
          isLoading={isLoading && activeAction === 'test'}
          onClick={() => handleActionClick('test')}
        />
      </div>

      {/* Content panel */}
      {activeAction && (
        <ContentPanel
          type={activeAction}
          content={content[activeAction]}
          isLoading={isLoading}
          onClose={handleClose}
          onRefresh={handleRefresh}
        />
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}

export default StepMicroActions
